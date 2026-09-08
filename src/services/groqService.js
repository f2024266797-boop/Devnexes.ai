import { DETAILED_SKILLS } from '../skills/index.js';
import { planDynamicExecutionGraph, formatConversationHistoryWithIndices, getLatestCodeArtifact } from './agentOrchestrator.js';

export const DEFAULT_MODEL = 'groq/compound-mini';
export const FAST_MODEL = 'groq/compound-mini';
export const PRO_MODEL = 'llama-3.3-70b-versatile';
export const VISION_MODEL = 'qwen/qwen3.6-27b';

export const AVAILABLE_MODELS = [
  { id: 'groq/compound-mini', name: 'Groq Compound Mini' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B' }
];

export const VISION_FALLBACK_MODELS = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b'
];

const RESILIENT_FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'groq/compound-mini',
  'groq/compound',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b'
];

export function cleanMetaPlanningPreamble(text) {
  if (!text) return '';
  return text
    .replace(/^The user wants\b[\s\S]*?(?:Plan Strategy\b[\s\S]*?Success Goal\b[\s\S]*?\n\n|Success Goal\b[\s\S]*?\n\n)/i, '')
    .replace(/^Plan Strategy\b[\s\S]*?Success Goal\b[\s\S]*?\n\n/i, '')
    .replace(/^Stage\s*\d+:[\s\S]*?Success Goal[\s\S]*?\n\n/i, '')
    .trimStart();
}

let activeKeyIndex = 0;
const keyCooldowns = new Map(); // key -> cooldownUntilTimestamp

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
 * Mark a key as rate-limited with a 60-second cooldown.
 */
export function markKeyCooldown(key) {
  if (!key) return;
  keyCooldowns.set(key, Date.now() + 60000);
}

/**
 * Returns the currently active Groq API key from the pool, prioritizing healthy non-cooldown keys.
 */
