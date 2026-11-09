/**
 * Devnexes AI — Autonomous Master Graph Planner
 * Uses Groq (qwen/qwen3.8-27b) to plan the dynamic execution DAG.
 */

import { DETAILED_SKILLS, getMatchingSkill } from '../skills/index.js';
import { callGroqChatJson } from './groqService.js';
import { detectOfficialBrandLogo } from './imageService.js';
import { resolveContextualSearchQuery } from './searchService.js';

const GROQ_MODEL = import.meta.env?.VITE_GROQ_MODEL || import.meta.env?.GROQ_MODEL || 'qwen/qwen3.8-27b';
const ALLOWED_NODE_TYPES = new Set(['search', 'code', 'cmd', 'analysis', 'vision', 'image']);

/**
 * Authoritative Programming Language Detector:
 * Identifies the exact programming language requested in the prompt or present in provided code.
 * Solves C++ and C# regex boundary bugs and prioritizes explicit user language specifications.
 */
export function detectRequestedProgrammingLanguage(prompt = '', snippet = '') {
  const combined = (String(prompt || '') + ' ' + String(snippet || '')).trim();
  const lower = combined.toLowerCase();

  // 1. C++ (handles "c++", "cpp", "cplusplus", and C++ standard library / syntax)
  if (
    /(?:\bc\+\+|\bcpp\b|\bcplusplus\b|\bc\s*plus\s*plus\b|\bclang\+\+)/i.test(lower) ||
    /#include\s*[<"][a-zA-Z0-9_./]+[>"]/i.test(combined) ||
    /\b(using\s+namespace\s+std|std::cout|std::cin|std::vector|std::string|std::map|cout\s*<<|cin\s*>>|nullptr|\bendl\b|std::endl)\b/.test(combined) ||
    (/\b(int|void)\s+main\s*\(/i.test(combined) && !/\bprintf\b/.test(combined))
  ) {
    return 'cpp';
  }

  // 2. C Language (handles "in c", "c code", "c language", stdio.h, printf)
  if (
    /\b(c\s+language|in\s+c\b|c\s+programming|c\s+code|c\s+me\b|c\s+mein\b)\b/i.test(lower) ||
    /#include\s*[<"](?:stdio\.h|stdlib\.h|string\.h)[>"]/i.test(combined) ||
    /\b(printf\s*\(|scanf\s*\(|malloc\s*\(|free\s*\(|getchar\s*\()\b/.test(combined)
  ) {
    return 'c';
  }

  // 3. Python (handles "python", "py", frameworks, and Python syntax)
  if (
    /\b(python|python3|py\b|django|flask|fastapi|pandas|numpy|scipy|matplotlib|pytorch|torch|tensorflow)\b/i.test(lower) ||
    /\b(def\s+[a-zA-Z_]\w*\s*\(|import\s+[a-zA-Z_]\w*|from\s+[a-zA-Z_]\w*\s+import|if\s+__name__\s*==\s*['"]__main__['"])\b/.test(combined)
  ) {
    return 'python';
  }

  // 4. Java (handles "java", "springboot", class main, System.out.println)
  if (
    (/\b(java|springboot|spring\s*boot|jvm)\b/i.test(lower) && !/\b(javascript|js)\b/i.test(lower)) ||
    /\b(public\s+class\s+\w+|public\s+static\s+void\s+main|System\.out\.println)\b/.test(combined)
  ) {
    return 'java';
  }

  // 5. C# / .NET (handles "c#", "csharp", "dotnet", Console.WriteLine)
  if (
    /(?:\bc#|\bcsharp\b|\bc-sharp\b|\bdotnet\b|\b\.net\b|unity\s+c#)/i.test(lower) ||
    /\b(using\s+System|Console\.WriteLine)\b/.test(combined)
  ) {
    return 'csharp';
  }

  // 6. Rust (handles "rust", "cargo", fn main, println!)
  if (
    /\b(rust|cargo|rustlang)\b/i.test(lower) ||
    /\b(fn\s+main\s*\(\)|println!\s*\(|pub\s+fn\s+|impl\s+\w+)\b/.test(combined)
  ) {
    return 'rust';
  }

  // 7. Go / Golang (handles "go", "golang", package main, fmt.Println)
  if (
    /\b(golang|go\s+language|in\s+go\b|go\s+code)\b/i.test(lower) ||
    /\b(package\s+main|func\s+main\s*\(\)|fmt\.Println)\b/.test(combined)
  ) {
    return 'go';
  }

  // 8. SQL (handles queries, table creation, select/insert)
  if (
    /\b(sql|mysql|postgresql|postgres|sqlite|oracle\s+sql|database\s+query|query\s+likho|query\s+banao)\b/i.test(lower) ||
    /\b(SELECT\s+.*?\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(combined)
  ) {
    return 'sql';
  }

  // 9. PHP (handles <?php, laravel, echo)
  if (
    /\b(php|laravel|wordpress)\b/i.test(lower) ||
    /<\?php|\$\w+\s*=|\becho\s+['"]/.test(combined)
  ) {
    return 'php';
  }

  // 10. TypeScript (handles "typescript", "ts", "tsx", interfaces, type annotations)
  if (
    /\b(typescript|ts\b|tsx\b)\b/i.test(lower) ||
    /\b(interface\s+\w+|type\s+\w+\s*=|:\s*(?:string|number|boolean|any)\[\])\b/.test(combined)
  ) {
    return 'typescript';
  }

  // 11. JavaScript / React (handles "javascript", "js", "react", node, express)
  if (
    /\b(javascript|js\b|node\b|nodejs|express|vanilla\s+js)\b/i.test(lower) ||
    /\b(console\.log|const\s+\w+\s*=|let\s+\w+\s*=|require\s*\(|module\.exports)\b/.test(combined)
  ) {
    return 'javascript';
  }

  // 12. HTML / CSS / Web Frontend (handles "html", "css", web pages, websites)
  if (
    /\b(html|css|tailwind|bootstrap|webpage|web\s+page|website|landing\s+page|portfolio\s+site|frontend\s+ui)\b/i.test(lower) ||
    /<!DOCTYPE\s+html|<html|<body|<div\b/i.test(combined)
  ) {
    return 'html';
  }

  return null;
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
 * Authoritative Code Intent Disambiguation Engine:
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
  const clean = String(prompt || '').toLowerCase().trim();
  const currentLang = detectRequestedProgrammingLanguage(prompt);
  const existingLang = latestArtifact?.language ? String(latestArtifact.language).toLowerCase() : null;

  // 0. Dedicated Follow-up Code Fix / Defect Correction Handling
  // If user says "fix this code", "correct this code", "error solve karo", or confirms the follow-up card:
  const isCodeFixRequest = (
    /\b(fix|theek|sahi|correct|repair|solve|debug)\b/i.test(clean) &&
    /\b(code|error|errors|issue|issues|defect|defects|is code|isi code|this code|yes|ha|haan|kardo|krdo|canvas)\b/i.test(clean)
  ) || /please (?:fix and )?correct this/i.test(clean) || /\b(fix this code|correct this code|solve error|solve errors|error solve karo)\b/i.test(clean);

  if (isCodeFixRequest) {
    const diagnosed = findDiagnosedCodeFromHistory(messagesHistory);
    if (diagnosed) {
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
  }

  // Language switch detection:
  // If user explicitly asks for or provides code in a language DIFFERENT from the existing artifact,
  // it is NEVER an incremental edit to the old artifact!
  // E.g. Previous was HTML, but user now enters C++, Python, Java, etc.
  if (currentLang && existingLang && currentLang !== existingLang) {
    return {
      isCode: true,
      isIncrementalEdit: false,
      intent: 'NEW_CODE',
      targetLanguage: currentLang
    };
  }

  // 1. Explicit New Project / Topic Switch -> MUST NOT overwrite or force into previous code!
  // E.g. "ab koi or chz bnao", "ab ek new website banao ecommerce ki", "calculator app banao", "scratch se banao"
  const isExplicitNew = (
    /\b(new website|new app|new project|new code|naya project|naya code|nayi website|naya website|fresh code|from scratch|scratch se|zero se|bilkul naya|completely new|different project|different app|different website|koi aur|kuch aur|koi or|kuch or|alag project|alag code|alag website|start over|start fresh)\b/i.test(clean) ||
    (/\b(ab|now)\b/i.test(clean) && /\b(new|naya|nayi|alag|aur|or)\b/i.test(clean) && /\b(banao|build|create|make|likho)\b/i.test(clean))
  );

  if (isExplicitNew) {
    return {
      isCode: true,
      isIncrementalEdit: false,
      intent: 'NEW_CODE',
      targetLanguage: currentLang || existingLang || 'html'
    };
  }

  // 2. Incremental Change / Modification / Element Verbs
  const isChangeOrModify = (
    /\b(change|changing|modify|modifying|modification|update|updating|tweak|tweaking|edit|editing|alter|altering|revision|refactor)\b/i.test(clean) ||
    /\b(add|addition|insert|inserting|include|put|attach|embed|append|dalo|daal|dal do|daal do|lagao|laga do|shamil|jodo)\b/i.test(clean) ||
    /\b(remove|delete|eliminate|drop|strip|hatao|hata do|hata|nikalo|nikal do|nikal)\b/i.test(clean) ||
    /\b(replace|swap|substitute|badlo|badal do|badal)\b/i.test(clean) ||
    /\b(fix|theek|sahi|correct|repair|solve|theek karo|sahi karo|fix karo)\b/i.test(clean) ||
    /\b(existing code|is code|isi code|same code|purane code|isi ma|isme|is me|is mai)\b/i.test(clean) ||
    /\b(ya add|ye add|yeh add|isko add|isay add|ise add|add kar|add kr)\b/i.test(clean) ||
    /\b(portfolio ma|portfolio mein|website ma|website mein|site ma|site mein|page ma|page mein|canvas ma|code ma|code mein)\b/i.test(clean) ||
    /\b(kuch change|kuch changing|thori change|thori changing|minor change|major change)\b/i.test(clean) ||
    /\b(navbar|header|footer|sidebar|hero|contact|about|projects?|services?|gallery|testimonials?|button|card|section|color|background|font|theme|dark mode|light mode|styling|layout|responsive|hover|animation)\b/i.test(clean)
  );

  // 3. Image uploaded to incorporate into existing code (e.g. "ya add karoo portfolio ma")
  const isImageAddToCode = hasImage && hasExistingArtifact && (
    isChangeOrModify ||
    /\b(portfolio|website|site|app|page|code|canvas|add|lagao|dalo|insert|put|ye|ya)\b/i.test(clean)
  );

  // If there is an existing code artifact AND the user wants to modify/add/style/fix it:
  if (hasExistingArtifact && (isChangeOrModify || isImageAddToCode)) {
    return {
      isCode: true,
      isIncrementalEdit: true,
      intent: 'UPDATE_EXISTING_CODE'
    };
  }

  // 4. Brand-new code creation / inquiry detection
  const isCodeTargetWord = /\b(code|function|program|script|algorithm|regex|sql|query|snippet|syntax|implementation|method|class|struct|loop|array|pointer|component|website|site|app|portfolio|page|html|css|javascript|typescript|python|cpp|c\+\+|java|rust|golang|csharp|php|react|vue|node)\b/i.test(clean);
  const isCodeActionWord = /\b(banao|build|create|make|write|likho|generate|do|de|give|show|dikhao|solve|implement|develop)\b/i.test(clean);
  const isDirectCodeInquiry = /\b(code likho|script likho|code banao|code do|code btao|code chahiye|write code|give code|show code|fix code|solve|function for|code for|program for|script for|algorithm for|implementation of|how to implement|how to write|in python|in cpp|in c\+\+|in javascript|in java|in rust|in html)\b/i.test(clean);
  const isExplicitCodePhrase = /\b(website banao|app banao|portfolio banao|code likho|script banao|build website|create website|create app|write code)\b/i.test(clean);

  const isSearchIntent = /\b(search|dhoondo|dhundo|pata karo|google|research|lookup|searc)\b/i.test(clean);
  const isNewCodeRequest = !isSearchIntent && (forceCanvasCode || (isCodeTargetWord && isCodeActionWord) || isDirectCodeInquiry || isExplicitCodePhrase);

  if (isNewCodeRequest) {
    return {
      isCode: true,
      isIncrementalEdit: false,
      intent: 'NEW_CODE'
    };
  }

  return {
    isCode: false,
    isIncrementalEdit: false,
    intent: 'NON_CODE'
  };
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

  // Strict restriction on clarification ("restrict karo"):
  // Clarification is ONLY permitted in extreme cases where the user prompt is completely empty or single-character gibberish.
  // If the prompt has 2+ words or mentions any actionable keyword (website, app, code, banao, build, create, etc.),
  // NEVER ask clarification! Automatically plan and build the solution directly.
  const hasSubstance = cleanPrompt.length > 8 || cleanPrompt.split(/\s+/).length >= 2 ||
    /\b(website|site|web|app|application|portfolio|ecommerce|store|shop|landing|page|code|script|program|build|banao|make|create|develop|dashboard|tool|system|game|calc|calculator|login|signup|auth|blog|api|image|photo|pic|picture|tasveer|logo)\b/i.test(cleanPrompt);

  const isImageOrVisual = /\b(image|photo|pic|picture|tasveer|logo|similar|sililar|attach|base|cctv|draw|paint|visual)\b/i.test(cleanPrompt);
  const allowClarification = Boolean(plan.needsClarification) && !hasSubstance && !isImageOrVisual;
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

  // Precise Detection of Any Code Request (large projects, full apps, or chota mota code snippets)
  const isSearchIntent = /\b(search|dhoondo|dhundo|pata karo|google|research|lookup|searc)\b/i.test(cleanPrompt);
  const isExplicitCodePhrase = /\b(website banao|app banao|portfolio banao|code likho|script banao|build website|create website|create app|write code)\b/i.test(cleanPrompt);

  const isCodeTargetWord = /\b(code|function|program|script|algorithm|regex|sql|query|snippet|syntax|implementation|method|class|struct|loop|array|pointer|component|website|site|app|portfolio|page|html|css|javascript|typescript|python|cpp|c\+\+|java|rust|golang|csharp|php|react|vue|node)\b/i.test(cleanPrompt);
  const isCodeActionWord = /\b(banao|build|create|make|write|likho|generate|modify|change|update|add|remove|delete|insert|replace|dalo|lagao|hatao|badlo|fix|theek|sahi|do|de|give|show|dikhao|solve|implement|how to|kaise|kese|sample|example)\b/i.test(cleanPrompt);
  const isDirectCodeInquiry = /\b(code likho|script likho|code banao|code do|code btao|code chahiye|write code|give code|show code|fix code|solve|function for|code for|program for|script for|algorithm for|implementation of|how to implement|how to write|in python|in cpp|in c\+\+|in javascript|in java|in rust|in html)\b/i.test(cleanPrompt);

  const isAnyCodeRequest = !isSearchIntent && (forceCanvasCode || (isCodeTargetWord && isCodeActionWord) || isDirectCodeInquiry || isExplicitCodePhrase);

  // Pure non-code questions or search requests
  const isPureNonCodeQuestion = !isAnyCodeRequest && (
    cleanPrompt.endsWith('?') ||
    isSearchIntent ||
    /\b(kya|what|who|kon|koun|where|kahan|when|kab|why|kyun|tell me about|explain|samjhao|difference|farq|meaning|matlab)\b/i.test(cleanPrompt) ||
    /\b(devnexes|ducky|chatgpt|openai|ai)\b/i.test(cleanPrompt)
  );

  // If this is a search request or pure non-code question, strip hallucinated code nodes!
  if ((isSearchIntent || isPureNonCodeQuestion) && !forceCanvasCode) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].type === 'code' || (nodes[i].type === 'analysis' && /\b(code|implementation|canvas|blueprint)\b/i.test(nodes[i].name || ''))) {
        nodes.splice(i, 1);
      }
    }
  }

  // If user asked to search, ensure a web search node is present
  if (isSearchIntent && !forceCanvasCode && !nodes.some(n => n.type === 'search')) {
    const cleanSearchQuery = cleanPrompt
      .replace(/\b(?:search|dhoondo|dhundo|pata karo|google|karo|btao|batayein|real time|real-time|searc)\b/gi, '')
      .trim();
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
 * Fuses an existing image's structural prompt with the user's targeted modification request
 * Preserves the exact camera perspective, composition, vehicle/subject structure, and lighting.
 */
export function fuseImageModificationPrompt(prevPrompt = '', userPrompt = '') {
  if (!prevPrompt) return userPrompt;
  const cleanUser = (userPrompt || '').toLowerCase();

  const colorMap = {
    red: 'glossy radiant candy-apple red finish',
    lal: 'glossy radiant candy-apple red finish',
    surkh: 'glossy radiant candy-apple red finish',
    blue: 'deep metallic sapphire blue finish',
    neela: 'deep metallic sapphire blue finish',
    black: 'glossy obsidian jet black finish',
    kala: 'glossy obsidian jet black finish',
    white: 'radiant pearl white finish',
    safaid: 'radiant pearl white finish',
    yellow: 'vibrant canary yellow finish',
    peela: 'vibrant canary yellow finish',
    green: 'metallic emerald green finish',
    sabz: 'metallic emerald green finish',
    orange: 'vibrant sunset orange finish',
    narangi: 'vibrant sunset orange finish',
    purple: 'deep metallic royal purple finish',
    gold: 'luxurious metallic gold finish',
    golden: 'luxurious metallic gold finish',
    silver: 'sleek liquid silver metallic finish',
    grey: 'sleek titanium matte grey finish',
    gray: 'sleek titanium matte grey finish'
  };

  let detectedColor = null;
  for (const [key, val] of Object.entries(colorMap)) {
    const reg = new RegExp(`\\b${key}\\b`, 'i');
    if (reg.test(cleanUser)) {
      detectedColor = val;
      break;
    }
  }

  let updatedPrompt = prevPrompt;

  if (detectedColor) {
    const existingColorPattern = /\b(glossy|metallic|radiant|deep|matte|vibrant)?\s*(silver|gold|golden|red|blue|black|white|yellow|green|orange|purple|grey|gray|titanium|obsidian|pearl|candy-apple|sapphire|emerald)\s*(finish|paint|color|colour)?\b/gi;
    if (existingColorPattern.test(updatedPrompt)) {
      updatedPrompt = updatedPrompt.replace(existingColorPattern, detectedColor);
    } else {
      const subjectMatch = updatedPrompt.match(/\b(sports car|supercar|car|vehicle|automobile|cat|dog|billi|lion|sher)\b/i);
      if (subjectMatch) {
        updatedPrompt = updatedPrompt.replace(subjectMatch[0], `${subjectMatch[0]} with ${detectedColor}`);
      } else {
        updatedPrompt = `${detectedColor}, ${updatedPrompt}`;
      }
    }
  }

  // Environmental / lighting changes
  if (/\b(night|dark|chaand|raat|moon|stars|city|neon|tokyo|rain|barish)\b/i.test(cleanUser)) {
    if (/\b(night|raat|moon|dark)\b/i.test(cleanUser)) {
      updatedPrompt = updatedPrompt.replace(/\b(daylight|bright daylight|sunset|sunny day|dramatic sunset lighting)\b/gi, 'atmospheric nighttime lighting, starry night sky with moon glow');
      if (!updatedPrompt.toLowerCase().includes('night')) {
        updatedPrompt += ', set at dramatic nighttime with soft ambient reflections';
      }
    }
    if (/\b(city|tokyo|neon)\b/i.test(cleanUser)) {
      updatedPrompt = updatedPrompt.replace(/\b(mountains and lush trees|scenic hills|stone driveway)\b/gi, 'futuristic neon-lit city street at night');
      if (!updatedPrompt.toLowerCase().includes('city')) {
        updatedPrompt += ', illuminated modern urban city backdrop';
      }
    }
    if (/\b(rain|barish|wet)\b/i.test(cleanUser)) {
      updatedPrompt += ', wet asphalt with reflections of city lights, light raindrops';
    }
  }

  // Accessories / Elements
  if (/\b(spoiler|wing|rear wing)\b/i.test(cleanUser)) {
    if (!updatedPrompt.toLowerCase().includes('spoiler')) {
      updatedPrompt = updatedPrompt.replace(/\b(sports car|supercar|car)\b/i, '$1 with aggressive carbon fiber rear aerodynamic spoiler');
    }
  }

  if (/\b(hat|topi|cap)\b/i.test(cleanUser)) {
    if (!updatedPrompt.toLowerCase().includes('hat')) {
      updatedPrompt += ', wearing a stylish miniature hat';
    }
  }

  if (/\b(chashma|glasses|sunglasses)\b/i.test(cleanUser)) {
    if (!updatedPrompt.toLowerCase().includes('sunglasses')) {
      updatedPrompt += ', wearing cool sunglasses';
    }
  }

  return updatedPrompt;
}

export function buildImageGenerationDAG(prompt, messagesHistory = [], skillId = 'web-research-analyst') {
  let cleanImagePrompt = '';
  const lower = prompt.toLowerCase().trim();

  // 1. Check if user is asking to modify an existing visual in conversation
  const latestImage = getLatestImageFromHistory(messagesHistory);
  const hasPreviousImage = Boolean(latestImage && (latestImage.url || latestImage.prompt));

  const isImageModificationRequest = hasPreviousImage && (
    (
      /\b(is|isko|iski|iska|isme|is me|ispe|is pe|issi|issi me|usi|usi me|ye|yeh)\b/i.test(lower) &&
      /\b(color|colour|rang|red|blue|black|white|green|yellow|orange|purple|gold|silver|background|change|badlo|kardo|kar do|laga do|hata do|add|night|day|spoiler|chashma|topi|hat|modify|update)\b/i.test(lower)
    ) || (
      /\b(make it|turn it|color it|paint it|change it|add to it|modify it|put on it)\b/i.test(lower)
    ) || (
      /\b(car|cat|billi|dog|kutta|lion|sher|person|man|woman|background|sky|wheels|color|colour|theme)\b/i.test(lower) &&
      /\b(red|blue|black|white|dark|bright|night|sunset|change|modify|update|replace|badlo|kardo|kar do)\b/i.test(lower)
    )
  );

  if (isImageModificationRequest && latestImage) {
    const prevPrompt = latestImage.prompt || latestImage.originalPrompt || '';
    cleanImagePrompt = fuseImageModificationPrompt(prevPrompt, prompt);

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

  const isReferencingPreviousVisual = /\b(similar|sililar|similer|jaisa|jaisi|same|copy|recreate|re-create|attach|attached|base|previous|purani|pehle wali|pehle waali|like this|one)\b/i.test(lower);

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

      if (content.includes('footage') || content.includes('security camera') || content.includes('CCTV') || content.includes('jewelry store') || msg.image) {
        const sentences = content.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 25 && !s.startsWith('#') && !s.toLowerCase().startsWith('diagnosis') && !s.toLowerCase().startsWith('impact'));
        if (sentences.length > 0) {
          cleanImagePrompt = sentences.slice(0, 2).join(', ');
          break;
        }
      }
    }
  }

  // 2. Clean user prompt if cleanImagePrompt not resolved yet
  if (!cleanImagePrompt) {
    cleanImagePrompt = prompt
      .replace(/^\/?(?:image|draw|sd|paint)\b/i, '')
      .replace(/\b(?:can you please|could you please|can u please|can u plz|please|plz|can you|can u|could you)\b/gi, '')
      .replace(/\b(?:generate (?:an? )?image of|create (?:an? )?image of|draw (?:an? )?image of|render (?:an? )?image of|photo of|picture of|wallpaper of)\b/gi, '')
      .replace(/\b(?:crete|creta|create|generate|draw|render|paint|make)\s+(?:an? )?(?:image|photo|pic|picture|tasveer|wallpaper|artwork)\s*(?:of)?\b/gi, '')
      .replace(/\b(?:crete|creta|create|generate|make|draw|paint|render|banao|bana do|dikhao|dikhayein)\s*(?:an?|a)?\b/gi, '')
      .replace(/\b(?:image banao|photo banao|tasveer banao|pic banao|picture banao|draw karo|banao|generate karo|generate|create|do|chahiye|de do|bana do|dikhao|dikhayein)\b/gi, '')
      .replace(/\b(?:an? )?(?:image|photo|pic|picture|tasveer|wallpaper|artwork|drawing)\b/gi, '')
      .replace(/\b(?:ki|ke|ka)\b/gi, '')
      .trim();
  }

  // 3. If prompt is very short or generic (e.g. "similar one", "simple one", "iron man"), inspect recent messages
  if (!cleanImagePrompt || cleanImagePrompt.length < 3 || /^(similar|sililar|simple|same|copy|one)$/i.test(cleanImagePrompt)) {
    const prevItems = (messagesHistory || []).slice(-4);
    for (let i = prevItems.length - 1; i >= 0; i--) {
      const item = prevItems[i];
      const txt = item?.content || '';
      const candidate = txt.replace(/\b(?:do|banao|dikhao|generate|karo|plz|please|chahiye|de do|bana do|image|photo|can u|can you|creta|create|similar|one)\b/gi, '').trim();
      if (candidate.length >= 4) {
        cleanImagePrompt = candidate.slice(0, 200);
        break;
      }
    }
  }

  if (!cleanImagePrompt || cleanImagePrompt.length < 2) {
    cleanImagePrompt = prompt;
  }

  const isLogo = /\b(logo|icon|emblem|symbol|badge|vector|brand mark)\b/i.test(prompt) ||
    /\b(logo|icon|emblem|symbol|badge|vector|brand mark)\b/i.test(cleanImagePrompt);

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

  // 1. Check if prompt contains an image generation intent
  const hasImageKeyword = /\b(image|tasveer|photo|pic|picture|wallpaper|artwork|drawing|logo|avatar|illustration)\b/i.test(lower);
  const hasImageVerb = /\b(generate|create|make|draw|paint|render|banao|bana do|bana de|dikhao|dikhayein)\b/i.test(lower);
  const hasImageIntent = (hasImageKeyword && (hasImageVerb || /\b(ki|ka|ke|of)\b/i.test(lower))) ||
    /\b(image banao|photo banao|tasveer banao|pic banao|picture banao|draw karo|generate image|create image|make image)\b/i.test(lower) ||
    lower.startsWith('/image') || lower.startsWith('/draw');

  // 2. Check if prompt contains a text writing / composition intent
  const hasWritingNouns = /\b(sick leave|leave application|leave|chutti|application|darkhwast|formal letter|letter|khat|essay|mazmoon|story|kahani|poem|shayari|nazm|kavita|email|post|blog|article|speech|taqreer|script|notes|summary|khulasa|cv|resume|bio|guide)\b/i.test(lower);
  const hasWritingVerbs = /\b(likho|likh do|likh ky do|likh kar do|likhein|write|draft|compose|pen down|type karo)\b/i.test(lower);
  const hasWritingIntent = hasWritingNouns || (hasWritingVerbs && !hasImageKeyword);

  // 3. Check if prompt contains a code creation intent
  const hasCodeNouns = /\b(code|website|web page|app|canvas|html|css|javascript|react|component|function|calculator|program|game|clone|landing page|portfolio)\b/i.test(lower);
  const hasCodeVerbs = /\b(code karo|code likho|banao|build|develop|program karo)\b/i.test(lower);
  const hasCodeIntent = hasCodeNouns && hasCodeVerbs;

  // 4. Check if prompt contains a search intent
  const hasSearchIntent = /\b(search|dhoondo|dhundo|pata karo|find out|rates|current price|latest news|weather)\b/i.test(lower);

  // 5. Check if prompt contains an explanation / question intent
  const hasExplanationIntent = /\b(explain|samjhao|batao|tell me|details|pros and cons|difference|solve karo|calculate)\b/i.test(lower) &&
    /\b(kya|kyun|kaise|how|why|what|difference|formula)\b/i.test(lower);

  // Check connectors indicating multiple tasks
  const hasConnector = /\b(and|aur|bhi|sath|saath|sath me|sath sath|plus|also|as well as|or sath|or saath|ke sath)\b/i.test(lower) ||
    (lower.includes(',') && (hasImageIntent && (hasWritingIntent || hasCodeIntent || hasSearchIntent)));

  const nonImageTasksCount = (hasWritingIntent ? 1 : 0) + (hasCodeIntent ? 1 : 0) + (hasSearchIntent ? 1 : 0) + (hasExplanationIntent ? 1 : 0);

  const isCompound = hasImageIntent && (hasConnector || nonImageTasksCount > 0) && (hasWritingIntent || hasCodeIntent || hasSearchIntent || hasExplanationIntent);

  if (!isCompound) {
    return { isCompound: false };
  }

  // Extract the visual prompt segment from the compound prompt
  let visualSubject = '';
  // Split prompt by connector
  const parts = clean.split(/\b(?:and|aur|sath me|sath sath|plus|ke sath|or sath|or saath|,)\b/i);
  for (const part of parts) {
    const trimmed = part.trim();
    if (/\b(image|tasveer|photo|pic|picture|wallpaper|artwork|logo)\b/i.test(trimmed)) {
      visualSubject = trimmed
        .replace(/\b(?:image|tasveer|photo|pic|picture|wallpaper|artwork|logo)\b/gi, '')
        .replace(/\b(?:banao|bana do|bana de|generate|create|draw|make|render|paint|likho|do|de do|chahiye|ki|ka|ke|of|an?|dikhao|dikhayein|karo|kar do|kar)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      break;
    }
  }

  if (!visualSubject || visualSubject.length < 2) {
    // Fallback: match words preceding "ki image" or "image of"
    const match = clean.match(/(?:(?:generate|create|make|draw)?\s*(?:an? )?(?:image|photo|pic|picture|tasveer)\s+of\s+([^,]+?)(?:\s+(?:and|aur|&|,)|$))/i) ||
      clean.match(/([^,]+?)\s+(?:ki|ka|ke)\s+(?:image|photo|pic|picture|tasveer)/i);
    if (match && match[1]?.trim()) {
      visualSubject = match[1]
        .replace(/\b(?:banao|bana do|generate|create|draw|make|likho|dikhao|karo)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
  }

  return {
    isCompound: true,
    hasImageTask: hasImageIntent,
    hasWritingTask: hasWritingIntent,
    hasWritingNouns,
    hasCodeTask: hasCodeIntent,
    hasSearchTask: hasSearchIntent,
    hasExplanationTask: hasExplanationIntent,
    visualSubject: visualSubject || 'sunset',
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

  // 4. Writing / Document Composition Node (for sick leave, letters, essays, stories, etc.)
  if (compoundIntent.hasWritingTask || compoundIntent.hasExplanationTask) {
    nodes.push({
      id: 'node_composition',
      name: compoundIntent.hasWritingNouns ? 'Draft written document' : 'Compose answer',
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
 */
export function isGeneralNonImagePrompt(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return false;
  const clean = prompt.toLowerCase().trim();

  // If prompt explicitly asks for an image, drawing, wallpaper, or photo, it is an image prompt
  if (
    clean.startsWith('/image') ||
    clean.startsWith('/draw') ||
    clean.startsWith('/sd') ||
    /\b(generate (?:an? )?image|create (?:an? )?image|draw (?:an? )?image|render (?:an? )?image|photo of|picture of|wallpaper of|artwork of|sketch of|painting of|illustration of|tasveer|image banao|photo banao|tasveer banao|pic banao|picture banao|art banao|wallpaper banao|draw karo|generate image|create image|make image)\b/i.test(clean) ||
    (/\b(image|photo|pic|picture|tasveer|wallpaper|artwork|avatar|logo)\b/i.test(clean) && /\b(banao|bana do|make|create|draw|render|paint|generate|dikhao)\b/i.test(clean))
  ) {
    return false;
  }

  // 1. Code requests (website, app, code, functions, scripts, frontend, backend)
  const isCodeTarget = /\b(website|site|portfolio|ecommerce|store|shop|landing page|web app|app|application|script|code|program|function|algorithm|class|method|component|syntax|regex|sql|query|html|css|javascript|typescript|python|cpp|c\+\+|java|rust|golang|api|backend|frontend|database)\b/i.test(clean);
  const isCodeAction = /\b(banao|build|create|make|write|likho|develop|generate|implement|solve|debug|fix|theek|sahi|repair|add|remove|delete|update|change|modify)\b/i.test(clean);
  if (isCodeTarget && (isCodeAction || /\b(code|script|program|implementation|how to|in python|in cpp|in js|in html)\b/i.test(clean))) {
    return true;
  }

  // 2. Letters, applications, essays, CV, emails
  const isDocument = /\b(sick leave|leave application|application format|resignation|cover letter|resume|cv|email draft|draft email|essay|speech|letter to|formal letter|informal letter|darkhwast|arzi)\b/i.test(clean);
  if (isDocument) return true;

  // 3. Informational questions & explanations
  const isQuestion = (
    clean.endsWith('?') ||
    /^(what is|who is|why is|where is|when is|how does|how do|how to|explain|tell me about|define|difference between|kya hai|kon hai|kaun hai|kahan hai|kab hai|kyun hai|kese hota|kaise hota|samjhao|batao|batayein)\b/i.test(clean) ||
    /\b(what is the|who is the|explain how|formula for|difference between|meaning of|kya matlab|tarjuma|translate)\b/i.test(clean)
  );
  if (isQuestion) return true;

  // 4. Web search requests
  const isSearch = /\b(search|dhoondo|dhundo|pata karo|google|lookup|research on|latest news)\b/i.test(clean);
  if (isSearch) return true;

  // 5. Math / Calculations
  const isMath = /^(calculate|solve|solve equation)\b/i.test(clean) || /^\d+\s*[+\-*/=]\s*\d+/.test(clean);
  if (isMath) return true;

  return false;
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

  const isLogoPrompt = /\b(logo|icon|emblem|symbol|brand mark|badge|avatar|mascot)\b/i.test(lower);
  const isVisualNoun = /\b(image|photo|pic|picture|tasveer|wallpaper|artwork|avatar|icon|logo|drawing|scene|view|footage|visual|cctv|portrait|landscape|illustration)\b/i.test(lower);
  const isGenerationVerb = /\b(generate|banao|bana do|make|create|crete|creta|crate|draw|render|dikhao|dikhayein|chahiye|de do|recreate|paint|synthesize)\b/i.test(lower);

  const isSimilarImageRequest = !isExplicitSearchIntent && (
    /\b(similar|sililar|similer|jaisa|jaisi|same|copy|recreate|re-create|aisa hi|aisi hi|is tarah|is trah|attach base|based on|jo attach ki thi|attached image)\b/i.test(lower) &&
    (
      hasPreviousAttachedImage ||
      /\b(image|photo|pic|picture|tasveer|cctv|footage|view|scene|visual)\b/i.test(recentConversation) ||
      /\b(image|photo|pic|picture|tasveer|scene|view|one|visual)\b/i.test(lower)
    )
  );

  const isFollowUpGeneration = !isExplicitSearchIntent && !isQuestionOrInquiry && (
    /^(simple one|similar one|another one|one more|ek aur|aur dikhao|aisa hi|aisi hi|aur banao|recreate|try again|dobara banao)$/i.test(lower) ||
    (/\b(simple one|similar one|another one|one more|ek aur|aur banao|aur image|aur photo|aur tasveer)\b/i.test(lower)) ||
    (
      isVisualNoun && isGenerationVerb &&
      (hasPreviousAttachedImage || /\b(logo|image|photo|pic|picture|tasveer|wallpaper|artwork|avatar|icon|cctv|footage)\b/i.test(recentConversation))
    )
  );

  const officialBrand = detectOfficialBrandLogo(lower);
  const isBrandLogoRequest = !!officialBrand && !isExplicitSearchIntent && isLogoPrompt;

  const latestImage = getLatestImageFromHistory(messagesHistory);
  const hasPreviousImage = Boolean(latestImage && (latestImage.url || latestImage.prompt));

  const isImageModificationRequest = hasPreviousImage && !forceCanvasCode && !isExplicitSearchIntent && (
    (
      /\b(is|isko|iski|iska|isme|is me|ispe|is pe|issi|issi me|usi|usi me|ye|yeh)\b/i.test(lower) &&
      /\b(color|colour|rang|red|blue|black|white|green|yellow|orange|purple|gold|silver|background|change|badlo|kardo|kar do|laga do|hata do|add|night|day|spoiler|chashma|topi|hat|modify|update)\b/i.test(lower)
    ) || (
      /\b(make it|turn it|color it|paint it|change it|add to it|modify it|put on it)\b/i.test(lower)
    ) || (
      /\b(car|cat|billi|dog|kutta|lion|sher|person|man|woman|background|sky|wheels|color|colour|theme)\b/i.test(lower) &&
      /\b(red|blue|black|white|dark|bright|night|sunset|change|modify|update|replace|badlo|kardo|kar do)\b/i.test(lower)
    )
  );

  // General capability inquiries or questions about image generation (not asking to draw a specific subject)
  const isGeneralImageInquiry = (
    /\b(image generation|image genearation|image generate\b|image creation|can you generate image|can you make an image|can you create an image|kya image generate|image bana sakty|image bana skte|image generate kar skty|kya aap image bana|image ban sakti hai)\b/i.test(lower) ||
    /^(image|images|image generation|image genearation|photo generation)\s*\??$/i.test(lower)
  ) && !/\b(of|ka|ki|ke|walay|wali|jese|like|with|holding|in|sunset|car|portrait|person|cat|dog|lion|nature|chatgpt|openai|google|iron man|superman|batman|hero|girl|boy|flower|city|logo|similar|cctv|jewelry)\b/i.test(lower);

  // Confirmed image creation requests (explicit command, action verb + visual noun, or specific subject + generation intent)
  const isConfirmedImageRequest = !hasImage && !forceCanvasCode && !isGeneralImageInquiry && !isExplicitSearchIntent && (
    lower.startsWith('/image') ||
    lower.startsWith('/draw') ||
    lower.startsWith('/sd') ||
    isSimilarImageRequest ||
    isFollowUpGeneration ||
    isImageModificationRequest ||
    isBrandLogoRequest ||
    /\b(image banao|photo banao|tasveer banao|pic banao|picture banao|art banao|wallpaper banao|logo banao|draw karo|generate image|create image|make image|draw image|synthesize image|generate a picture|draw a picture|photo of|picture of|render an image|paint an image)\b/i.test(lower) ||
    (isGenerationVerb && isVisualNoun) ||
    (/\b(can you|can u|could you|plz|please)\b/i.test(lower) && (isGenerationVerb && isVisualNoun)) ||
    (/\b(iron man|batman|superman|spiderman|avengers|warrior|robot|supercar|sports car|sunset)\b/i.test(lower) && (isVisualNoun || isGenerationVerb))
  );

  // If user is inquiring generally about image generation capability, answer directly without annoying interruptions
  if (isGeneralImageInquiry) {
    return {
      needsClarification: false,
      clarification: null,
      cannotPerform: false,
      intentCategory: 'CONVERSATION',
      thinkingSummary: 'Explaining visual generation capabilities directly.',
      executionPlanSummary: 'Direct Conversational Response',
      doneStateCriteria: 'Visual capability explained.',
      skillId: 'web-research-analyst',
      nodes: []
    };
  }

  // If user confirmed or specified an image/logo, immediately build the Image DAG without model hesitation
  if (!compoundIntent.isCompound && isConfirmedImageRequest) {
    return buildImageGenerationDAG(prompt, messagesHistory);
  }

  // General questions about Devnexes platform itself or assistant capabilities
  const isDevnexesInquiry = (
    (/\b(devnexes ai|devnexes chatbot|devnexes app|about devnexes ai)\b/i.test(lower) && /\b(kya|what|who|tell|explain|bare|baray|about|details)\b/i.test(lower)) ||
    /\b(devnexes ai kya|what is devnexes ai|tell me about devnexes ai|who made devnexes ai)\b/i.test(lower)
  ) && !/\b(digital solutions|company|agency|services|lahore|software house|software company|ceo|founder|search|google|dhoondo|dhundo|pata karo)\b/i.test(lower);
  const isCapabilityInquiry = /\b(ap kya|aap kya|kya kar sakty|kya kar skte|kya kar skty|what can you do|who are you|tum kon ho|ap kon ho|aap kaun ho)\b/i.test(lower);

  if (isDevnexesInquiry || isCapabilityInquiry) {
    return {
      needsClarification: false,
      clarification: null,
      cannotPerform: false,
      intentCategory: 'CONVERSATION',
      thinkingSummary: isDevnexesInquiry ? 'Explaining Devnexes AI directly.' : 'Explaining capabilities directly.',
      executionPlanSummary: 'Direct Conversational Response',
      doneStateCriteria: 'Direct conversational explanation delivered.',
      skillId: 'web-research-analyst',
      nodes: []
    };
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

  try {
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
      signal
    });

    if (rawContent) {
      const lowerRaw = rawContent.toLowerCase();
      if (lowerRaw.includes('i cannot') || lowerRaw.includes("i can't") || lowerRaw.includes('unable to') || lowerRaw.includes("can't provide") || lowerRaw.includes("cannot provide") || lowerRaw.includes("can't create") || lowerRaw.includes("cannot create") || lowerRaw.includes("can't generate") || lowerRaw.includes("cannot generate")) {
        // If Groq refuses because of images, logos, or brand marks, override with image generation!
        if (!compoundIntent.isCompound && !isGeneralImageInquiry && (isConfirmedImageRequest || isFollowUpGeneration || isBrandLogoRequest)) {
          return buildImageGenerationDAG(prompt, messagesHistory);
        }
        return { cannotPerform: true, cannotPerformReason: rawContent.slice(0, 200), intentCategory: 'REFUSAL', nodes: [] };
      }

      const plan = safeExtractJson(rawContent);
      if (plan && typeof plan === 'object') {
        if (!compoundIntent.isCompound && !isGeneralImageInquiry && (isConfirmedImageRequest || isFollowUpGeneration || isBrandLogoRequest)) {
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

  // Explicit bug / error keywords
  const isCodeFixOrModify = /\b(bug|bugs|error|errors|issue|issues|crash|broken|exception|syntax|typeerror|undefined)\b/i.test(lower);
  const isIncrementalModification = codeIntent.isIncrementalEdit && !isQuestionOrInquiry && !isExplicitSearchIntent;

  // An explicit brand-new code creation or code fix request (large project or small snippet)
  const isCodeTargetWord = /\b(code|function|program|script|algorithm|regex|sql|query|snippet|syntax|implementation|method|class|struct|loop|array|pointer|component|website|site|app|portfolio|page|html|css|javascript|typescript|python|cpp|c\+\+|java|rust|golang|csharp|php|react|vue|node)\b/i.test(lower);
  const isCodeActionWord = /\b(banao|build|create|make|write|likho|generate|modify|change|update|add|remove|delete|insert|replace|dalo|lagao|hatao|badlo|fix|theek|sahi|do|de|give|show|dikhao|solve|implement|how to|kaise|kese|sample|example)\b/i.test(lower);
  const isDirectCodeInquiry = /\b(code likho|script likho|code banao|code do|code btao|code chahiye|write code|give code|show code|fix code|solve|function for|code for|program for|script for|algorithm for|implementation of|how to implement|how to write|in python|in cpp|in c\+\+|in javascript|in java|in rust|in html)\b/i.test(lower);

  const isExplicitCodeRequest = isIncrementalModification || (isCodeTargetWord && isCodeActionWord) || isDirectCodeInquiry ||
    /\b(code likho|script banao|html banao|program likho|write code|write script|create app|build website|make a website|portfolio banao|website banao|app banao|store banao|ecommerce banao|fix this code|correct and fix|fix and correct|code fix|theek kardo|sahi kardo|fix kar do|correct kar do)\b/i.test(lower);
  const mentionsRealEntityOrFacts = /\b(linkedin|twitter|github|portfolio of|profile of|resume of|cv of|ceo|founder|co-founder|director|president|manager|owner|creator|author|company|agency|firm|business|startup|enterprise|devnexes|raham|qayyum)\b/i.test(lower) ||
    /\b(who is|who was|koun hai|kon hai|kis ka|kahan|where is|when was|what is the price|latest news|current version|documentation|official docs|stock|valuation)\b/i.test(lower) ||
    /\b(according to|based on|facts? about|history of|details of|background of|verify|check karo|confirm karo|pata karo|dhundo|dhoondo|pury internet)\b/i.test(lower);
  const isSearchCommand = !isExplicitCodeRequest && (
    isExplicitSearchIntent ||
    mentionsRealEntityOrFacts ||
    /\b(google|search|dhoondo|dhundo|pata karo|btao|batayein|koun|kaun|who|what|where|current|latest|news|info|details|fact|facts)\b/i.test(lower)
  );
  const looksLikeGreeting = !isExplicitCodeRequest && !mentionsRealEntityOrFacts && lower.length < 18 && /\b(hi|hello|hey|salam|assalam|hola|sup|good morning|kese ho)\b/i.test(lower);

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
  } else if (!isIncrementalModification && mentionsRealEntityOrFacts && isExplicitCodeRequest) {
    const cleanSearchQuery = prompt
      .replace(/\b(?:website banao|portfolio banao|code likho|script banao|build a website for|create a portfolio for|strictly based on his|strictly based on her|strictly based on)\b/gi, '')
      .trim();

    fallbackNodes.push({
      id: 'node_search_grounding',
      name: 'Search web for verified facts',
      type: 'search',
      task: `Perform live web search for: "${cleanSearchQuery || prompt}" to gather verified factual profile and company data. ZERO fake data.`,
      inputFrom: [],
      canParallel: false,
      executionStage: stage++,
      searchQuery: cleanSearchQuery || prompt
    });

    const isHtml = latestArt ? (latestArt.language === 'html') : (matched.id === 'frontend-design' || /\b(html|css|website|dashboard|ui|ecommerce|react|store|canvas)\b/i.test(lower));
    const targetLang = latestArt?.language || (isHtml ? 'html' : 'python');

    fallbackNodes.push({
      id: 'node_arch_spec',
      name: 'Review facts & plan layout',
      type: 'analysis',
      task: `Extract verified achievements, real credentials, and genuine company milestones from the live search findings. Formulate the technical specification with 100% genuine data.`,
      inputFrom: ['node_search_grounding'],
      canParallel: false,
      executionStage: stage++
    });

    fallbackNodes.push({
      id: 'node_code_impl',
      name: isHtml ? 'Build website in Canvas' : 'Write application code',
      type: 'code',
      task: `Generate 100% complete production code implementing the verified facts into the Canvas document.`,
      inputFrom: ['node_arch_spec'],
      canParallel: false,
      executionStage: stage++,
      artifactLanguage: targetLang,
      artifactTitle: latestArt?.title || prompt.slice(0, 40)
    });

    fallbackNodes.push({
      id: 'node_cmd_runner',
      name: 'Setup & run commands',
      type: 'cmd',
      task: `Provide exact copy-pasteable PowerShell/CMD commands to run: "${prompt}"`,
      inputFrom: ['node_code_impl'],
      canParallel: false,
      executionStage: stage++
    });

    return {
      cannotPerform: false,
      intentCategory: 'CODE_BUILD',
      thinkingSummary: `User requested an implementation grounded in real-world data for: "${prompt}". Grounding with live web search first to ensure 100% genuine factual accuracy before coding.`,
      executionPlanSummary: 'Stage 1: Ground-Truth Entity & LinkedIn Data Extraction -> Stage 2: Verified Facts Synthesis -> Stage 3: Canvas Implementation',
      doneStateCriteria: 'Production code delivered with 100% verified facts from live search grounding.',
      skillId: matched.id,
      nodes: fallbackNodes
    };
  } else if (isExplicitCodeRequest) {
    const detectedCurrentLang = detectRequestedProgrammingLanguage(prompt);
    let targetLang = detectedCurrentLang;
    if (!targetLang) {
      if (isIncrementalModification && latestArt?.language) {
        targetLang = latestArt.language;
      } else {
        const fullConvText = lower + ' ' + (messagesHistory || []).map(m => m.content || '').join(' ').toLowerCase();
        targetLang = detectRequestedProgrammingLanguage(fullConvText) || 'python';
      }
    }

    const isSubstantial = forceCanvasCode || /\b(website|site|app|application|portfolio|ecommerce|store|shop|landing|page|dashboard|system|game|calc|calculator|full code|complete code|project)\b/i.test(lower);

    if (isSubstantial) {
      fallbackNodes.push({
        id: 'node_arch_spec',
        name: isCodeFixOrModify ? 'Plan code fix' : 'Plan layout & design',
        type: 'analysis',
        task: isCodeFixOrModify ? `Diagnose errors, inspect code logic, and formulate the exact fix for: "${prompt}"` : `Architect data models, state schema, and component structure for: "${prompt}"`,
        inputFrom: [], canParallel: false, executionStage: stage++
      });
      fallbackNodes.push({
        id: 'node_code_impl',
        name: isCodeFixOrModify ? 'Fix and update code' : (targetLang === 'html' ? 'Build website in Canvas' : 'Write application code'),
        type: 'code',
        task: isCodeFixOrModify ? `Generate 100% complete, corrected, working ${targetLang} code fixing: "${prompt}" into Code Canvas.` : `Generate 100% complete, production-grade ${targetLang} code for: "${prompt}" into Code Canvas.`,
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
    } else {
      // Chota mota code: Direct, clean snippet generation by Gemini!
      fallbackNodes.push({
        id: 'node_code_snippet',
        name: 'Generate code snippet',
        type: 'code',
        task: `Generate concise, accurate, idiomatic ${targetLang} code for: "${prompt}". Focus on clean, efficient code.`,
        inputFrom: [], canParallel: false, executionStage: stage++,
        artifactLanguage: targetLang,
        artifactTitle: prompt.slice(0, 40)
      });
    }
  } else if (isSearchCommand || mentionsRealEntityOrFacts || !looksLikeGreeting) {
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
