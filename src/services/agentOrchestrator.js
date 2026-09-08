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

export async function planDynamicExecutionGraph({ prompt, image, apiKey, model, messagesHistory = [], forceWebSearch = false, forceCanvasCode = false }) {
  const allSkillIds = Object.keys(DETAILED_SKILLS).join(' | ');
  const hasImage = !!image;
  const systemPlannerPrompt = `You are the High-IQ Master Graph Architect and Autonomous Thinking Engine for Devnexes AI.

Analyze the user's message with deep cognitive intelligence, structural clarity, and domain depth. Understand English, Roman Urdu, Hindi, and Urdu natively.
Dynamically design an unconstrained, high-density execution graph (DAG) tailored specifically to the user's explicit and implicit intent.

UNRESTRICTED GRAPH SIZING & DENSITY:
- There is ZERO artificial restriction or ceiling on the number of execution nodes (from 1, 2, 3, 5, 8, 10 up to 20+ nodes as appropriate).
- Small queries = 1-2 focused nodes.
- Full-stack apps, e-commerce platforms, complex tools, or multi-file systems = Plan a comprehensive, multi-stage DAG (e.g. Architecture -> Frontend Canvas UI -> Backend API & Models -> Auth & State -> Local Terminal Runner).

${forceWebSearch ? `[USER EXPLICITLY ENABLED LIVE WEB SEARCH FILTER]:
- You MUST include a "search" node (Stage 1) with an optimal search query, followed by a "synthesis" node (Stage 2) grounded in the search results!` : ''}

${forceCanvasCode ? `[USER EXPLICITLY ENABLED LIVE CANVAS CODE FILTER]:
- You MUST include a "code" node (Stage 1) to generate complete production code into the interactive Canvas, followed by a "synthesis" node (Stage 2)!` : ''}

${hasImage ? `[IMAGE / SCREENSHOT ATTACHED]: The user has attached an image or screenshot!
- Queries like "ismy kya ha", "ye kya hai", "kya likha hai", "check this", "explain this" are 100% CLEAR visual inspection requests.
- NEVER set "needsClarification": true when an image is attached!
- If the user just wants to understand/analyze the image, create a single "vision" node.` : ''}

CLARIFICATION & INTERACTIVE MCQ DIRECTIVES:
- If the user's request is ambiguous, open-ended, or has multiple valid design/tech paths (e.g. "ecommerce website", "create website", "build app", "search something", "portfolio", or vague prompts):
  * Set "needsClarification": true!
  * Formulate a sharp clarifying question in "question" and provide 3-4 distinct actionable choices in "options" (e.g. ["Simple Static HTML/CSS", "React Frontend + Node/Express", "Full-Stack Python Django", "Next.js + Tailwind"]).
- If the user has ALREADY provided specific details (e.g. "Ducky Bhai real name", "Django REST API", "React calculator") or is responding to a previous MCQ choice:
  * Set "needsClarification": false and immediately plan the execution graph!

OUTPUT ONLY VALID JSON:
{
  "needsClarification": false,
  "clarification": {
    "question": "Clear, direct clarifying question if and only if prompt is underspecified",
    "options": ["Option A", "Option B", "Option C"]
  },
  "cannotPerform": false,
  "cannotPerformReason": null,
  "intentCategory": "${forceWebSearch ? 'RESEARCH' : forceCanvasCode ? 'CODE_BUILD' : hasImage ? 'VISION_ANALYSIS' : 'GREETING | CONVERSATION | CODE_BUILD | RESEARCH | ARCHITECTURE | ANALYSIS | ROADMAP'}",
  "thinkingSummary": "Sharp, insightful analytical summary explaining the strategic approach to the query",
  "executionPlanSummary": "Structured multi-stage plan summary (e.g. Stage 1: Search -> Stage 2: Code Canvas Build -> Stage 3: Local Terminal Runner)",
  "doneStateCriteria": "Clear, measurable criteria for successful task fulfillment",
  "skillId": "${allSkillIds}",
  "nodes": [
    {
      "id": "node_unique_id",
      "name": "Concise Descriptive Node Title",
      "type": "search | code | cmd | analysis | synthesis | vision",
      "task": "Sharp, actionable task instruction for this node",
      "inputFrom": ["id_of_previous_node_if_needed"],
      "canParallel": false,
      "executionStage": 1,
      "searchQuery": "Targeted search keywords if type is search, otherwise null",
      "artifactLanguage": "html | cpp | python | javascript | java | css | sql | typescript",
      "artifactTitle": "Concise title for code artifact if type is code"
    }
  ]
}

AUTONOMOUS THINKING & DOMAIN DECOMPOSITION GUIDELINES:
1. WEBSITES, FULL APPS, E-COMMERCE & CANVAS PROJECTS:
   - When building runnable websites, e-commerce stores, or SaaS tools:
     * Node 1: "analysis" (Complete System Architecture, Data Schema & Component Hierarchy)
     * Node 2: "code" (100% complete, standalone interactive UI in Code Canvas - artifactLanguage: "html" or "javascript")
     * Node 3: "analysis" or "code" (Backend API Endpoints, REST Controllers & Database Models)
     * Node 4: "cmd" (Exact copy-pasteable PowerShell/CMD runner commands: npm install, run dev, django runserver, docker-compose)
2. CLI SETUP, ENVIRONMENT, GIT & DEPLOYMENT:
   - When user asks to setup, install packages, configure Git, deploy, or run terminal tasks:
     * Node 1: "cmd" (Exact, structured Windows CMD/PowerShell commands with one-click copy)
     * Node 2: "synthesis" (Verification checklist)
3. COMPLEX ARCHITECTURAL ROADMAPS & TECHNICAL STRATEGY:
   - Node 1: "analysis" (Architecture, Schema & Data Modeling)
   - Node 2: "synthesis" (Actionable Roadmap & Milestones)
4. REAL-TIME FACTUAL & RESEARCH QUERIES:
   - Node 1: "search" (Clean, noise-free search query keywords)
   - Node 2: "synthesis" (Grounded, verified fact synthesis)
5. CASUAL GREETINGS & SHORT FOLLOW-UPS:
   - Zero unnecessary nodes ("nodes": []). Instant high-speed conversational response.`;

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
    'llama-3.3-70b-versatile',
    'groq/compound-mini',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
  ];

  for (const currentModel of modelsToTry) {
    let modelExhausted = false;
    for (let i = 0; i < keysToTry.length; i++) {
      if (modelExhausted) break;
      const key = keysToTry[i];
      try {
        const isLowTpm = currentModel.includes('gpt-oss');
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
                  ? `Prior conversation history:\n${historySummary.slice(0, isLowTpm ? 2000 : 8000)}\n\nCurrent user request: "${prompt}"`
                  : `Current user request: "${prompt}"`
              }
            ],
            temperature: 0.1,
            max_tokens: isLowTpm ? 2000 : 3000
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || '';
          if (errMsg.includes('TPD') || errMsg.includes('tokens per day') || res.status === 413) {
            modelExhausted = true;
          }
          continue; // Try next key or model
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
          // Filter out any standalone synthesis nodes from tree nodes since synthesis is the final response deliverable
          plan.nodes = plan.nodes.filter(n => n.type !== 'synthesis');

          // STRICT FILTER PRIORITY: If user enabled Google Search filter
          if (forceWebSearch && !plan.needsClarification) {
            if (!plan.nodes.some(n => n.type === 'search' || /search|research/i.test(n.type))) {
              const cleanQuery = prompt.replace(/google py|google pe|search karo|dhoondo|btao/gi, '').trim() || prompt;
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
          }

          // STRICT FILTER PRIORITY: If user enabled Canvas Code filter
          if (forceCanvasCode && !plan.needsClarification) {
            if (!plan.nodes.some(n => n.type === 'code' || /code|artifact|build/i.test(n.type))) {
              const isHtml = /\b(html|css|website|dashboard|ui|ecommerce|react|store|canvas|frontend)\b/i.test(prompt);
              plan.nodes.push({
                id: 'node_forced_canvas_code',
                name: isHtml ? 'Interactive Canvas UI' : 'Canvas Code Implementation',
                type: 'code',
                task: `Generate 100% complete, standalone runnable code for: "${prompt}" into Code Canvas`,
                inputFrom: plan.nodes.map(n => n.id),
                canParallel: false,
                executionStage: plan.nodes.length + 1,
                artifactLanguage: isHtml ? 'html' : 'python',
                artifactTitle: prompt.slice(0, 36)
              });
            }
          }

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
  const isExplicitCodeRequest = /\b(code likho|script banao|html banao|program likho|write code|write script|create app|build website|implement class|write a python script|develop app|ecommerce|canvas|django|react|full-stack|node|store|shop|files)\b/i.test(lower);
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

  if (isExplicitCodeRequest) {
    const isHtml = matched.id === 'frontend-design' || /\b(html|css|website|dashboard|ui|ecommerce|react|store|canvas)\b/i.test(lower);
    
    // Stage 1: Architecture & Schema
    fallbackNodes.push({
      id: 'node_arch_spec',
      name: 'System Architecture & Schema Blueprint',
      type: 'analysis',
      task: `Architect data models, state schema, and component structure for: "${prompt}"`,
      inputFrom: [],
      canParallel: false,
      executionStage: stage++
    });

    // Stage 2: 100% Complete Interactive Code for Canvas
    fallbackNodes.push({
      id: 'node_code_impl',
      name: isHtml ? 'Modern UI/UX & Canvas Implementation' : 'Full Architecture & Code Implementation',
      type: 'code',
      task: `Generate 100% complete, production-grade functional code for: "${prompt}"`,
      inputFrom: ['node_arch_spec'],
      canParallel: false,
      executionStage: stage++,
      artifactLanguage: isHtml ? 'html' : 'python',
      artifactTitle: prompt.slice(0, 40)
    });

    // Stage 3: Local Dev Runner Commands
    fallbackNodes.push({
      id: 'node_cmd_runner',
      name: 'Local Setup & Dev Server CLI Runner',
      type: 'cmd',
      task: `Provide exact copy-pasteable PowerShell/CMD commands to initialize, run dependencies, and launch the dev server locally for "${prompt}"`,
      inputFrom: ['node_code_impl'],
      canParallel: false,
      executionStage: stage++
    });
  } else if (isSearchCommand || !looksLikeGreeting) {
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

  return {
    cannotPerform: false,
    intentCategory: isExplicitCodeRequest ? 'CODE_BUILD' : 'RESEARCH',
    thinkingSummary: `Dynamic execution graph planned with ${fallbackNodes.length} nodes.`,
    skillId: matched.id,
    nodes: fallbackNodes
  };
}

