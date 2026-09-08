/**
 * Devnexes AI — Autonomous Master Graph Planner
 * The Thinking Engine dynamically designs the full execution graph (DAG):
 * - Determines how many nodes are genuinely needed
 * - Strict capability check (refuses impossible/out-of-scope tasks honestly)
 * - Assigns unique names, tasks, dependencies (input chaining), and parallel stages
 */

import { DETAILED_SKILLS, getMatchingSkill } from '../skills/index.js';

export function getLatestCodeArtifact(messagesHistory = []) {
  if (!messagesHistory || messagesHistory.length === 0) return null;
  for (let i = messagesHistory.length - 1; i >= 0; i--) {
    const m = messagesHistory[i];
    const art = m.traceData?.steps?.find(s => (s.type === 'code' || s.type === 'artifact') && s.code);
    if (art && art.code) {
      return {
        code: art.code,
        language: art.language || 'html',
        title: art.title || 'Existing Artifact',
        messageIndex: i + 1
      };
    }
  }
  return null;
}

export function formatConversationHistoryWithIndices(messagesHistory = []) {
  if (!messagesHistory || messagesHistory.length === 0) return '';
  return messagesHistory.map((m, idx) => {
    const msgNum = idx + 1;
    const role = m.role === 'user' ? 'User' : 'Assistant';
    if (m.role === 'user') {
      return `[Message #${msgNum} (${role})]: ${m.content}`;
    }
    const art = m.traceData?.steps?.find(s => (s.type === 'code' || s.type === 'artifact') && s.code);
    const artNote = art ? `(Generated ${art.language} artifact: "${art.title || art.name}" — ${art.code.split('\n').length} lines)\n` : '';
    const resp = m.content || m.traceData?.steps?.find(s => s.type === 'response')?.content || '';
    return `[Message #${msgNum} (${role})]: ${artNote}${resp}`;
  }).join('\n\n');
}

