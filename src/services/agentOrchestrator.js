/**
 * Devnexes AI — Autonomous Master Graph Planner
 * Uses Groq (qwen/qwen3.8-27b) to plan the dynamic execution DAG.
 */

import { DETAILED_SKILLS, getMatchingSkill } from '../skills/index.js';
import { callGroqChatJson, hasGroqApiKey } from './groqService.js';
import { detectOfficialBrandLogo } from './imageService.js';
import { resolveContextualSearchQuery } from './searchService.js';
import {
  detectProgrammingLanguageDynamically,
  analyzePromptIntent,
  dynamicallyFuseImagePrompt,
  cleanDynamicSearchQuery,
  hasFuzzyWord,
  isUrduOrHindi,
  resolveBrandLogoDynamically
} from '../utils/dynamicNLP.js';

const GROQ_MODEL = import.meta.env?.VITE_GROQ_MODEL || import.meta.env?.GROQ_MODEL || 'qwen/qwen3.8-27b';
const ALLOWED_NODE_TYPES = new Set(['search', 'code', 'cmd', 'analysis', 'vision', 'image']);

/**
 * Authoritative Dynamic Programming Language Detector:
 * Identifies the exact programming language requested in the prompt or present in provided code,
 * with typo tolerance, alias recognition, and syntax inspection across 40+ languages.
 */
export function detectRequestedProgrammingLanguage(prompt = '', snippet = '') {
  return detectProgrammingLanguageDynamically(prompt, snippet);
}

export function extractCodeFromMarkdown(text = '') {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/```(\w+)?\s*\n([\s\S]*?)```/);
  if (match && match[2] && match[2].trim().length > 20) {
    const lang = (match[1] || 'html').toLowerCase();
    return {
      code: match[2].trim(),
      language: lang
    };
  }
  return null;
}

/**
 * Recovers the programming code snippet previously submitted by the user or
 * diagnosed for defects by the assistant from conversation history,
 * along with its authentic language.
 */
