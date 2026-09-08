import { DETAILED_SKILLS } from '../skills/index.js';
import { planDynamicExecutionGraph, formatConversationHistoryWithIndices, getLatestCodeArtifact } from './agentOrchestrator.js';

export const DEFAULT_MODEL = 'groq/compound-mini';
export const FAST_MODEL = 'groq/compound-mini';
export const VISION_MODEL = 'qwen/qwen3.6-27b';

export const AVAILABLE_MODELS = [
  { id: 'groq/compound-mini', name: 'Devnexes Fast' },
  { id: 'openai/gpt-oss-120b', name: 'Devnexes Pro' }
];

export const VISION_FALLBACK_MODELS = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b'
];

const RESILIENT_FALLBACK_MODELS = [
  'groq/compound-mini',
  'groq/compound',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b'
];

let activeKeyIndex = 0;

/**
 * Returns all configured Groq API keys from env variables and localStorage.
 */
export function getAllGroqApiKeys() {
  const envKeys = [
    import.meta.env.VITE_GROQ_API_KEY,
    import.meta.env.VITE_GROQ_API_KEY_1,
    import.meta.env.VITE_GROQ_API_KEY_2,
    import.meta.env.VITE_GROQ_API_KEY_3,
    import.meta.env.VITE_GROQ_API_KEY_4,
    import.meta.env.GROQ_API_KEY_1,
    import.meta.env.GROQ_API_KEY_2,
    import.meta.env.GROQ_API_KEY_3,
    import.meta.env.GROQ_API_KEY_4,
  ];

  const localStored = localStorage.getItem('groq_api_key') || localStorage.getItem('groq_api_keys') || '';
  const localKeys = localStored
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(Boolean);

  const rawKeys = [...localKeys, ...envKeys].filter(Boolean).map(k => k.trim());
  const uniqueKeys = Array.from(new Set(rawKeys)).filter(k => k.startsWith('gsk_') || k.length > 15);
  return uniqueKeys;
}

/**
 * Returns the currently active Groq API key from the pool.
 */
export function getGroqApiKey() {
  const keys = getAllGroqApiKeys();
  if (keys.length === 0) return '';
  return keys[activeKeyIndex % keys.length];
}

/**
 * Rotates to the next Groq API key in the pool.
 */
export function rotateGroqApiKey() {
  const keys = getAllGroqApiKeys();
  if (keys.length > 1) {
    activeKeyIndex = (activeKeyIndex + 1) % keys.length;
    console.info(`[Groq Pool] Rotated to Key #${activeKeyIndex + 1} of ${keys.length}`);
  }
  return getGroqApiKey();
}

export function setGroqApiKey(key) {
  if (key) localStorage.setItem('groq_api_key', key.trim());
  else localStorage.removeItem('groq_api_key');
}

/**
 * Core streaming chat with Groq API — with automatic multi-key failover and rate-limit model fallback.
 */
export async function streamGroqChat({ messages, model = DEFAULT_MODEL, apiKey, onChunk, onError, maxTokens }) {
  const poolKeys = getAllGroqApiKeys();
  const availableKeys = Array.isArray(apiKey) && apiKey.length > 0
    ? apiKey
    : (apiKey ? [apiKey, ...poolKeys.filter(k => k !== apiKey)] : poolKeys);

  if (availableKeys.length === 0) {
    const err = new Error('Groq API key missing. Please provide at least one Groq API key.');
    if (onError) onError(err);
    throw err;
  }

  // Detect if messages contain multimodal image content
  const hasVisionPayload = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));

  // Ensure safe message payload size to prevent 413 and 429 TPM errors on free tier
  const safeMessages = messages.map(m => {
    if (typeof m.content === 'string' && m.content.length > 12000) {
      return { ...m, content: m.content.slice(0, 12000) };
    }
    return m;
  });

  const modelsToTry = hasVisionPayload
    ? [VISION_MODEL, ...VISION_FALLBACK_MODELS.filter(m => m !== VISION_MODEL)]
    : [model, ...RESILIENT_FALLBACK_MODELS.filter(m => m !== model)];

  let lastError = null;

  for (const currentModel of modelsToTry) {
    const totalAttempts = availableKeys.length;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      const keyIdx = (activeKeyIndex + attempt) % availableKeys.length;
      const keyToUse = availableKeys[keyIdx];

      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${keyToUse}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel,
            messages: safeMessages,
            temperature: 0.2,
            stream: true,
            ...(maxTokens ? { max_tokens: maxTokens } : {})
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${response.status}`;
          console.warn(`[Groq Failover] Key #${keyIdx + 1} with ${currentModel} returned ${response.status}: ${errMsg}. Rotating to next API key...`);
          activeKeyIndex = (keyIdx + 1) % availableKeys.length;
          lastError = new Error(errMsg);
          continue; // Instantly try next key in the 5-key pool
        }

        // Successful connection: update active index to this working key
        activeKeyIndex = keyIdx;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let lineEndIdx;
          while ((lineEndIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, lineEndIdx).trim();
            buffer = buffer.slice(lineEndIdx + 1);
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices[0]?.delta?.content || '';
                if (delta) {
                  fullText += delta;
                  if (onChunk) onChunk(delta, fullText);
                }
              } catch (_) { /* partial JSON chunk */ }
            }
          }
        }

        return fullText;
      } catch (err) {
        lastError = err;
        console.warn(`[Groq Failover] Key #${keyIdx + 1} with ${currentModel} failed:`, err.message);
        if (attempt < totalAttempts - 1) {
          rotateGroqApiKey();
        }
      }
    }
  }

  if (onError) onError(lastError);
  throw lastError;
}