function safeExtractJson(text) {
  if (!text) return null;
  const str = text.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(str);
  } catch (e) {}

  // 2. Remove markdown code fences & strip leading/trailing commentary
  const cleaned = str
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // 3. Extract JSON object {...} or array [...]
  const firstCurly = cleaned.indexOf('{');
  const lastCurly = cleaned.lastIndexOf('}');
  const firstSquare = cleaned.indexOf('[');
  const lastSquare = cleaned.lastIndexOf(']');

  let candidates = [];
  if (firstCurly !== -1 && lastCurly > firstCurly) {
    candidates.push(cleaned.substring(firstCurly, lastCurly + 1));
  }
  if (firstSquare !== -1 && lastSquare > firstSquare) {
    candidates.push(cleaned.substring(firstSquare, lastSquare + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (e) {}

    // 4. Sanitize trailing commas and strip JS comments
    try {
      const sanitized = candidate
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      return JSON.parse(sanitized);
    } catch (e) {}
  }

  return null;
}

export async function planDynamicExecutionGraph({ prompt, image, apiKey, model, messagesHistory = [] }) {
  const allSkillIds = Object.keys(DETAILED_SKILLS).join(' | ');
  const hasImage = !!image;

  const systemPlannerPrompt = `You are the Master Graph Architect and Autonomous Thinking Engine for Devnexes AI.

Analyze the user's message with extreme intelligence and high precision. Understand English, Roman Urdu, Hindi, and Urdu seamlessly.
Dynamically design an optimal, focused execution graph (DAG) of nodes.

${hasImage ? `[IMAGE / SCREENSHOT ATTACHED]: The user has attached an image or screenshot!
- Queries like "ismy kya ha", "ye kya hai", "kya likha hai", "check this", "explain this" are 100% CLEAR visual inspection requests.
- NEVER set "needsClarification": true when an image is attached!
- If the user just wants to understand/analyze the image, create a single "vision" node.` : ''}

OUTPUT ONLY VALID JSON:
{
  "needsClarification": false,
  "clarification": {
    "question": "Question to ask the user if and only if prompt is ambiguous",
    "options": ["Option A", "Option B", "Option C"]
  },
  "cannotPerform": false,
  "cannotPerformReason": null,
  "intentCategory": "${hasImage ? 'VISION_ANALYSIS' : 'GREETING | CONVERSATION | CODE_BUILD | RESEARCH | ANALYSIS | DOCUMENT'}",
  "thinkingSummary": "${hasImage ? 'Inspecting image visual elements, layout, and extracted details' : 'Direct, technical strategy for solving the prompt cleanly'}",
  "executionPlanSummary": "${hasImage ? 'Visual Inspection & Detailed Analysis' : 'e.g. Stage 1: Real-Time Web Search -> Stage 2: Verified Fact Synthesis'}",
  "doneStateCriteria": "${hasImage ? 'Comprehensive visual inspection, details, and answers delivered' : 'e.g. Accurate verified factual summary delivered'}",
  "skillId": "${allSkillIds}",
  "nodes": [
    {
      "id": "node_unique_id",
      "name": "Clear Descriptive Node Title",
      "type": "${hasImage ? 'vision | code | analysis | synthesis | search' : 'search | code | analysis | synthesis'}",
      "task": "Specific, actionable instruction for this node",
      "inputFrom": ["id_of_previous_node_if_needed"],
      "canParallel": false,
      "executionStage": 1,
      "searchQuery": "Optimized real-world search query if type is search, otherwise null",
      "artifactLanguage": "html | cpp | python | javascript | java | css | sql | typescript",
      "artifactTitle": "Short title for code if type is code"
    }
  ]
}

INTENT CLASSIFICATION RULES (CRITICAL):
${hasImage ? `0. VISION & SCREENSHOT ANALYSIS (When image/screenshot is attached):
   - ALWAYS set "needsClarification": false.
   - If user asks to convert screenshot to code or build what is seen:
     * Node 1: "vision" (id: "node_vision", name: "Visual Blueprint Inspection", task: "Analyze UI layout, colors, and components from screenshot")
     * Node 2: "code" (id: "node_code", name: "Code Implementation", task: "Implement clean, production-ready code based on visual blueprint", inputFrom: ["node_vision"])
     * Node 3: "synthesis" (id: "node_synthesis", name: "Synthesis & Guide", inputFrom: ["node_code"])
   - If user asks to analyze, explain, transcribe, or asks "ismy kya ha" / "what is this":
     * Node 1: "vision" (id: "node_vision", name: "Visual Analysis & Comprehension", task: "Analyze the image thoroughly and explain its content in depth")
` : ''}
1. RESEARCH & INFORMATION RETRIEVAL (Web Search + Synthesis):
   - Triggers: Any request to search Google/web, find facts, companies, people, CEOs, employees, developers, news, reviews, or prices.
   - Pipeline:
     * Node 1: "search" (Live Tavily search with clean, targeted keywords)
     * Node 2: "synthesis" (Synthesize strictly from verified search snippets)
   - NEVER create a "code" node for search or question queries unless the user specifically wrote "write a python script / code to search google".

2. CODE & UI BUILD (Code + Architecture Notes):
   - Triggers: Explicit requests to program, build, code, or fix software/UI.
   - Examples: "build a modern portfolio in html", "write python binary search", "fix this react error", "create landing page".
   - Pipeline:
     * Node 1: "code" (100% complete, working code to canvas)
     * Node 2: "synthesis" (3-4 bullet point architecture summary)

3. CONTEXT CONTINUITY & FOLLOW-UP RESOLUTION:
   - When the user asks a brief follow-up:
     * ALWAYS resolve the entity and topic from the prior conversation history!
     * NEVER ask for clarification or present MCQs on follow-ups when the context is already known from previous messages!

4. STRICT CLARIFICATION & MCQ RULES:
   - ONLY trigger clarification ("needsClarification": true) when ALL of the following are true:
     a) It is a brand new, highly underspecified creation task (e.g. "make an app", "create a website", "write a game").
     b) There is NO conversation history or image clarifying what kind of app or style is wanted.
   - DO NOT trigger clarification for image uploads, search queries, factual questions, follow-ups, bug fixes, or clear instructions.

5. CAPABILITY BOUNDARY:
   - ONLY set "cannotPerform": true for truly physical or impossible real-world tasks (e.g. "deliver a pizza to my house", "call my phone").`;

  const historySummary = messagesHistory.length > 0
    ? messagesHistory.slice(-8).map(m => {
      if (m.role === 'user') return `User: ${m.content}`;
      const art = m.traceData?.steps?.find(s => s.type === 'code' || s.type === 'artifact');
      if (art) return `AI: Generated ${art.language} code — "${art.title}"`;
      const resp = m.content || m.traceData?.steps?.find(s => s.type === 'response')?.content || '';
      return resp ? `AI: ${resp.slice(0, 160)}` : '';
    }).filter(Boolean).join('\n')
    : null;

  const keysToTry = Array.isArray(apiKey) && apiKey.length > 0
    ? apiKey
    : [apiKey].filter(Boolean);

  const modelsToTry = [
    model || 'groq/compound-mini',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
  ];

  for (const currentModel of modelsToTry) {
    for (let i = 0; i < keysToTry.length; i++) {
      const key = keysToTry[i];
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              { role: 'system', content: systemPlannerPrompt },
              {
                role: 'user',
                content: historySummary
                  ? `Prior conversation history:\n${historySummary}\n\nCurrent user request: "${prompt}"`
                  : `Current user request: "${prompt}"`
              }
            ],
            temperature: 0.1,
            max_tokens: 700
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) {
          if (res.status === 429 || res.status === 401) {
            continue; // Try next key in pool
          }
          throw new Error(`Planner HTTP ${res.status}`);
        }

        const json = await res.json();
        const rawContent = json.choices?.[0]?.message?.content || '';

        // Check if model returned a direct refusal in natural text
        const lowerRaw = rawContent.toLowerCase();
        if (lowerRaw.includes("i cannot") || lowerRaw.includes("i can't") || lowerRaw.includes("unable to")) {
          return {
            cannotPerform: true,
            cannotPerformReason: rawContent.slice(0, 200),
            intentCategory: 'REFUSAL',
            nodes: []
          };
        }

        const plan = safeExtractJson(rawContent);

        if (plan && typeof plan === 'object') {
          if (!Array.isArray(plan.nodes)) plan.nodes = [];
          return plan;
        }
      } catch (err) {
        // Continue fallback attempts
      }
    }
  }

  // Fallback heuristic graph if LLM router was unreachable
  if (hasImage) {
    return {
      cannotPerform: false,
      intentCategory: 'VISION_ANALYSIS',
      thinkingSummary: 'Image attached. Performing deep visual inspection and contextual analysis.',
      executionPlanSummary: 'Visual Inspection & Detailed Analysis',
      doneStateCriteria: 'Comprehensive visual inspection and explanation delivered',
      skillId: 'web-research-analyst',
      nodes: [
        {
          id: 'node_vision',
          name: 'Visual Analysis & Comprehension',
          type: 'vision',
          task: 'Analyze the image thoroughly and explain its content in depth',
          executionStage: 1
        }
      ]
    };
  }

  const matched = getMatchingSkill(prompt);
  const lower = prompt.toLowerCase().trim();
  
  // Distinguish search intents vs code intents in English and Roman Urdu
  const isSearchCommand = /\b(google|search|dhoondo|dhundo|pata karo|btao|batayein|koun|kaun|who|what|where|current|latest|news|info|details|list|employees|developers|ceo)\b/i.test(lower);
  const isExplicitCodeRequest = /\b(code likho|script banao|html banao|program likho|write code|write script|create app|build website|implement class|write a python script|develop app)\b/i.test(lower);
  const looksLikeGreeting = lower.length < 18 && /\b(hi|hello|hey|salam|assalam|hola|sup|good morning|kese ho)\b/i.test(lower);

  if (looksLikeGreeting) {
    return {
      cannotPerform: false,
      intentCategory: 'GREETING',
      thinkingSummary: 'Casual greeting detected.',
      skillId: matched.id,
      nodes: []
    };
  }

  const fallbackNodes = [];
  let stage = 1;

  if (isSearchCommand || (!isExplicitCodeRequest && !looksLikeGreeting)) {
    // Extract clean search query from prompt
    const cleanQuery = prompt
      .replace(/google py|google pe|search karo|pury internet sy dundho|dhoondo|btao/gi, '')
      .trim() || prompt;

    fallbackNodes.push({
      id: 'node_search_1',
      name: 'Real-Time Web Search',
      type: 'search',
      task: `Perform live web search for: "${cleanQuery}"`,
      inputFrom: [],
      canParallel: false,
      executionStage: stage++,
      searchQuery: cleanQuery.slice(0, 100)
    });
  }

  if (isExplicitCodeRequest) {
    const isHtml = matched.id === 'frontend-design' || /\b(html|css|website|dashboard|ui)\b/i.test(lower);
    fallbackNodes.push({
      id: 'node_code_impl',
      name: isHtml ? 'Modern UI/UX Implementation' : 'Full Architecture & Code Implementation',
      type: 'code',
      task: `Generate 100% complete, production-grade functional code for: "${prompt}"`,
      inputFrom: fallbackNodes.map(n => n.id),
      canParallel: false,
      executionStage: stage++,
      artifactLanguage: isHtml ? 'html' : 'python',
      artifactTitle: prompt.slice(0, 40)
    });
  }

  fallbackNodes.push({
    id: 'node_final_synth',
    name: 'Synthesis & Quality Verification',
    type: 'synthesis',
    task: `Synthesize findings with strict factual accuracy for: "${prompt}"`,
    inputFrom: fallbackNodes.map(n => n.id),
    canParallel: false,
    executionStage: stage++
  });

  return {
    cannotPerform: false,
    intentCategory: isExplicitCodeRequest ? 'CODE_BUILD' : 'RESEARCH',
    thinkingSummary: `Dynamic execution graph planned with ${fallbackNodes.length} nodes.`,
    skillId: matched.id,
    nodes: fallbackNodes
  };
}