export function findDiagnosedCodeFromHistory(messagesHistory = []) {
  if (!Array.isArray(messagesHistory) || messagesHistory.length === 0) return null;

  for (let i = messagesHistory.length - 1; i >= 0; i--) {
    const msg = messagesHistory[i];
    if (!msg) continue;

    const content = typeof msg.content === 'string' ? msg.content : '';

    // 1. Markdown code fences in content
    if (content.includes('```')) {
      const extracted = extractCodeFromMarkdown(content);
      if (extracted?.code) {
        const detectedLang = detectRequestedProgrammingLanguage('', extracted.code) ||
          detectRequestedProgrammingLanguage(content) ||
          extracted.language;
        return {
          code: extracted.code,
          language: detectedLang || 'cpp',
          isDiagnosed: msg.role === 'assistant',
          messageIndex: i
        };
      }
    }

    // 2. Raw code in message content (e.g. user pasted code without markdown backticks)
    if (
      /#include\s*[<"]|\b(using\s+namespace\s+std|int\s+main\s*\(|void\s+main\s*\(|std::cout|std::cin|cout\s*<<)\b/.test(content) ||
      /\b(def\s+\w+\s*\(|class\s+\w+:|import\s+[a-zA-Z_]|public\s+static\s+void\s+main|fn\s+main\s*\(|package\s+main)\b/.test(content)
    ) {
      const detectedLang = detectRequestedProgrammingLanguage('', content) || 'cpp';
      return {
        code: content.trim(),
        language: detectedLang,
        isDiagnosed: msg.role === 'assistant',
        messageIndex: i
      };
    }

    // 3. Trace steps in assistant messages
    if (msg.traceData?.steps && Array.isArray(msg.traceData.steps)) {
      for (let j = msg.traceData.steps.length - 1; j >= 0; j--) {
        const s = msg.traceData.steps[j];
        if (s?.code && typeof s.code === 'string' && s.code.trim().length > 20) {
          const detectedLang = detectRequestedProgrammingLanguage('', s.code) || s.language;
          return {
            code: s.code.trim(),
            language: detectedLang || 'cpp',
            isDiagnosed: true,
            messageIndex: i
          };
        }
      }
    }
  }

  return null;
}

/**
 * Authoritative Dynamic Code Intent Disambiguation Engine:
 * Accurately determines whether a user wants to:
 * 1. Surgically modify their existing code (intent: 'UPDATE_EXISTING_CODE', isIncrementalEdit: true)
 * 2. Fix code diagnosed in previous turns (intent: 'CODE_FIX', isIncrementalEdit: false)
 * 3. Build a brand-new project/topic (intent: 'NEW_CODE', isIncrementalEdit: false)
 * 4. General non-code question or search (intent: 'NON_CODE', isCode: false)
 */
export function detectCodeIntent({
  prompt = '',
  hasExistingArtifact = false,
  hasImage = false,
  latestArtifact = null,
  forceCanvasCode = false,
  messagesHistory = []
}) {
  const currentLang = detectRequestedProgrammingLanguage(prompt);
  const existingLang = latestArtifact?.language ? String(latestArtifact.language).toLowerCase() : null;

  // 0. Dedicated Follow-up Code Fix / Defect Correction Handling (pure dynamic context inspection)
  const diagnosed = findDiagnosedCodeFromHistory(messagesHistory);
  if (diagnosed && (currentLang || String(prompt).trim().length < 35 || !prompt.includes('?'))) {
    const fixLang = currentLang || diagnosed.language || 'cpp';
    const isTrueIncremental = Boolean(
      existingLang &&
      existingLang === fixLang &&
      latestArtifact?.code &&
      diagnosed.code &&
      latestArtifact.code.includes(diagnosed.code.slice(0, 30))
    );

    return {
      isCode: true,
      isIncrementalEdit: isTrueIncremental,
      intent: isTrueIncremental ? 'UPDATE_EXISTING_CODE' : 'CODE_FIX',
      targetLanguage: fixLang,
      diagnosedCode: diagnosed
    };
  }

  // 1. Dynamic Universal Intent Analysis (analyzes verbs, targets, language switch, typo tolerance)
  const analyzed = analyzePromptIntent({
    prompt,
    hasExistingArtifact,
    latestArtifact,
    hasImage,
    forceCanvasCode
  });

  if (analyzed.intent === 'NON_CODE') {
    return {
      isCode: false,
      isIncrementalEdit: false,
      intent: 'NON_CODE'
    };
  }

  return analyzed;
}

// A model is allowed to choose the work it needs, but its JSON must still be
// treated as untrusted input. This prevents broken DAGs, duplicate IDs and a
// small model accidentally producing an unbounded execution plan.
function normalizePlan(rawPlan, { forceWebSearch, forceCanvasCode, userPrompt = '', hasExistingArtifact = false, latestArtifactLang = 'html', messagesHistory = [] }) {
  const plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
  const cleanPrompt = String(userPrompt || '').toLowerCase().trim();

  // Evaluate authoritative code intent
  const codeIntent = detectCodeIntent({
    prompt: userPrompt,
    hasExistingArtifact,
    hasImage: false,
    latestArtifact: { language: latestArtifactLang },
    forceCanvasCode,
    messagesHistory
  });
  const isChangeOrModifyIntent = codeIntent.isIncrementalEdit && codeIntent.intent !== 'CODE_FIX';

  // Dynamic substance check: If user prompt has 2+ words or substance, never ask clarification
  const hasSubstance = cleanPrompt.length > 5 || cleanPrompt.split(/\s+/).length >= 2;
  const allowClarification = Boolean(plan.needsClarification) && !hasSubstance;
  const clarificationData = allowClarification && plan.clarification && typeof plan.clarification.question === 'string' ? {
    question: plan.clarification.question.slice(0, 280),
    options: Array.isArray(plan.clarification.options) ? plan.clarification.options.slice(0, 4).map(String) : []
  } : null;

  const seenIds = new Set();
  const nodes = (Array.isArray(plan.nodes) ? plan.nodes : [])
    .slice(0, 6)
    .map((node, index) => {
      const type = ALLOWED_NODE_TYPES.has(node?.type) ? node.type : 'analysis';
      const idBase = String(node?.id || `node_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || `node_${index + 1}`;
      const id = seenIds.has(idBase) ? `${idBase}_${index + 1}` : idBase;
      seenIds.add(id);
      return {
        id,
        name: String(node?.name || `${type} step`).slice(0, 90),
        type,
        task: String(node?.task || 'Complete the required task accurately.').slice(0, 900),
        inputFrom: Array.isArray(node?.inputFrom) ? node.inputFrom.filter(dep => typeof dep === 'string' && dep !== id) : [],
        canParallel: Boolean(node?.canParallel),
        executionStage: Math.max(1, Math.min(6, Number.parseInt(node?.executionStage, 10) || index + 1)),
        searchQuery: typeof node?.searchQuery === 'string' ? node.searchQuery.slice(0, 240) : null,
        imagePrompt: typeof node?.imagePrompt === 'string' ? node.imagePrompt.slice(0, 500) : null,
        artifactLanguage: typeof node?.artifactLanguage === 'string' ? node.artifactLanguage.slice(0, 30) : null,
        artifactTitle: typeof node?.artifactTitle === 'string' ? node.artifactTitle.slice(0, 90) : null
      };
    });

  const ids = new Set(nodes.map(node => node.id));
  nodes.forEach((node, index) => {
    // Enforce sequential pipeline chain: if inputFrom is empty and not first node, link to predecessor
    if (index > 0 && (!node.inputFrom || node.inputFrom.length === 0)) {
      node.inputFrom = [nodes[index - 1].id];
    }
    node.inputFrom = (node.inputFrom || []).filter(id => ids.has(id));

    // A dependency must have completed in an earlier stage
    const dependencyStages = node.inputFrom.map(id => nodes.find(item => item.id === id)?.executionStage || 1);
    if (dependencyStages.length) {
      node.executionStage = Math.max(index + 1, ...dependencyStages.map(stage => stage + 1));
    } else {
      node.executionStage = index + 1;
    }
  });

  if (forceWebSearch && !nodes.some(node => node.type === 'search')) {
    const webNode = { id: 'node_web_grounding', name: 'Live web grounding', type: 'search', task: 'Find current, trustworthy sources for the request.', inputFrom: [], canParallel: false, executionStage: 1, searchQuery: null, artifactLanguage: null, artifactTitle: null };
    nodes.unshift(webNode);
    // Re-link subsequent node to webNode
    if (nodes[1]) {
      nodes[1].inputFrom = [webNode.id];
      nodes.forEach((n, idx) => { n.executionStage = idx + 1; });
    }
  }
  if (forceCanvasCode && !nodes.some(node => node.type === 'code')) {
    const lastNode = nodes[nodes.length - 1];
    nodes.push({ id: 'node_canvas_implementation', name: 'Canvas implementation', type: 'code', task: 'Create a complete runnable implementation for the user request.', inputFrom: lastNode ? [lastNode.id] : [], canParallel: false, executionStage: nodes.length + 1, searchQuery: null, artifactLanguage: 'html', artifactTitle: 'Generated artifact' });
  }

  // Dynamic Detection of Code / Search Request purely from structural cues
  const isSearchIntent = forceWebSearch || cleanPrompt.startsWith('/search');
  const detectedLangInPrompt = detectProgrammingLanguageDynamically(cleanPrompt);
  const isAnyCodeRequest = !isSearchIntent && (forceCanvasCode || Boolean(detectedLangInPrompt) || cleanPrompt.includes('```') || cleanPrompt.startsWith('/code'));

  // Pure non-code questions or search requests
  const isPureNonCodeQuestion = !isAnyCodeRequest && (
    cleanPrompt.endsWith('?') ||
    isSearchIntent
  );

  // If this is a search request or pure non-code question, strip hallucinated code nodes!
  if ((isSearchIntent || isPureNonCodeQuestion) && !forceCanvasCode && !detectedLangInPrompt && !cleanPrompt.includes('```')) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].type === 'code' || (nodes[i].type === 'analysis' && /\b(code|implementation|canvas|blueprint)\b/i.test(nodes[i].name || ''))) {
        nodes.splice(i, 1);
      }
    }
  }

  // If user asked to search, ensure a web search node is present
  if (isSearchIntent && !forceCanvasCode && !nodes.some(n => n.type === 'search')) {
    const cleanSearchQuery = cleanDynamicSearchQuery(cleanPrompt);
    nodes.unshift({
      id: 'node_web_search',
      name: 'Search web',
      type: 'search',
      task: `Perform live web search for verified facts on: "${cleanSearchQuery || cleanPrompt}"`,
      searchQuery: cleanSearchQuery || cleanPrompt,
      canParallel: false,
      executionStage: 1
    });
  }

  // If existing artifact is present and user asks to change or modify code, enforce strict incremental preservation on all code nodes
  if (hasExistingArtifact && isChangeOrModifyIntent && codeIntent.intent !== 'CODE_FIX') {
    nodes.forEach(node => {
      if (node.type === 'code') {
        node.name = 'Update code in Canvas';
        node.task = `Modify the existing ${latestArtifactLang} code for: "${userPrompt}". STRICTLY PRESERVE 100% of all existing components, styling, logic, content, and features, applying only the requested changes directly inside the existing code.`;
        node.artifactLanguage = latestArtifactLang;
      } else if (node.type === 'analysis' && /plan|architecture|design|wireframe|spec|layout/i.test(node.name || '')) {
        node.name = 'Plan code update';
        node.task = `Formulate the exact integration steps to apply "${userPrompt}" into the existing ${latestArtifactLang} code without breaking existing structure.`;
      }
    });
  }

  // If this is a CODE_FIX, strictly configure code nodes with the target language and diagnosed snippet
  if (codeIntent.intent === 'CODE_FIX' && codeIntent.targetLanguage) {
    const fixLang = codeIntent.targetLanguage;
    nodes.forEach(node => {
      if (node.type === 'code') {
        node.name = `Correct ${fixLang.toUpperCase()} code`;
        node.task = `Generate 100% complete, corrected, working ${fixLang.toUpperCase()} code fixing all errors in: \n\n${codeIntent.diagnosedCode ? `Original Code:\n\`\`\`${fixLang}\n${codeIntent.diagnosedCode.code}\n\`\`\`` : userPrompt}`;
        node.artifactLanguage = fixLang;
        node.artifactTitle = `Corrected ${fixLang.toUpperCase()} Code`;
      }
    });
  }

  // Auto-recovery / Guarantee: If user asked for code, ensure a Google Gemini code node ALWAYS exists!
  if (!clarificationData && (isAnyCodeRequest || (hasExistingArtifact && isChangeOrModifyIntent)) && !nodes.some(n => n.type === 'code')) {
    if (hasExistingArtifact && isChangeOrModifyIntent && codeIntent.intent !== 'CODE_FIX') {
      nodes.push({
        id: 'node_arch_spec',
        name: 'Plan code update',
        type: 'analysis',
        task: `Formulate the exact integration steps to apply "${userPrompt}" into the existing ${latestArtifactLang} code without breaking existing structure.`,
        inputFrom: nodes.length ? [nodes[nodes.length - 1].id] : [],
        canParallel: false,
        executionStage: nodes.length + 1
      });
      nodes.push({
        id: 'node_canvas_implementation',
        name: 'Update code in Canvas',
        type: 'code',
        task: `Modify the existing ${latestArtifactLang} code for: "${userPrompt}". STRICTLY PRESERVE 100% of all existing components, styling, logic, content, and features, applying only the requested changes directly inside the existing code.`,
        inputFrom: ['node_arch_spec'],
        canParallel: false,
        executionStage: nodes.length + 2,
        artifactLanguage: latestArtifactLang,
        artifactTitle: (userPrompt || 'Updated Code').slice(0, 36)
      });
    } else {
      const detectedLang = codeIntent.targetLanguage || detectRequestedProgrammingLanguage(cleanPrompt);
      const isSubstantial = forceCanvasCode || /\b(website|site|app|portfolio|ecommerce|landing|dashboard|store|game|project)\b/i.test(cleanPrompt);
      const isHtmlIntent = /\b(html|css|frontend|ui|website|landing page|portfolio site)\b/i.test(cleanPrompt);
      const targetLang = detectedLang || (isHtmlIntent ? 'html' : (isSubstantial ? 'python' : 'python'));
      const isHtml = targetLang === 'html';

      if (isSubstantial) {
        nodes.push({
          id: 'node_arch_spec',
          name: isHtml ? 'Plan layout & design' : `Plan ${targetLang.toUpperCase()} architecture`,
          type: 'analysis',
          task: `Plan modern, fully optimized ${isHtml ? 'Web Canvas' : `${targetLang.toUpperCase()} Application`} architecture for: "${userPrompt}"`,
          inputFrom: [],
          canParallel: false,
          executionStage: 1
        });
        nodes.push({
          id: 'node_canvas_implementation',
          name: isHtml ? 'Build website in Canvas' : `Write ${targetLang.toUpperCase()} code`,
          type: 'code',
          task: `Generate 100% complete, standalone runnable ${targetLang.toUpperCase()} code for: "${userPrompt}" into Code Canvas`,
          inputFrom: ['node_arch_spec'],
          canParallel: false,
          executionStage: 2,
          artifactLanguage: targetLang,
          artifactTitle: (userPrompt || `${targetLang.toUpperCase()} Code`).slice(0, 36)
        });
      } else {
        // Direct, clean snippet generation by Gemini!
        nodes.push({
          id: 'node_code_snippet',
          name: `Generate ${targetLang.toUpperCase()} snippet`,
          type: 'code',
          task: `Generate concise, accurate, idiomatic ${targetLang.toUpperCase()} code for: "${userPrompt}". Focus on clean, efficient code.`,
          inputFrom: nodes.length ? [nodes[nodes.length - 1].id] : [],
          canParallel: false,
          executionStage: nodes.length + 1,
          artifactLanguage: targetLang,
          artifactTitle: (userPrompt || `${targetLang.toUpperCase()} snippet`).slice(0, 36)
        });
      }
    }
  }

  return {
    needsClarification: Boolean(clarificationData),
    clarification: clarificationData,
    cannotPerform: false,
    intentCategory: String(plan.intentCategory || (nodes.length ? 'ANALYSIS' : 'CONVERSATION')),
    thinkingSummary: String(plan.thinkingSummary || 'Execution path planned.').slice(0, 2000),
    executionPlanSummary: String(plan.executionPlanSummary || '').slice(0, 1000),
    doneStateCriteria: String(plan.doneStateCriteria || '').slice(0, 800),
    skillId: Object.hasOwn(DETAILED_SKILLS, plan.skillId) ? plan.skillId : 'web-research-analyst',
    nodes
  };
}

export function getLatestCodeArtifact(messagesHistory = [], activeCanvasCode = null, activeCanvasLang = null) {
  // 1. Iterate backwards through conversation history FIRST
  // Strictly isolates code generated in THIS conversation from previous projects
  if (messagesHistory && Array.isArray(messagesHistory) && messagesHistory.length > 0) {
    for (let i = messagesHistory.length - 1; i >= 0; i--) {
      const m = messagesHistory[i];
      if (!m) continue;

      // 1a. Check traceData.steps
      if (m.traceData?.steps && Array.isArray(m.traceData.steps)) {
        for (let j = m.traceData.steps.length - 1; j >= 0; j--) {
          const s = m.traceData.steps[j];
          if (s?.code && typeof s.code === 'string' && s.code.trim().length > 25) {
            return {
              code: s.code.trim(),
              language: s.language || 'html',
              title: s.title || s.name || 'Existing Code',
              messageIndex: i + 1
            };
          }
          if (s?.content && typeof s.content === 'string' && s.content.includes('```')) {
            const extracted = extractCodeFromMarkdown(s.content);
            if (extracted?.code && extracted.code.length > 25) {
              return {
                code: extracted.code,
                language: extracted.language || s.language || 'html',
                title: s.title || s.name || 'Existing Code',
                messageIndex: i + 1
              };
            }
          }
        }
      }

      // 1b. Check m.artifact
      if (m.artifact?.code && typeof m.artifact.code === 'string' && m.artifact.code.trim().length > 25) {
        return {
          code: m.artifact.code.trim(),
          language: m.artifact.language || 'html',
          title: m.artifact.title || 'Existing Artifact',
          messageIndex: i + 1
        };
      }

      // 1c. Check m.content for markdown code blocks (e.g. ```html ... ``` or ```python ... ```)
      if (m.content && typeof m.content === 'string' && m.content.includes('```')) {
        const extracted = extractCodeFromMarkdown(m.content);
        if (extracted?.code && extracted.code.length > 25) {
          return {
            code: extracted.code,
            language: extracted.language || 'html',
            title: 'Existing Code',
            messageIndex: i + 1
          };
        }
      }
    }
  }

  // 2. Direct active Canvas code passed in
  if (activeCanvasCode && typeof activeCanvasCode === 'string' && activeCanvasCode.trim().length > 25) {
    return {
      code: activeCanvasCode.trim(),
      language: activeCanvasLang || 'html',
      title: 'Current Code Canvas',
      messageIndex: messagesHistory ? messagesHistory.length : 0
    };
  }

  // 3. Fallback to localStorage cache ONLY if conversation history is empty
  if (!messagesHistory || messagesHistory.length === 0) {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('devnexes_canvas_code') || localStorage.getItem('devnexes_ide_code');
        if (saved && saved.trim().length > 25) {
          const lang = localStorage.getItem('devnexes_canvas_language') || localStorage.getItem('devnexes_ide_language') || 'html';
          return {
            code: saved.trim(),
            language: lang,
            title: 'Saved Canvas Code',
            messageIndex: 0
          };
        }
      }
    } catch { }
  }

  return null;
}