/**
 * Real-time web search using Tavily API (with fallback to Wikipedia / DuckDuckGo).
 * Returns real web sources, domains, snippets, and favicons.
 */
export async function realTavilySearch(query) {
  const tavilyKey = localStorage.getItem('tavily_api_key') || 
                    import.meta.env.VITE_TAVILY_API_KEY || 
                    import.meta.env.TAVILY_API_KEY || 
                    '';

  const results = [];

  // 1. PRIMARY: Real Tavily Search API
  if (tavilyKey) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          include_raw_content: false,
          max_results: 5
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          for (const item of data.results) {
            try {
              const urlObj = new URL(item.url);
              const domain = urlObj.hostname.replace(/^www\./, '');
              results.push({
                title: item.title || domain,
                snippet: item.content ? (item.content.slice(0, 220) + (item.content.length > 220 ? '...' : '')) : '',
                url: item.url,
                domain,
                favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`,
                score: item.score || 1,
                source: 'tavily'
              });
            } catch (_) {}
          }
          if (results.length > 0) return results;
        }
      }
    } catch (e) {
      console.warn('[Search] Tavily API error, falling back:', e.message);
    }
  }

  // 2. FALLBACK: Wikipedia Search API (CORS-safe)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5&srnamespace=0&srprop=snippet`;
    const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();

    if (data.query?.search?.length > 0) {
      for (const item of data.query.search.slice(0, 4)) {
        const clean = (item.snippet || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
        results.push({
          title: item.title,
          snippet: clean.slice(0, 200) + (clean.length > 200 ? '...' : ''),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          domain: 'wikipedia.org',
          favicon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32',
          source: 'wikipedia'
        });
      }
      if (results.length > 0) return results;
    }
  } catch (e) {
    console.warn('[Search] Wikipedia fallback error:', e.message);
  }

  // 3. SECOND FALLBACK: DuckDuckGo Instant Answer
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        snippet: data.AbstractText.slice(0, 220),
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        domain: 'duckduckgo.com',
        favicon: 'https://www.google.com/s2/favicons?domain=duckduckgo.com&sz=32',
        source: 'duckduckgo'
      });
    }
  } catch (_) {}

  return results;
}

/**
 * DYNAMIC AI NODE-GRAPH PIPELINE — 100% Real-Time & Live Token Streaming
 * Executes a dynamically planned DAG graph created by the AI thinking engine.
 */