export function getGroqApiKey() {
  const keys = getAllGroqApiKeys();
  if (keys.length === 0) return '';
  
  const now = Date.now();
  const healthyKeys = keys.filter(k => (keyCooldowns.get(k) || 0) < now);
  const pool = healthyKeys.length > 0 ? healthyKeys : keys;
  
  return pool[activeKeyIndex % pool.length];
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

  const modelsToTry = hasVisionPayload
    ? [VISION_MODEL, ...VISION_FALLBACK_MODELS.filter(m => m !== VISION_MODEL)]
    : [model, ...RESILIENT_FALLBACK_MODELS.filter(m => m !== model)];

  let lastError = null;

  for (const currentModel of modelsToTry) {
    // Model-specific TPM & context length budgeting
    const isLowTpmModel = currentModel.includes('gpt-oss');
    const safeMaxChars = isLowTpmModel ? 5500 : 14000;
    const modelMaxTokens = isLowTpmModel ? Math.min(maxTokens || 2500, 2500) : (maxTokens ? Math.min(maxTokens, 8192) : 8192);

    const safeMessages = messages.map(m => {
      if (typeof m.content === 'string' && m.content.length > safeMaxChars) {
        return { ...m, content: m.content.slice(0, safeMaxChars) };
      }
      return m;
    });

    const totalAttempts = availableKeys.length;
    let modelQuotaExhausted = false;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      if (modelQuotaExhausted) break;

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
            max_tokens: modelMaxTokens
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${response.status}`;
          console.warn(`[Groq Failover] Key #${keyIdx + 1} with ${currentModel} returned ${response.status}: ${errMsg}`);

          // If daily quota or organization TPM is reached for this model, advance to next model immediately
          if (errMsg.includes('tokens per day (TPD)') || errMsg.includes('TPD') || response.status === 413) {
            modelQuotaExhausted = true;
          }
          if (response.status === 429 || response.status === 413) {
            markKeyCooldown(keyToUse);
          }
          activeKeyIndex = (keyIdx + 1) % availableKeys.length;
          lastError = new Error(errMsg);
          continue;
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
  messagesHistory = [],
  forceWebSearch = false,
  forceCanvasCode = false
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
    messagesHistory,
    forceWebSearch,
    forceCanvasCode
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

  // Pure Casual Greeting or Conversational questions (when no image attached & NO forced filters active) -> Fast Direct Stream
  if (!forceWebSearch && !forceCanvasCode && !userImage && (plan.intentCategory === 'GREETING' || plan.intentCategory === 'CONVERSATION' || !plan.nodes || plan.nodes.length === 0)) {
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

  // ── STAGE 1: Initialize Thinking Node in UI ───────────────────
  const activeSkill = DETAILED_SKILLS[plan.skillId] || DETAILED_SKILLS['web-research-analyst'];
  
  // Guarantee forced filters are present in plan nodes
  if (forceWebSearch && !plan.nodes.some(n => n.type === 'search' || /search|research/i.test(n.type))) {
    const cleanQuery = userPrompt.replace(/google py|google pe|search karo|dhoondo|btao/gi, '').trim() || userPrompt;
    plan.nodes.unshift({
      id: 'node_forced_search',
      name: 'Real-Time Web Grounding',
      type: 'search',
      task: `Execute real-time web search for: "${cleanQuery}"`,
      inputFrom: [],
      canParallel: false,
      executionStage: 1,
      searchQuery: cleanQuery
    });
  }

  if (forceCanvasCode && !plan.nodes.some(n => n.type === 'code' || /code|artifact|build/i.test(n.type))) {
    const isHtml = /\b(html|css|website|dashboard|ui|ecommerce|react|store|canvas|frontend)\b/i.test(userPrompt);
    plan.nodes.push({
      id: 'node_forced_canvas_code',
      name: isHtml ? 'Interactive Canvas UI' : 'Canvas Code Implementation',
      type: 'code',
      task: `Generate 100% complete, standalone runnable code for: "${userPrompt}" into Code Canvas`,
      inputFrom: plan.nodes.map(n => n.id),
      canParallel: false,
      executionStage: plan.nodes.length + 1,
      artifactLanguage: isHtml ? 'html' : 'python',
      artifactTitle: userPrompt.slice(0, 36)
    });
  }

  // Start with ONLY the thinking node — subsequent nodes will be created strictly one-by-one
  const traceSteps = [];

  // Add Dynamic Graph Architecture / Thinking node
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

  // Add final response placeholder
  traceSteps.push({ type: 'response', content: '' });
  if (onStepUpdate) onStepUpdate([...traceSteps]);

  // Output store to feed previous node outputs into subsequent nodes
  const nodeOutputs = {};
  let hasCode = false;

  // ── STAGE 2: Progressively Create & Execute Nodes One-by-One ───
  const stages = Array.from(new Set(plan.nodes.map(n => n.executionStage || 1))).sort((a, b) => a - b);

  for (const currentStage of stages) {
    const stagePlannedNodes = plan.nodes.filter(n => (n.executionStage || 1) === currentStage);

    for (const nodeConfig of stagePlannedNodes) {
      // 1. Create and inject THIS node into traceSteps ONLY NOW (when ready to execute)
      const activeNode = {
        id: nodeConfig.id,
        name: nodeConfig.name,
        type: nodeConfig.type,
        status: 'running',
        task: nodeConfig.task,
        image: nodeConfig.type === 'vision' ? userImage : null,
        inputFrom: nodeConfig.inputFrom || [],
        canParallel: !!nodeConfig.canParallel,
        executionStage: nodeConfig.executionStage || 1,
        content: '',
        code: '',
        language: nodeConfig.artifactLanguage || 'html',
        title: nodeConfig.artifactTitle || nodeConfig.name,
        query: nodeConfig.searchQuery || null,
        results: [],
        isStreaming: true
      };

      const respIdx = traceSteps.findIndex(s => s.type === 'response');
      if (respIdx !== -1) {
        traceSteps.splice(respIdx, 0, activeNode);
      } else {
        traceSteps.push(activeNode);
      }
      if (onStepUpdate) onStepUpdate([...traceSteps]);

      // Collect inputs from predecessor nodes
      const dependencyContexts = (nodeConfig.inputFrom || [])
        .map(depId => {
          const out = nodeOutputs[depId];
          return out ? `[Output from ${depId}]:\n${out}` : null;
        })
        .filter(Boolean)
        .join('\n\n');

      const getNodeIdx = () => traceSteps.findIndex(s => s.id === activeNode.id);

      try {
        const isSearchType = /search|research|lookup|google/i.test(activeNode.type);
        const isCodeType = /code|artifact|implementation|build|coding|develop/i.test(activeNode.type);
        const isCmdType = /cmd|terminal|cli|command|runner|powershell/i.test(activeNode.type);
        const isVisionType = /vision|image|ocr/i.test(activeNode.type);

        // ── 1. VISION / SCREENSHOT INSPECTION NODE ───────────────
        if (isVisionType) {
          const imgToAnalyze = activeNode.image || userImage;
          let visionResult = '';
          const hasSubsequentDeliverable = plan.nodes.some(n => n.id !== activeNode.id);
          const currentRespIdx = traceSteps.findIndex(s => s.type === 'response');

          const visionSystemPrompt = `You are Devnexes Vision Engine — a world-class, highly intelligent multimodal visual AI.
Analyze the provided image/screenshot with deep intelligence, precision, and natural communication.

User Query / Intent: "${userPrompt || 'Is image mein kya hai, tafseel se batayein'}"

COMMUNICATION & LANGUAGE GUIDELINES:
1. Understand Roman Urdu, Hindi, Urdu, and English natively.
2. Provide a thorough, articulate analysis matching the image type (UI screenshot, error log, photo, document).`;

          const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

          await streamGroqChat({
            messages: [
              { role: 'system', content: visionSystemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt ? `User prompt: ${userPrompt}\nAnalyze this image in detail.` : 'Analyze this image in detail.' },
                  { type: 'image_url', image_url: { url: imgToAnalyze } }
                ]
              }
            ],
            model: VISION_MODEL,
            apiKey: poolKeysToUse,
            onChunk: (delta, fullText) => {
              visionResult = fullText;
              const idx = getNodeIdx();
              if (!hasSubsequentDeliverable && currentRespIdx !== -1) {
                traceSteps[currentRespIdx].content = fullText;
                if (onChunk) onChunk(delta, fullText);
              } else if (idx !== -1) {
                traceSteps[idx].content = fullText;
              }
              if (onStepUpdate) onStepUpdate([...traceSteps]);
            },
            maxTokens: 2500
          });

          const idx = getNodeIdx();
          if (idx !== -1) {
            traceSteps[idx].status = 'completed';
            traceSteps[idx].isStreaming = false;
            if (!hasSubsequentDeliverable) {
              traceSteps[idx].content = 'Visual inspection completed.';
            }
          }
          nodeOutputs[activeNode.id] = visionResult;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── 2. SEARCH NODE (REAL TAVILY / WIKI SEARCH) ───────────
        else if (isSearchType) {
          const query = activeNode.query || userPrompt;
          const searchResults = await realTavilySearch(query);

          const idx = getNodeIdx();
          if (idx !== -1) {
            traceSteps[idx].results = searchResults;
            traceSteps[idx].status = 'completed';
            traceSteps[idx].isStreaming = false;
          }

          const searchSummary = searchResults.map((r, sIdx) => 
            `--- Research Finding #${sIdx + 1} (${r.domain}): ${r.title} ---\nInformation: ${r.snippet}\nVerified Link: ${r.url}`
          ).join('\n\n');

          nodeOutputs[activeNode.id] = searchSummary || `Search conducted for: "${query}" (${searchResults.length} sources found)`;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── 3. CODE GENERATION NODE ──────────────────────────────
        else if (isCodeType) {
          hasCode = true;
          const lang = activeNode.language || 'html';
          const latestArtifact = getLatestCodeArtifact(messagesHistory);
          
          const codeSystemPrompt = `${activeSkill.systemPrompt}

You are executing Node: "${activeNode.name}".
Task: ${activeNode.task}
Target Language: ${lang}

CRITICAL RULES:
- Output 100% COMPLETE, WORKING, PRODUCTION-READY ${lang.toUpperCase()} source code.
- Start IMMEDIATELY with the markdown code fence: \`\`\`${lang}
- Zero placeholders, zero TODOs.
- End cleanly with \`\`\`.`;

          let codeUserPrompt = `User Request: "${userPrompt}"\n\nTask: ${activeNode.task}`;
          if (latestArtifact && latestArtifact.code) {
            codeUserPrompt = `User Request: "${userPrompt}"\n\n=== PREVIOUS EXISTING CODE (Base your modifications on this exact code): ===\n\`\`\`${latestArtifact.language}\n${latestArtifact.code}\n\`\`\`\n\nTask: ${activeNode.task}`;
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
              const idx = getNodeIdx();
              if (idx !== -1) {
                traceSteps[idx].code = fullText;
                if (onStepUpdate) onStepUpdate([...traceSteps]);
              }
            }
          });

          const idx = getNodeIdx();
          if (idx !== -1) {
            traceSteps[idx].status = 'completed';
            traceSteps[idx].isStreaming = false;
            nodeOutputs[activeNode.id] = traceSteps[idx].code;
          }
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── 4. CMD / TERMINAL RUNNER NODE ────────────────────────
        else if (isCmdType) {
          const cmdSystemPrompt = `${activeSkill.systemPrompt}

You are Devnexes CLI Engine. Executing Node: "${activeNode.name}".
Task: ${activeNode.task}

CRITICAL RULES:
1. Output ONLY 1 to 3 exact, minimal, copy-pasteable Windows CMD / PowerShell commands to run or serve this project locally.
2. Structure with clean short comment labels (e.g. "# 1. Launch local live server").
3. DO NOT output long paragraphs, explanations, or essays. Only the clean commands and concise comments.`;

          const cmdUserPrompt = dependencyContexts
            ? `User Request: "${userPrompt}"\n\nProject Context:\n${dependencyContexts.slice(0, 500)}\n\nTask: ${activeNode.task}`
            : `User Request: "${userPrompt}"\n\nTask: ${activeNode.task}`;

          const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

          await streamGroqChat({
            messages: [
              { role: 'system', content: cmdSystemPrompt },
              ...pastContext,
              { role: 'user', content: cmdUserPrompt }
            ],
            model,
            apiKey: poolKeysToUse,
            onChunk: (delta, fullText) => {
              const idx = getNodeIdx();
              if (idx !== -1) {
                traceSteps[idx].content = fullText;
                if (onStepUpdate) onStepUpdate([...traceSteps]);
              }
            }
          });

          const idx = getNodeIdx();
          if (idx !== -1) {
            traceSteps[idx].status = 'completed';
            traceSteps[idx].isStreaming = false;
            nodeOutputs[activeNode.id] = traceSteps[idx].content;
          }
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }

        // ── 5. GENERAL ANALYSIS / ROADMAP / EXECUTION NODE ───────
        else {
          const analysisSystemPrompt = `${activeSkill.systemPrompt}

You are executing Node: "${activeNode.name}".
Task: ${activeNode.task}
Provide a sharp, accurate, high-density technical analysis or direct findings for this step with zero generic filler.`;

          const analysisUserPrompt = dependencyContexts
            ? `User Request: "${userPrompt}"\n\nPrior Stage Findings:\n${dependencyContexts}\n\nTask: ${activeNode.task}`
            : `User Request: "${userPrompt}"\n\nTask: ${activeNode.task}`;

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
              const idx = getNodeIdx();
              if (idx !== -1) {
                traceSteps[idx].content = fullText;
                if (onStepUpdate) onStepUpdate([...traceSteps]);
              }
            }
          });

          const idx = getNodeIdx();
          if (idx !== -1) {
            traceSteps[idx].status = 'completed';
            traceSteps[idx].isStreaming = false;
            nodeOutputs[activeNode.id] = traceSteps[idx].content;
          }
          if (onStepUpdate) onStepUpdate([...traceSteps]);
        }
      } catch (err) {
        console.error(`[Graph Executor] Node ${activeNode.id} error:`, err);
        const idx = getNodeIdx();
        if (idx !== -1) {
          traceSteps[idx].status = 'error';
          traceSteps[idx].isStreaming = false;
        }
        if (onStepUpdate) onStepUpdate([...traceSteps]);
      }

      // Smooth transition pause so current node closes gracefully before next node is created
      await new Promise(r => setTimeout(r, 450));
    }
  }

  // ── STAGE 3: Final Comprehensive Synthesis & Direct Intelligent Response Delivery ─
  const respNode = traceSteps.find(s => s.type === 'response');
  if (respNode && (!respNode.content || respNode.content.trim().startsWith('[Source #'))) {
    const rawData = Object.entries(nodeOutputs)
      .map(([k, v]) => `=== Findings from [${k}] ===\n${v}`)
      .join('\n\n');
    const poolKeysToUse = allKeys.length > 0 ? allKeys : [keyToUse];

    const finalSynthPrompt = `${activeSkill.systemPrompt}

You are Devnexes AI — a world-class, highly intelligent, and direct AI engineer & researcher.

CRITICAL RESPONSE DIRECTIVES:
1. ANSWER DIRECTLY WITH HIGH INTELLECT & NATURAL ESSENCE:
   - Provide a natural, insightful, well-written answer directly explaining the topic/person/request using the verified findings.
   - DO NOT output audit tables of search snippets or source evaluations (do NOT create tables of "Source", "Key Insight", "Relevance", "What it might represent", or "Next steps"). Deliver the final synthesized answer directly!
   - NO generic meta-commentary (do NOT output "Plan Strategy", "Goal:", "Deliverable Summary", "Site Architecture", or internal outlines).
2. ZERO RAW SOURCE DUMPS:
   - Never output raw search markers like "[Source #1 | ...]". Weave verified facts seamlessly into your prose.
3. CODE CANVAS ACKNOWLEDGEMENT:
   - If a website or code artifact was generated in Canvas, mention in 1-2 clean sentences that the complete standalone project is ready in the Code Canvas.
4. LANGUAGE FLUENCY:
   - Match the user's language (Roman Urdu, Urdu, or English) with high natural intelligence and conversational clarity.`;

    await streamGroqChat({
      messages: [
        { role: 'system', content: finalSynthPrompt },
        ...pastContext,
        {
          role: 'user',
          content: rawData
            ? `User Request: "${userPrompt}"\n\nVerified Stage Findings:\n${rawData}\n\nDeliver the direct comprehensive response now:`
            : userPrompt
        }
      ],
      model: model || FAST_MODEL,
      apiKey: poolKeysToUse,
      onChunk: (delta, fullText) => {
        const cleaned = cleanMetaPlanningPreamble(fullText);
        respNode.content = cleaned;
        if (onStepUpdate) onStepUpdate([...traceSteps]);
        if (onChunk) onChunk(delta, cleaned);
      }
    });
  }

  return { hasCode };
}