export function formatConversationHistoryWithIndices(messagesHistory = []) {
  if (!messagesHistory || messagesHistory.length === 0) return '';
  return messagesHistory.map((m, idx) => {
    const msgNum = idx + 1;
    const role = m.role === 'user' ? 'User' : 'Assistant';
    if (m.role === 'user') {
      const cleanContent = String(m.content || '')
        .replace(/data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]{40,}/g, '[Attached Image]')
        .slice(0, 300);
      return `[Message #${msgNum} (${role})]: ${cleanContent}`;
    }
    const art = m.traceData?.steps?.find(s => (s.type === 'code' || s.type === 'artifact') && s.code) || m.artifact;
    const artNote = art ? `(Generated ${art.language || 'code'} artifact: "${art.title || art.name || 'Artifact'}" — ${art.code ? art.code.split('\n').length : 0} lines)\n` : '';
    const rawResp = m.content || m.traceData?.steps?.find(s => s.type === 'response')?.content || '';
    const cleanResp = String(rawResp)
      .replace(/```[\s\S]*?```/g, '[Generated Code Canvas]')
      .replace(/data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]{40,}/g, '[Image]')
      .slice(0, 300);
    return `[Message #${msgNum} (${role})]: ${artNote}${cleanResp}`;
  }).join('\n\n');
}