export async function generateDynamicAgentPipeline({
  userPrompt,
  userImage = null,
  model = DEFAULT_MODEL,
  apiKey = getGroqApiKey(),
  onStepUpdate,
  onChunk,
  onError,
  messagesHistory = []
}) {
  const allKeys = getAllGroqApiKeys();
  const keyToUse = apiKey || getGroqApiKey();
  if (!keyToUse && allKeys.length === 0) throw new Error('Groq API key missing.');

  // Build full indexed conversation archive so AI knows every single message index (e.g. Msg #4, #49, etc.)
  const historyArchive = formatConversationHistoryWithIndices(messagesHistory);
  const pastContext = historyArchive ? [
    {
      role: 'system',
      content: `CONVERSATION ARCHIVE (${messagesHistory.length} total messages in this active chat session):\nEvery message is indexed [Message #1], [Message #2], ... [Message #${messagesHistory.length}]. You have full context and memory of this entire discussion.\n\n${historyArchive.slice(-20000)}`
    }
  ] : [];

  // ── STAGE 0: AI Dynamic Graph Planning ────────────────────────
  const plan = await planDynamicExecutionGraph({
    prompt: userPrompt,
    image: userImage,
    apiKey: allKeys.length > 0 ? allKeys : [keyToUse],
    model,
    messagesHistory
  });

  // Ensure vision node exists if image is provided
  if (userImage && (!plan.nodes || !plan.nodes.some(n => n.type === 'vision'))) {
    if (!plan.nodes) plan.nodes = [];
    plan.nodes.unshift({
      id: 'node_vision',
      name: 'Visual Inspection & OCR Analysis',
      type: 'vision',
      task: 'Perform deep visual inspection, OCR text & code extraction, and diagnose UI/errors',
      executionStage: 1
    });
  }

  // Interactive Clarification / MCQ Stage (When prompt needs user decision)
  if (plan.needsClarification && plan.clarification && !userImage) {
    const clar = plan.clarification;
    const steps = [
      {
        id: 'node_clarification',
        name: 'Interactive Clarification',
        type: 'clarification',
        status: 'completed',
        clarification: clar
      },
      {
        type: 'response',
        content: `**${clar.question}**\n\nPlease choose an option below to proceed:`
      }
    ];
    if (onStepUpdate) onStepUpdate(steps);
    return { hasCode: false, needsClarification: true };
  }

  // Strict Capability Check: If AI cannot perform the task
  if (plan.cannotPerform && !userImage) {
    const refusalText = plan.cannotPerformReason || 
      `I cannot perform this requested task. As an AI assistant, I can only execute digital development, technical analysis, code generation, and live web research tasks.`;
    
    const steps = [
      {
        id: 'node_refusal',
        name: 'Capability Boundary Check',
        type: 'cannot_perform',
        status: 'completed',
        content: refusalText
      },
      { type: 'response', content: refusalText }
    ];
    if (onStepUpdate) onStepUpdate(steps);
    if (onChunk) onChunk(refusalText, refusalText);
    return { hasCode: false };
  }

  // Pure Casual Greeting or Conversational questions (when no image attached) -> Fast Direct Stream
  if (!userImage && (plan.intentCategory === 'GREETING' || plan.intentCategory === 'CONVERSATION' || !plan.nodes || plan.nodes.length === 0)) {
    const steps = [{ type: 'response', content: '' }];
    if (onStepUpdate) onStepUpdate(steps, true);

    const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

    await streamGroqChat({
      messages: [
        {
          role: 'system',
          content: `You are Devnexes AI — a helpful, highly accurate, and intelligent AI assistant.
Answer the user's prompt directly, naturally, and concisely in the user's language (English or Roman Urdu).
- If the user asks a simple, casual, or follow-up question (e.g. "what was message 4?", "what task completed?"), answer it directly and accurately without robotic boilerplate or artificial status reports.
- Do NOT generate code unless code was specifically requested.`
        },
        ...pastContext,
        { role: 'user', content: userPrompt }
      ],
      model,
      apiKey: poolKeysToUse,
      onChunk: (delta, fullText) => {
        steps[0].content = fullText;
        if (onStepUpdate) onStepUpdate([...steps], true);
        if (onChunk) onChunk(delta, fullText);
      },
      onError
    });
    return { hasCode: false };
  }

  // ── STAGE 1: Initialize Real Graph Nodes in UI ─────────────────
  const activeSkill = DETAILED_SKILLS[plan.skillId] || DETAILED_SKILLS['web-research-analyst'];
  
  // Transform planned nodes into active execution steps
  const traceSteps = [];

  // Add Dynamic Graph Architecture / Thinking node first with full DAG metadata
  traceSteps.push({
    id: 'node_thinking_plan',
    name: 'Dynamic Graph Architecture',
    type: 'thinking',
    status: 'completed',
    content: plan.thinkingSummary || (userImage ? 'Image uploaded. Inspecting visual components & OCR text...' : 'Dynamic execution graph planned based on user prompt.'),
    executionPlanSummary: plan.executionPlanSummary || null,
    doneStateCriteria: plan.doneStateCriteria || null,
    totalPlannedNodes: plan.nodes.length,
    isStreaming: false
  });

  // Add all dynamically planned nodes with 'pending' status
  for (const node of plan.nodes) {
    traceSteps.push({
      id: node.id,
      name: node.name,
      type: node.type,
      status: 'pending', // 'pending' | 'running' | 'completed' | 'error'
      task: node.task,
      image: node.type === 'vision' ? userImage : null,
      inputFrom: node.inputFrom || [],
      canParallel: !!node.canParallel,
      executionStage: node.executionStage || 1,
      content: '',
      code: '',
      language: node.artifactLanguage || 'html',
      title: node.artifactTitle || node.name,
      query: node.searchQuery || null,
      results: [],
      isStreaming: false
    });
  }

  // Add final response placeholder
  traceSteps.push({ type: 'response', content: '' });
  if (onStepUpdate) onStepUpdate([...traceSteps]);

  // Output store to feed previous node outputs into subsequent nodes
  const nodeOutputs = {};
  let hasCode = false;

  // ── STAGE 2: Execute Nodes by Dependency Stages ───────────────
  const stages = Array.from(new Set(plan.nodes.map(n => n.executionStage || 1))).sort((a, b) => a - b);

  for (const currentStage of stages) {
    const stageNodes = traceSteps.filter(s => s.type !== 'response' && s.type !== 'thinking' && s.executionStage === currentStage);

    // Function to execute a single node
    const executeNode = async (node) => {
      const nodeIdx = traceSteps.findIndex(s => s.id === node.id);
      if (nodeIdx === -1) return;

      traceSteps[nodeIdx].status = 'running';
      traceSteps[nodeIdx].isStreaming = true;
      if (onStepUpdate) onStepUpdate([...traceSteps]);

      // Collect inputs from predecessor nodes
      const dependencyContexts = (node.inputFrom || [])
        .map(depId => {
          const out = nodeOutputs[depId];
          return out ? `[Output from ${depId}]:\n${out}` : null;
        })
        .filter(Boolean)
        .join('\n\n');

      try {
        // ── VISION / SCREENSHOT INSPECTION NODE ──────────────────
        if (node.type === 'vision') {
          const imgToAnalyze = node.image || userImage;
          let visionResult = '';
          const hasSubsequentDeliverable = plan.nodes.some(n => n.id !== node.id && (n.type === 'synthesis' || n.type === 'code' || n.type === 'analysis'));
          const respIdx = traceSteps.findIndex(s => s.type === 'response');

          const visionSystemPrompt = `You are Devnexes Vision Engine — a world-class, highly intelligent multimodal visual AI.
Analyze the provided image/screenshot with deep intelligence, precision, and natural communication.

User Query / Intent: "${userPrompt || 'Is image mein kya hai, tafseel se batayein'}"

COMMUNICATION & LANGUAGE GUIDELINES:
1. Seamlessly understand Roman Urdu, Hindi, Urdu, and English. If the user asks in Roman Urdu (e.g., "ismy kya ha", "ye kya hai", "kya likha hai", "check this"), provide a natural, smart, and articulate response in the user's preferred language.
2. ADAPTIVE & INTELLIGENT COMPREHENSION (DO NOT use rigid, repetitive, or robotic boilerplate form templates):
   - **For Lifestyle / Fashion / People / Photography**: Describe the subject, person, pose, outfit details (colors, shirts, pants, footwear, accessories), background setting, lighting, and overall aesthetic naturally and thoroughly.
   - **For UI / Web / Mobile App Screenshots**: Explain the visual hierarchy, UI components, color palette, typography, design pattern, and product functionality.
   - **For Code / Errors / Terminal Logs**: Transcribe the exact error or code verbatim, diagnose the root cause with high accuracy, and provide the concrete solution.
   - **For Documents / Charts / Infographics**: Extract text cleanly and synthesize the key insights and data points.
3. Keep the tone natural, professional, and directly helpful without repeating the same sentence or adding robotic disclaimers.`;

          const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

          await streamGroqChat({
            messages: [
              { role: 'system', content: visionSystemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt ? `User prompt: ${userPrompt}\nAnalyze this image/screenshot in detail.` : 'Analyze this image/screenshot in detail.' },
                  { type: 'image_url', image_url: { url: imgToAnalyze } }
                ]
              }
            ],
            model: VISION_MODEL,
            apiKey: poolKeysToUse,
            onChunk: (delta, fullText) => {
              visionResult = fullText;
              if (!hasSubsequentDeliverable && respIdx !== -1) {
                traceSteps[respIdx].content = fullText;
                if (onChunk) onChunk(delta, fullText);
              } else {
                traceSteps[nodeIdx].content = fullText;
              }
              if (onStepUpdate) onStepUpdate([...traceSteps]);
            },
            maxTokens: 2500
          });

          traceSteps[nodeIdx].status = 'completed';
          traceSteps[nodeIdx].isStreaming = false;
          if (!hasSubsequentDeliverable) {
            traceSteps[nodeIdx].content = 'Visual inspection completed.';
          }
          nodeOutputs[node.id] = visionResult;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── SEARCH NODE ──────────────────────────────────────────
        else if (node.type === 'search') {
          const query = node.query || userPrompt;
          const searchResults = await realTavilySearch(query);

          traceSteps[nodeIdx].results = searchResults;
          traceSteps[nodeIdx].status = 'completed';
          traceSteps[nodeIdx].isStreaming = false;

          const searchSummary = searchResults.map((r, idx) => 
            `[Source #${idx + 1} | ${r.title}]\nVerified URL: ${r.url}\nDomain: ${r.domain}\nVerified Content: ${r.snippet}`
          ).join('\n\n');

          nodeOutputs[node.id] = searchSummary || `Search conducted for: "${query}" (no public results returned)`;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── CODE GENERATION NODE ─────────────────────────────────
        else if (node.type === 'code') {
          hasCode = true;
          const lang = node.language || 'html';
          const latestArtifact = getLatestCodeArtifact(messagesHistory);
          
          const codeSystemPrompt = `${activeSkill.systemPrompt}

You are executing Node: "${node.name}".
Task: ${node.task}
Target Language: ${lang}

CRITICAL RULES:
- You MUST output 100% COMPLETE, WORKING, PRODUCTION-READY ${lang.toUpperCase()} source code.
- Start IMMEDIATELY with the markdown code fence: \`\`\`${lang}
- Do NOT output any introductory or conversational text before the code block.
- Zero placeholders, zero TODOs, zero simulated code.
- CODE MODIFICATION & CONTINUITY CONTRACT:
  * When modifying or adding features to existing code (e.g. adding JS, adding sections, styling, responsive enhancements, fixing bugs), you MUST base your work directly on the PREVIOUS EXISTING CODE provided below.
  * PRESERVE all existing brand names (e.g. Acme Corp), copy, layout, styling, and sections. Do NOT throw away the user's previous design or replace it with an unrelated generic template!
  * Seamlessly integrate the requested enhancements, JavaScript, CSS animations, or new components directly into the existing codebase.
- End cleanly with \`\`\`.`;

          let codeUserPrompt = `User Request: "${userPrompt}"\n\nTask: ${node.task}`;
          if (latestArtifact && latestArtifact.code) {
            codeUserPrompt = `User Request: "${userPrompt}"\n\n=== PREVIOUS EXISTING CODE (Base your modifications on this exact code. Preserve all existing sections, branding, and design): ===\n\`\`\`${latestArtifact.language}\n${latestArtifact.code}\n\`\`\`\n\nTask: ${node.task}`;
          }
          if (dependencyContexts) {
            codeUserPrompt += `\n\nContext from previous execution stages:\n${dependencyContexts}`;
          }

          const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

          await streamGroqChat({
            messages: [
              { role: 'system', content: codeSystemPrompt },
              ...pastContext,
              { role: 'user', content: codeUserPrompt }
            ],
            model,
            apiKey: poolKeysToUse,
            onChunk: (delta, fullText) => {
              traceSteps[nodeIdx].code = fullText;
              if (onStepUpdate) onStepUpdate([...traceSteps]);
            }
          });

          traceSteps[nodeIdx].status = 'completed';
          traceSteps[nodeIdx].isStreaming = false;
          nodeOutputs[node.id] = traceSteps[nodeIdx].code;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── ANALYSIS / ARCHITECTURE NODE ─────────────────────────
        else if (node.type === 'analysis') {
          const analysisSystemPrompt = `${activeSkill.systemPrompt}

You are executing Node: "${node.name}".
Task: ${node.task}
Provide a structured, accurate, line-by-line or section-by-section breakdown. Provide sharp, high-value technical analysis.`;

          const analysisUserPrompt = dependencyContexts
            ? `User Request: "${userPrompt}"\n\nPrior Stage Findings:\n${dependencyContexts}\n\nTask: ${node.task}`
            : `User Request: "${userPrompt}"\n\nTask: ${node.task}`;

          const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

          await streamGroqChat({
            messages: [
              { role: 'system', content: analysisSystemPrompt },
              ...pastContext,
              { role: 'user', content: analysisUserPrompt }
            ],
            model,
            apiKey: poolKeysToUse,
            onChunk: (delta, fullText) => {
              traceSteps[nodeIdx].content = fullText;
              if (onStepUpdate) onStepUpdate([...traceSteps]);
            }
          });

          traceSteps[nodeIdx].status = 'completed';
          traceSteps[nodeIdx].isStreaming = false;
          nodeOutputs[node.id] = traceSteps[nodeIdx].content;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── SYNTHESIS NODE ───────────────────────────────────────
        else if (node.type === 'synthesis') {
          const synthSystemPrompt = `${activeSkill.systemPrompt}

You are executing the Final Synthesis Node: "${node.name}".

CRITICAL OUTPUT & SYNTHESIS RULES:
1. CODE DUMP PROHIBITION: ${hasCode ? 'The complete source code has ALREADY been generated directly into the interactive Canvas & Code Panel. You MUST NOT repeat, duplicate, or dump the source code in this text response! Do NOT output massive code blocks.' : 'Provide a concise, verified response.'}
2. Provide a clean, structured overview:
   - Summary of what was created or modified.
   - Key architectural decisions & features added (e.g. JavaScript interactivity, animations, responsive design).
   - Quick instructions for previewing in Canvas.
3. GROUNDING: Base all factual claims strictly on verified data. No hallucinated URLs or fake data.
4. LANGUAGE: Answer naturally and clearly in the user's language (English or Roman Urdu).`;

          const allOutputs = Object.entries(nodeOutputs)
            .map(([k, v]) => `=== Verified Data from [${k}] ===\n${v.slice(0, 4000)}`)
            .join('\n\n');

          const synthUserPrompt = `User Prompt: "${userPrompt}"\n\nExecution Stage Verified Data:\n${allOutputs}\n\nTask: ${node.task}`;

          const respIdx = traceSteps.findIndex(s => s.type === 'response');
          const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

          await streamGroqChat({
            messages: [
              { role: 'system', content: synthSystemPrompt },
              ...pastContext,
              { role: 'user', content: synthUserPrompt }
            ],
            model,
            apiKey: poolKeysToUse,
            onChunk: (delta, fullText) => {
              if (respIdx !== -1) traceSteps[respIdx].content = fullText;
              if (onStepUpdate) onStepUpdate([...traceSteps]);
              if (onChunk) onChunk(delta, fullText);
            },
            onError
          });

          traceSteps[nodeIdx].status = 'completed';
          traceSteps[nodeIdx].isStreaming = false;
          traceSteps[nodeIdx].content = 'Synthesized deliverables.';
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }
      } catch (err) {
        console.error(`[Graph Executor] Node ${node.id} error:`, err);
        traceSteps[nodeIdx].status = 'error';
        traceSteps[nodeIdx].isStreaming = false;
        if (onStepUpdate) onStepUpdate([...traceSteps]);
      }
    };

    // Parallel or Sequential execution for this stage
    const canRunStageInParallel = stageNodes.length > 1 && stageNodes.every(n => n.canParallel);

    if (canRunStageInParallel) {
      await Promise.all(stageNodes.map(node => executeNode(node)));
    } else {
      for (const node of stageNodes) {
        await executeNode(node);
      }
    }
  }

  // Ensure final response is populated if not done in synthesis
  const respNode = traceSteps.find(s => s.type === 'response');
  if (respNode && !respNode.content) {
    const synthOutput = Object.values(nodeOutputs).join('\n\n');
    if (synthOutput && synthOutput.trim()) {
      respNode.content = synthOutput;
      if (onStepUpdate) onStepUpdate([...traceSteps]);
      if (onChunk) onChunk(synthOutput, synthOutput);
    } else {
      // Auto-recover response using FAST_MODEL so user never gets empty or generic text
      const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];
      await streamGroqChat({
        messages: [
          {
            role: 'system',
            content: `You are Devnexes AI. Answer the user's prompt directly, clearly, and concisely in the user's language (English or Roman Urdu).`
          },
          ...pastContext,
          { role: 'user', content: userPrompt }
        ],
        model: FAST_MODEL,
        apiKey: poolKeysToUse,
        onChunk: (delta, fullText) => {
          respNode.content = fullText;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
          if (onChunk) onChunk(delta, fullText);
        }
      });
    }
  }

  return { hasCode };
}