function safeExtractJson(text) {
  if (!text) return null;
  const str = text.trim();
  try { return JSON.parse(str); } catch { }

  const cleaned = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch { }

  const firstCurly = cleaned.indexOf('{');
  const lastCurly = cleaned.lastIndexOf('}');
  if (firstCurly !== -1 && lastCurly > firstCurly) {
    try { return JSON.parse(cleaned.substring(firstCurly, lastCurly + 1)); } catch { }
    try {
      const sanitized = cleaned.substring(firstCurly, lastCurly + 1)
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      return JSON.parse(sanitized);
    } catch { }
  }
  return null;
}

/**
 * Scans conversation history for the latest generated visual asset to support continuous structure modification
 */
export function getLatestImageFromHistory(messagesHistory = []) {
  if (!Array.isArray(messagesHistory)) return null;
  for (let i = messagesHistory.length - 1; i >= 0; i--) {
    const msg = messagesHistory[i];
    const steps = msg?.traceData?.steps || [];
    for (let j = steps.length - 1; j >= 0; j--) {
      const step = steps[j];
      if (step?.imageResult?.url) {
        return step.imageResult;
      }
    }
    if (msg?.image && typeof msg.image === 'string' && msg.image.startsWith('data:image/')) {
      return {
        url: msg.image,
        prompt: msg.content || '',
        originalPrompt: msg.content || '',
        seed: null,
        width: 1024,
        height: 1024
      };
    }
  }
  return null;
}

/**
 * Fuses an existing image's structural prompt with the user's targeted modification request dynamically.
 * Seamlessly preserves composition while applying modifications for ANY subject, ANY color, and ANY environment.
 */
export function fuseImageModificationPrompt(prevPrompt = '', userPrompt = '') {
  return dynamicallyFuseImagePrompt(prevPrompt, userPrompt);
}

export function buildImageGenerationDAG(prompt, messagesHistory = [], skillId = 'web-research-analyst') {
  let cleanImagePrompt = '';
  const lower = String(prompt || '').toLowerCase().trim();

  // 1. Check if user is asking to modify an existing visual in conversation dynamically
  const latestImage = getLatestImageFromHistory(messagesHistory);
  const hasPreviousImage = Boolean(latestImage && (latestImage.url || latestImage.prompt));

  const isImageModificationRequest = hasPreviousImage && (
    lower.length < 35 ||
    /\b(is|isko|iski|iska|isme|is me|it|this|that|change|modify|update|add|replace)\b/i.test(lower)
  );

  if (isImageModificationRequest && latestImage) {
    const prevPrompt = latestImage.prompt || latestImage.originalPrompt || '';
    cleanImagePrompt = dynamicallyFuseImagePrompt(prevPrompt, prompt);

    return {
      needsClarification: false,
      cannotPerform: false,
      cannotPerformReason: null,
      intentCategory: 'IMAGE_GENERATION',
      thinkingSummary: `Preserving image structure & seed (${latestImage.seed || 'consistent'}). Updating visual: "${prompt}".`,
      executionPlanSummary: 'Visual Modification (Structure Preserved)',
      doneStateCriteria: 'Modified visual ready',
      skillId,
      nodes: [
        {
          id: 'node_sd_generation',
          name: 'Update image',
          type: 'image',
          task: `Update existing visual while preserving camera angle, structure, and seed: "${cleanImagePrompt}"`,
          inputFrom: [],
          canParallel: false,
          executionStage: 1,
          imagePrompt: cleanImagePrompt,
          seed: latestImage.seed || null,
          initImage: latestImage.url || null,
          isModification: true
        }
      ]
    };
  }

  const isReferencingPreviousVisual = /\b(similar|same|copy|recreate|previous)\b/i.test(lower);

  // 2. If user is asking for a similar image to an attached or previously analyzed visual:
  if (isReferencingPreviousVisual && messagesHistory && messagesHistory.length > 0) {
    for (let i = messagesHistory.length - 1; i >= 0; i--) {
      const msg = messagesHistory[i];
      const content = msg?.content || '';

      const promptMatch = content.match(/Prompt for Image Generation:\s*["“]([^"”]+)["”]/i) ||
        content.match(/["“](High-resolution[^"”]+)["”]/i) ||
        content.match(/["“]([A-Z][^"”]{35,350})["”]/);
      if (promptMatch && promptMatch[1]?.trim()) {
        cleanImagePrompt = promptMatch[1].trim();
        break;
      }

      if (msg.image || content.includes('footage') || content.includes('visual') || content.includes('camera')) {
        const sentences = content.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 25 && !s.startsWith('#'));
        if (sentences.length > 0) {
          cleanImagePrompt = sentences.slice(0, 2).join(', ');
          break;
        }
      }
    }
  }

  // 3. Clean user prompt dynamically if cleanImagePrompt not resolved yet
  if (!cleanImagePrompt) {
    cleanImagePrompt = prompt
      .replace(/^\/[a-zA-Z0-9_-]+\s*/, '')
      .replace(/^["']|["']$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 4. If prompt is very short or generic (e.g. "similar one", "another one"), inspect recent messages
  if (!cleanImagePrompt || cleanImagePrompt.length < 3) {
    const prevItems = (messagesHistory || []).slice(-4);
    for (let i = prevItems.length - 1; i >= 0; i--) {
      const item = prevItems[i];
      const txt = item?.content || '';
      if (txt.length >= 4) {
        cleanImagePrompt = txt.slice(0, 200);
        break;
      }
    }
  }

  if (!cleanImagePrompt || cleanImagePrompt.length < 2) {
    cleanImagePrompt = prompt;
  }

  const isLogo = /\b(logo|icon|emblem|symbol|badge|vector)\b/i.test(lower) ||
    /\b(logo|icon|emblem|symbol|badge|vector)\b/i.test(cleanImagePrompt);

  if (isLogo && !cleanImagePrompt.toLowerCase().includes('logo')) {
    cleanImagePrompt = `${cleanImagePrompt} logo`;
  }

  return {
    needsClarification: false,
    cannotPerform: false,
    cannotPerformReason: null,
    intentCategory: 'IMAGE_GENERATION',
    thinkingSummary: `Generating visual for: "${cleanImagePrompt}".`,
    executionPlanSummary: 'Visual Synthesis',
    doneStateCriteria: 'Visual ready',
    skillId,
    nodes: [
      {
        id: 'node_sd_generation',
        name: 'Generate image',
        type: 'image',
        task: `Synthesize high-fidelity visual artwork for: "${cleanImagePrompt}"`,
        inputFrom: [],
        canParallel: false,
        executionStage: 1,
        imagePrompt: cleanImagePrompt
      }
    ]
  };
}

/**
 * Detects whether a user prompt contains a compound multi-intent request
 * (e.g. Image Generation AND Writing a document/letter/sick leave, Code Canvas, or Web Search).
 */
export function detectCompoundMultiIntent(prompt = '') {
  if (!prompt || typeof prompt !== 'string') {
    return { isCompound: false };
  }
  const clean = prompt.trim();
  const lower = clean.toLowerCase();

  const hasConjunction = /\b(and|aur|plus|&|ke sath|sath me|sath sath)\b/i.test(lower) || lower.includes(',');
  const hasImageCommand = lower.startsWith('/image') || lower.startsWith('/draw');
  const hasImageTerm = hasImageCommand || /\b(image|photo|pic|picture|tasveer|wallpaper|artwork|drawing|logo)\b/i.test(lower);

  if (!hasImageTerm || !hasConjunction) {
    return { isCompound: false };
  }

  const parts = clean.split(/\b(?:and|aur|plus|&|ke sath|sath me|sath sath|,)\b/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { isCompound: false };
  }

  let visualSubject = '';
  let otherTasksExist = false;

  for (const part of parts) {
    if (/\b(image|photo|pic|picture|tasveer|wallpaper|artwork|logo)\b/i.test(part) || part.startsWith('/image')) {
      visualSubject = part
        .replace(/^\/[a-zA-Z0-9_-]+\s*/, '')
        .replace(/\b(image|photo|pic|picture|tasveer|wallpaper|artwork|logo|ki|ka|ke|of|an?)\b/gi, '')
        .trim();
    } else if (part.length > 2) {
      otherTasksExist = true;
    }
  }

  if (!otherTasksExist) {
    return { isCompound: false };
  }

  const detectedLang = detectProgrammingLanguageDynamically(clean);
  const hasCodeTask = Boolean(detectedLang || clean.includes('```') || clean.startsWith('/code'));
  const hasSearchTask = clean.startsWith('/search');

  return {
    isCompound: true,
    hasImageTask: true,
    hasWritingTask: !hasCodeTask && !hasSearchTask,
    hasWritingNouns: true,
    hasCodeTask,
    hasSearchTask,
    hasExplanationTask: clean.endsWith('?'),
    visualSubject: visualSubject || 'visual art',
    rawPrompt: clean
  };
}

/**
 * Builds a dynamic multi-stage DAG for compound tasks
 * (e.g. Image Generation + Document/Sick Leave Writing, Code Canvas, or Web Search).
 */
export function buildCompoundExecutionDAG({
  prompt,
  compoundIntent,
  messagesHistory: _messagesHistory = [],
  skillId = 'web-research-analyst'
}) {
  const nodes = [];
  let currentStage = 1;

  // 1. Search Node (if requested)
  if (compoundIntent.hasSearchTask) {
    nodes.push({
      id: 'node_search',
      name: 'Search verified facts',
      type: 'search',
      task: `Execute web search for: "${prompt}"`,
      inputFrom: [],
      canParallel: false,
      executionStage: currentStage,
      searchQuery: prompt
    });
    currentStage++;
  }

  // 2. Image Node (always included in compound image requests)
  const imagePrompt = compoundIntent.visualSubject || 'cinematic visual art';
  nodes.push({
    id: 'node_sd_generation',
    name: `Generate ${compoundIntent.visualSubject || 'visual'} image`,
    type: 'image',
    task: `Synthesize high-fidelity visual artwork for: "${imagePrompt}"`,
    inputFrom: compoundIntent.hasSearchTask ? ['node_search'] : [],
    canParallel: true,
    executionStage: currentStage,
    imagePrompt
  });

  // 3. Code Node (if requested)
  if (compoundIntent.hasCodeTask) {
    nodes.push({
      id: 'node_code',
      name: 'Build code in Canvas',
      type: 'code',
      task: `Generate complete, interactive production code into Canvas for: "${prompt}"`,
      inputFrom: compoundIntent.hasSearchTask ? ['node_search'] : [],
      canParallel: false,
      executionStage: currentStage,
      artifactLanguage: 'html',
      artifactTitle: 'Application Code'
    });
  }

  // 4. Writing / Document Composition Node
  if (compoundIntent.hasWritingTask || compoundIntent.hasExplanationTask) {
    nodes.push({
      id: 'node_composition',
      name: 'Draft response',
      type: 'analysis',
      task: `Draft the complete, professional written deliverable for: "${prompt}" with high-grade formatting`,
      inputFrom: ['node_sd_generation'],
      canParallel: false,
      executionStage: currentStage + 1
    });
  }

  return {
    needsClarification: false,
    cannotPerform: false,
    cannotPerformReason: null,
    intentCategory: 'COMPOUND_MULTI_INTENT',
    thinkingSummary: `Compound multi-task pipeline planned: Visual synthesis for "${imagePrompt}" alongside full document composition and synthesis.`,
    executionPlanSummary: 'Stage 1: Image Generation -> Stage 2: Composition & Final Delivery',
    doneStateCriteria: 'All requested deliverables (visual asset and written document/code) synthesized successfully.',
    skillId,
    nodes
  };
}

/**
 * Classifies whether a prompt is a general non-image task (code, essay/letter, math, question, web search)
 * Zero predefined keyword catalogs.
 */
export function isGeneralNonImagePrompt(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return false;
  const clean = prompt.toLowerCase().trim();

  // If prompt explicitly asks for an image, drawing, or photo command
  if (
    clean.startsWith('/image') ||
    clean.startsWith('/draw') ||
    clean.startsWith('/sd')
  ) {
    return false;
  }

  // If prompt explicitly starts with search or code command
  if (clean.startsWith('/search') || clean.startsWith('/code') || clean.endsWith('?')) {
    return true;
  }

  const hasVisualTerm = /\b(image|photo|pic|picture|tasveer|wallpaper|artwork|avatar|logo|drawing)\b/i.test(clean);
  if (hasVisualTerm) return false;

  return true;
}

export async function planDynamicExecutionGraph({
  prompt,
  image,
  model = GROQ_MODEL,
  messagesHistory = [],
  forceWebSearch = false,
  forceCanvasCode = false,
  isFromImageStudio = false,
  activeCanvasCode = null,
  activeCanvasLanguage = null,
  signal
}) {
  const allSkillIds = Object.keys(DETAILED_SKILLS).join(' | ');
  const hasImage = !!image;
  const lower = prompt.toLowerCase().trim();
  const matched = getMatchingSkill(prompt);
  const latestArt = getLatestCodeArtifact(messagesHistory, activeCanvasCode, activeCanvasLanguage);
  const hasExistingArtifact = Boolean(latestArt?.code);

  // ── 0. COMPOUND MULTI-TASK DAG (e.g. "sunset ki image and sick leave likh ky do") ──
  const compoundIntent = detectCompoundMultiIntent(prompt);
  if (compoundIntent.isCompound) {
    return buildCompoundExecutionDAG({
      prompt,
      compoundIntent,
      messagesHistory,
      skillId: matched.id
    });
  }

  // If prompt originated from AI Image Studio:
  // "usy pta ho ab images vala section ma gai ha to ab image hi ka kam ha"
  // Unless it's explicitly a general non-image task, execute direct visual synthesis DAG!
  if (isFromImageStudio && !isGeneralNonImagePrompt(prompt)) {
    return buildImageGenerationDAG(prompt, messagesHistory);
  }

  const codeIntent = detectCodeIntent({
    prompt,
    hasExistingArtifact,
    hasImage,
    latestArtifact: latestArt,
    forceCanvasCode,
    messagesHistory
  });
  const isChangeOrModifyIntent = codeIntent.isIncrementalEdit;

  // ── 0b. DEDICATED CODE FIX EXECUTION DAG ──
  // If the user is asking to correct/fix code diagnosed in conversation,
  // execute direct, authoritative code generation in the diagnosed language!
  // Prevents Groq planner from hallucinating HTML/CSS or modifying unrelated artifacts.
  if (codeIntent.intent === 'CODE_FIX' && codeIntent.diagnosedCode) {
    const fixLang = codeIntent.targetLanguage || 'cpp';
    const langUpper = fixLang.toUpperCase();
    const originalSnippet = codeIntent.diagnosedCode.code;

    return {
      needsClarification: false,
      clarification: null,
      cannotPerform: false,
      cannotPerformReason: null,
      intentCategory: 'CODE_BUILD',
      thinkingSummary: `Correcting diagnosed ${langUpper} code syntax and defects. Opening 100% complete, working ${langUpper} implementation in Code Canvas.`,
      executionPlanSummary: `Stage 1: Correct ${langUpper} Implementation`,
      doneStateCriteria: `100% complete, corrected, working ${langUpper} code delivered in Code Canvas.`,
      skillId: 'coding-ide',
      nodes: [
        {
          id: 'node_code_fix',
          name: `Correct ${langUpper} code`,
          type: 'code',
          task: `Generate 100% complete, corrected, working ${langUpper} code resolving all errors in the provided code.\n\nOriginal ${langUpper} Code:\n\`\`\`${fixLang}\n${originalSnippet}\n\`\`\`\n\nRequirements: "${prompt}"`,
          inputFrom: [],
          canParallel: false,
          executionStage: 1,
          artifactLanguage: fixLang,
          artifactTitle: `Corrected ${langUpper} Code`
        }
      ]
    };
  }

  // If user attached an image to integrate into existing code (e.g. "ya add karoo portfolio ma", "ye add karo"),
  // return a 3-stage pipeline: inspect image asset -> plan integration -> update existing code in Canvas!
  if (hasImage && hasExistingArtifact && isChangeOrModifyIntent) {
    return {
      cannotPerform: false,
      intentCategory: 'CODE_BUILD',
      thinkingSummary: `Visual asset uploaded to integrate into existing ${latestArt.language} artifact. Inspecting visual elements and updating Code Canvas.`,
      executionPlanSummary: 'Stage 1: Visual Asset Inspection -> Stage 2: Plan Code Integration -> Stage 3: Canvas Implementation',
      doneStateCriteria: 'Existing code updated in Canvas with visual asset integrated.',
      skillId: 'frontend-design',
      nodes: [
        {
          id: 'node_vision',
          name: 'Visual asset inspection',
          type: 'vision',
          task: 'Perform detailed visual inspection and extract key aesthetic/content attributes of the uploaded image for code integration.',
          inputFrom: [],
          canParallel: false,
          executionStage: 1
        },
        {
          id: 'node_arch_spec',
          name: 'Plan code update',
          type: 'analysis',
          task: `Formulate the exact integration steps to incorporate the uploaded image/asset into the existing ${latestArt.language} code without breaking existing structure.`,
          inputFrom: ['node_vision'],
          canParallel: false,
          executionStage: 2
        },
        {
          id: 'node_code_impl',
          name: 'Update code in Canvas',
          type: 'code',
          task: `Update the existing ${latestArt.language} code to fulfill: "${prompt}". STRICTLY PRESERVE 100% of all existing components, styling, logic, content, and features, applying only the requested changes directly inside the existing code.`,
          inputFrom: ['node_arch_spec'],
          canParallel: false,
          executionStage: 3,
          artifactLanguage: latestArt.language || 'html',
          artifactTitle: latestArt.title || 'Updated Portfolio'
        }
      ]
    };
  }

  // ── Deterministic Intent Disambiguation ─────────────────────────
  const isExplicitSearchIntent = (
    /\b(search|google|dhoondo|dhundo|pata karo|find|lookup|look up|research|real tme|real-time|real time|koun hai|kon hai|who is|what is|kya hai|details|facts?|information|profile|company|solutions|website|site|url)\b/i.test(lower) ||
    /\b(search karo|search karein|dhoond kar|dhund kar|check karo|verify karo|internet se|internet sy)\b/i.test(lower)
  );

  const isQuestionOrInquiry =
    /\b(kya|kon|kaun|kis|kahan|kyun|kab|kese|kaise|what|who|where|when|why|how|explain|batao|batayein|btao|tell me|meaning|define|info|details|about|help|difference|summary)\b/i.test(lower) ||
    lower.endsWith('?') ||
    /^(devnexes|kya|what|who|tell|explain|hi|hello|salam)\b/i.test(lower);

  const recentConversation = (messagesHistory || [])
    .slice(-4)
    .map(m => m.content?.toLowerCase() || '')
    .join(' ');
  const hasPreviousAttachedImage = (messagesHistory || []).some(m => m.image);

  const isLogoPrompt = /\b(logo|icon|emblem|symbol|brand mark|badge|avatar)\b/i.test(lower);
  const isVisualNoun = /\b(image|photo|pic|picture|tasveer|wallpaper|artwork|avatar|icon|logo|drawing|scene|view|visual)\b/i.test(lower);
  const isGenerationVerb = /\b(generate|banao|bana do|make|create|draw|render|dikhao|dikhayein|chahiye|de do|recreate|paint|synthesize)\b/i.test(lower);

  const officialBrand = detectOfficialBrandLogo(lower);
  const isBrandLogoRequest = !!officialBrand && !isExplicitSearchIntent && isLogoPrompt;

  const latestImage = getLatestImageFromHistory(messagesHistory);
  const hasPreviousImage = Boolean(latestImage && (latestImage.url || latestImage.prompt));

  const isImageModificationRequest = hasPreviousImage && !forceCanvasCode && !isExplicitSearchIntent && (
    lower.length < 35 ||
    /\b(is|isko|iski|iska|isme|is me|it|this|that|change|modify|update|replace|badlo)\b/i.test(lower)
  );

  // Confirmed image creation requests
  const isConfirmedImageRequest = !hasImage && !forceCanvasCode && !isExplicitSearchIntent && (
    lower.startsWith('/image') ||
    lower.startsWith('/draw') ||
    lower.startsWith('/sd') ||
    isImageModificationRequest ||
    isBrandLogoRequest ||
    (isGenerationVerb && isVisualNoun)
  );

  // If user confirmed or specified an image/logo, immediately build the Image DAG
  if (!compoundIntent.isCompound && isConfirmedImageRequest) {
    return buildImageGenerationDAG(prompt, messagesHistory);
  }

  const systemPlannerPrompt = `You are the High-IQ Master Graph Planner for Devnexes AI.
Design the minimal, optimal JSON execution DAG for the user's request. Understand English, Roman Urdu, and Urdu.

PLANNING RULES:
1. CODE CREATION & EDITING:
   - ALL code generation (large apps, websites, scripts, functions, bug fixes) MUST be assigned to a "code" node (executed exclusively by Google Gemini).
   - When existing code artifact is present and user asks to modify, update, change, style, tweak, or add something (e.g. 'code ma changing karo', 'ya add karoo portfolio ma', 'button color change karo', 'ye add karo'):
     * If image attached: Stage 1 type="vision" (Visual asset inspection) -> Stage 2 type="analysis" (Plan code update) -> Stage 3 type="code" (Update code in Canvas).
     * If no image: Stage 1 type="analysis" (Plan code update) -> Stage 2 type="code" (Update code in Canvas).
     * NEVER rewrite existing code from scratch. Always mandate preserving 100% of existing components, content, and styling.
2. CANVAS CODE vs INLINE SNIPPETS:
   - Substantial code (Websites, web apps, HTML/CSS projects, full files): set artifactLanguage ('html' or target language). The system opens Code Canvas (Side Bar) for these.
   - Small snippets / functions / algorithms: assign to a "code" node with a concise task for direct delivery.
3. REAL-TIME SEARCH:
   - If user asks to search, or asks about specific people, companies, live events, or facts: Stage 1 MUST be type="search".
4. CONVERSATION & QUESTIONS:
   - If request is an informational question, inquiry, greeting, or conversational query (e.g. "what is X?", "X kya hai?", "explain this", "sick leave lih ky do"):
     * Do NOT plan any "code" nodes! Set intentCategory: "CONVERSATION" and nodes: [].
5. STRICT CLARIFICATION RESTRICTION:
   - NEVER set needsClarification: true if user asks for a website, app, code, script, feature, portfolio, landing page, or image. Make intelligent default decisions and build directly.
6. COMPOUND / MULTI-TASK REQUESTS:
   - When user asks for multiple things at once (e.g. an image AND writing a document like sick leave/letter, or search AND image, or code AND visual):
     * MUST plan nodes for ALL requested tasks!
     * If an image is requested: include type="image" node (with imagePrompt set to the visual subject only).
     * If code is requested: include type="code" node for Gemini into Canvas.
     * If search is requested: include type="search" node.
     * If writing/document is requested: include type="analysis" node to draft and compose the written document.

${forceWebSearch ? `[LIVE WEB SEARCH ENABLED]: Include a "search" node (Stage 1), then "analysis" node (Stage 2).` : ''}
${forceCanvasCode ? `[CANVAS CODE ENABLED]: Include a "code" node to generate complete production code into Canvas.` : ''}
${hasImage ? `[IMAGE ATTACHED]: Visual inspection required. Include type="vision" node.` : ''}

OUTPUT STRICT JSON ONLY:
{
  "needsClarification": false,
  "cannotPerform": false,
  "cannotPerformReason": null,
  "intentCategory": "GREETING | CONVERSATION | CODE_BUILD | RESEARCH | ANALYSIS | VISION_ANALYSIS | IMAGE_GENERATION",
  "thinkingSummary": "Authoritative technical summary of the plan (1-2 sentences)",
  "executionPlanSummary": "Phase 1: Architecture -> Phase 2: Implementation",
  "doneStateCriteria": "Clear success criteria",
  "skillId": "${allSkillIds}",
  "nodes": [
    {
      "id": "node_1",
      "name": "Simple friendly title",
      "type": "search | code | cmd | analysis | vision | image",
      "task": "Sharp actionable task instruction",
      "inputFrom": [],
      "canParallel": false,
      "executionStage": 1,
      "searchQuery": null,
      "imagePrompt": null,
      "artifactLanguage": "html | python | javascript | cpp | java",
      "artifactTitle": "Short title"
    }
  ]
}`;

  const historySummary = messagesHistory.length > 0
    ? messagesHistory.slice(-4).map(m => {
      if (m.role === 'user') return `User: ${m.content?.slice(0, 200) || ''}`;
      const art = m.traceData?.steps?.find(s => (s.type === 'code' || s.type === 'artifact') && s.code) || m.artifact;
      if (art) return `AI: Generated ${art.language || 'code'} artifact — "${art.title || 'Code Canvas'}" (${art.code ? art.code.split('\n').length : 0} lines)`;
      const resp = m.content || m.traceData?.steps?.find(s => s.type === 'response')?.content || '';
      return resp ? `AI: ${resp.slice(0, 120)}` : '';
    }).filter(Boolean).join('\n')
    : null;

  if (hasGroqApiKey()) {
    try {
      const planSignal = signal || AbortSignal.timeout(4500);
      const rawContent = await callGroqChatJson({
        messages: [
          { role: 'system', content: systemPlannerPrompt },
          {
            role: 'user',
            content: `${hasExistingArtifact ? `[ACTIVE CODE CANVAS DETECTED]: An existing ${latestArt.language} code artifact "${latestArt.title}" (${latestArt.code.split('\n').length} lines) is present in the workspace.\n` : ''}${historySummary ? `Prior conversation:\n${historySummary.slice(0, 1000)}\n\nCurrent request: "${prompt}"` : `Current request: "${prompt}"`}`
          }
        ],
        model: model || GROQ_MODEL,
        responseFormatJson: true,
        signal: planSignal
      });

      if (rawContent) {
        const lowerRaw = rawContent.toLowerCase();
        if (lowerRaw.includes('i cannot') || lowerRaw.includes("i can't") || lowerRaw.includes('unable to') || lowerRaw.includes("can't provide") || lowerRaw.includes("cannot provide") || lowerRaw.includes("can't create") || lowerRaw.includes("cannot create") || lowerRaw.includes("can't generate") || lowerRaw.includes("cannot generate")) {
          // If Groq refuses because of images, logos, or brand marks, override with image generation!
          if (!compoundIntent.isCompound && (isConfirmedImageRequest || isBrandLogoRequest)) {
            return buildImageGenerationDAG(prompt, messagesHistory);
          }
          return { cannotPerform: true, cannotPerformReason: rawContent.slice(0, 200), intentCategory: 'REFUSAL', nodes: [] };
        }

        const plan = safeExtractJson(rawContent);
        if (plan && typeof plan === 'object') {
          if (!compoundIntent.isCompound && (isConfirmedImageRequest || isBrandLogoRequest)) {
            return buildImageGenerationDAG(prompt, messagesHistory);
          }
          return normalizePlan(plan, {
            forceWebSearch,
            forceCanvasCode,
            userPrompt: prompt,
            hasExistingArtifact,
            latestArtifactLang: latestArt?.language || 'html',
            messagesHistory
          });
        }
      }
    } catch (err) {
      console.warn('[Planner] Groq planning error, using heuristic fallback:', err.message);
    }
  }

  // ── Heuristic fallback ─────────────────────────────────────────
  if (hasImage) {
    if (hasExistingArtifact && (isChangeOrModifyIntent || /\b(portfolio|website|site|app|page|code|canvas|add|lagao|dalo|insert|put|ye|ya)\b/i.test(lower))) {
      return {
        cannotPerform: false,
        intentCategory: 'CODE_BUILD',
        thinkingSummary: `Image asset uploaded to integrate into existing ${latestArt.language} artifact. Inspecting visual elements and updating Code Canvas.`,
        executionPlanSummary: 'Stage 1: Visual Asset Inspection -> Stage 2: Plan Code Integration -> Stage 3: Canvas Implementation',
        doneStateCriteria: 'Existing code updated in Canvas with visual asset integrated.',
        skillId: 'frontend-design',
        nodes: [
          {
            id: 'node_vision',
            name: 'Visual asset inspection',
            type: 'vision',
            task: 'Perform detailed visual inspection and extract key aesthetic/content attributes of the uploaded image for code integration.',
            inputFrom: [],
            canParallel: false,
            executionStage: 1
          },
          {
            id: 'node_arch_spec',
            name: 'Plan code update',
            type: 'analysis',
            task: `Formulate the exact integration steps to incorporate the uploaded image/asset into the existing ${latestArt.language} code without breaking existing structure.`,
            inputFrom: ['node_vision'],
            canParallel: false,
            executionStage: 2
          },
          {
            id: 'node_code_impl',
            name: 'Update code in Canvas',
            type: 'code',
            task: `Update the existing ${latestArt.language} code to fulfill: "${prompt}". STRICTLY PRESERVE 100% of all existing components, styling, logic, content, and features, applying only the requested changes directly inside the existing code.`,
            inputFrom: ['node_arch_spec'],
            canParallel: false,
            executionStage: 3,
            artifactLanguage: latestArt.language || 'html',
            artifactTitle: latestArt.title || 'Updated Portfolio'
          }
        ]
      };
    }

    return {
      cannotPerform: false, intentCategory: 'VISION_ANALYSIS',
      thinkingSummary: 'Image attached. Performing visual inspection.',
      executionPlanSummary: 'Visual Inspection & Analysis',
      doneStateCriteria: 'Visual inspection delivered',
      skillId: 'web-research-analyst',
      nodes: [{ id: 'node_vision', name: 'Visual Analysis', type: 'vision', task: 'Analyze the image thoroughly', executionStage: 1 }]
    };
  }

  if (!compoundIntent.isCompound && isConfirmedImageRequest) {
    return buildImageGenerationDAG(prompt, messagesHistory);
  }

  // Check if this message is a question, conversational inquiry, greeting, or fact inquiry

  if (isDevnexesInquiry) {
    return {
      cannotPerform: false,
      intentCategory: 'CONVERSATION',
      thinkingSummary: 'Explaining Devnexes AI directly.',
      skillId: matched.id,
      nodes: []
    };
  }

  const isIncrementalModification = codeIntent.isIncrementalEdit;
  const detectedLangInPrompt = detectProgrammingLanguageDynamically(prompt);
  const isExplicitCodeRequest = isIncrementalModification || Boolean(detectedLangInPrompt) || prompt.includes('```') || prompt.startsWith('/code');
  const isSearchCommand = !isExplicitCodeRequest && (forceWebSearch || prompt.startsWith('/search'));
  const looksLikeGreeting = !isExplicitCodeRequest && lower.length < 15 && /\b(hi|hello|hey|salam|hola)\b/i.test(lower);

  if (looksLikeGreeting) {
    return { cannotPerform: false, intentCategory: 'GREETING', thinkingSummary: 'Casual greeting.', skillId: matched.id, nodes: [] };
  }

  const fallbackNodes = [];
  let stage = 1;

  if (isIncrementalModification) {
    fallbackNodes.push({
      id: 'node_arch_spec',
      name: 'Plan code update',
      type: 'analysis',
      task: `Analyze user requested change: "${prompt}" and formulate the exact code integration steps into the existing ${latestArt.language} artifact.`,
      inputFrom: [], canParallel: false, executionStage: stage++
    });
    fallbackNodes.push({
      id: 'node_code_impl',
      name: 'Update code in Canvas',
      type: 'code',
      task: `Modify the existing ${latestArt.language} code to fulfill: "${prompt}". STRICTLY PRESERVE 100% of all existing components, styling, logic, content, and features, applying only the requested changes directly inside the existing code.`,
      inputFrom: ['node_arch_spec'], canParallel: false, executionStage: stage++,
      artifactLanguage: latestArt.language || 'html',
      artifactTitle: latestArt.title || prompt.slice(0, 40)
    });
  } else if (isExplicitCodeRequest) {
    const detectedCurrentLang = detectRequestedProgrammingLanguage(prompt);
    let targetLang = detectedCurrentLang || latestArt?.language || 'html';
    const isHtml = targetLang === 'html';

    fallbackNodes.push({
      id: 'node_arch_spec',
      name: isHtml ? 'Plan layout & design' : `Plan ${targetLang.toUpperCase()} code`,
      type: 'analysis',
      task: `Architect data models, state schema, and component structure for: "${prompt}"`,
      inputFrom: [], canParallel: false, executionStage: stage++
    });
    fallbackNodes.push({
      id: 'node_code_impl',
      name: isHtml ? 'Build website in Canvas' : `Write ${targetLang.toUpperCase()} code`,
      type: 'code',
      task: `Generate 100% complete, production-grade ${targetLang.toUpperCase()} code for: "${prompt}" into Code Canvas.`,
      inputFrom: ['node_arch_spec'], canParallel: false, executionStage: stage++,
      artifactLanguage: targetLang,
      artifactTitle: latestArt?.title || prompt.slice(0, 40)
    });
    fallbackNodes.push({
      id: 'node_cmd_runner',
      name: 'Setup & run commands',
      type: 'cmd',
      task: `Provide exact copy-pasteable PowerShell/CMD commands to run: "${prompt}"`,
      inputFrom: ['node_code_impl'], canParallel: false, executionStage: stage++
    });
  } else if (isSearchCommand) {
    const resolvedQuery = resolveContextualSearchQuery(prompt, messagesHistory);
    fallbackNodes.push({
      id: 'node_search_1',
      name: 'Search web',
      type: 'search',
      task: `Perform live web search to confirm ground truth for: "${resolvedQuery}"`,
      inputFrom: [],
      canParallel: false,
      executionStage: stage++,
      searchQuery: resolvedQuery.slice(0, 100)
    });
    fallbackNodes.push({
      id: 'node_facts_synthesis',
      name: 'Review search findings',
      type: 'analysis',
      task: `Extract and confirm verified facts from the live search findings. Filter out noise and confirm authentic data points before answering.`,
      inputFrom: ['node_search_1'],
      canParallel: false,
      executionStage: stage++
    });
  }

  return {
    cannotPerform: false,
    intentCategory: isExplicitCodeRequest ? 'CODE_BUILD' : 'RESEARCH',
    thinkingSummary: 'Planning optimal execution flow.',
    skillId: matched.id,
    nodes: fallbackNodes
  };
}
