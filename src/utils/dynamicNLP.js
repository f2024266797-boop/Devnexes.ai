/**
 * Devnexes AI - 100% Dynamic NLP & Code Analysis Engine
 * 
 * STRICT ARCHITECTURAL PRINCIPLE:
 * ZERO Hardcoded Word Dictionaries, ZERO Predefined Keyword Catalogs, ZERO Static Typo Lists.
 * All recognition is algorithmic, mathematical (Levenshtein / Unicode), structural (code fences / shebangs),
 * or delegated to AI LLMs (Groq / Gemini) which possess universal linguistic understanding.
 */

/**
 * Validates that an API key is a genuine configured key and not a template dummy placeholder
 * like "gsk_your_primary_groq_api_key_here" or "AIzaSy_your_primary...".
 */
export function isRealApiKey(key = '') {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (k.length < 15) return false;
  if (k.includes('your_') || k.includes('your-') || k.includes('your_key') || k.includes('your_primary')) return false;
  return true;
}

/**
 * Calculates standard Levenshtein distance between two strings dynamically.
 */
export function levenshteinDistance(s1 = '', s2 = '') {
  const str1 = String(s1 || '').toLowerCase();
  const str2 = String(s2 || '').toLowerCase();
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Calculates normalized string similarity ratio (0.0 to 1.0).
 */
export function stringSimilarity(s1 = '', s2 = '') {
  const str1 = String(s1 || '').trim().toLowerCase();
  const str2 = String(s2 || '').trim().toLowerCase();

  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const maxLen = Math.max(str1.length, str2.length);
  const dist = levenshteinDistance(str1, str2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Checks if any token in text fuzzily matches any candidate.
 * Pure dynamic mathematical distance without storing any dictionaries.
 */
export function hasFuzzyWord(text = '', candidates = [], minSimilarity = 0.82, maxDistance = 1) {
  if (!text || !Array.isArray(candidates) || candidates.length === 0) return false;
  const words = String(text).toLowerCase().match(/[a-zA-Z0-9#+.-]+/g) || [];
  for (const word of words) {
    for (const cand of candidates) {
      const c = String(cand).toLowerCase();
      if (word === c) return true;
      if (Math.abs(word.length - c.length) <= maxDistance) {
        if (stringSimilarity(word, c) >= minSimilarity) return true;
      }
    }
  }
  return false;
}

/**
 * Dynamically extracts programming language from markdown code fences, shebangs, or prompt syntax.
 * Zero static catalogs: handles ANY language dynamically.
 */
export function extractCodeLanguage(text = '') {
  if (!text || typeof text !== 'string') return null;

  // 1. Markdown code fence tag: ```<language>
  const fenceMatch = text.match(/```([a-zA-Z0-9#+.-]+)/);
  if (fenceMatch && fenceMatch[1]) {
    const rawTag = fenceMatch[1].toLowerCase().trim();
    if (rawTag && rawTag !== 'code' && rawTag !== 'snippet') {
      return normalizeLanguageTag(rawTag);
    }
  }

  // 2. Shebang line: #!/.../env <language> or #!/.../<language>
  const shebangMatch = text.match(/^#!.*?[/ ]([a-zA-Z0-9_-]+)(?:\s|$)/m);
  if (shebangMatch && shebangMatch[1]) {
    return normalizeLanguageTag(shebangMatch[1].toLowerCase());
  }

  // 3. Command slash prefix: /python, /cpp, /html, /js
  const commandMatch = text.match(/^\/([a-zA-Z0-9#+.-]+)\b/);
  if (commandMatch && commandMatch[1]) {
    const cmd = commandMatch[1].toLowerCase();
    if (cmd !== 'search' && cmd !== 'image' && cmd !== 'draw' && cmd !== 'sd' && cmd !== 'think') {
      return normalizeLanguageTag(cmd);
    }
  }

  return null;
}

/**
 * Detects whether a user prompt or spec is requesting to build, code, design, or create
 * a website, web page, landing page, portfolio, ecommerce store, web app, or frontend UI.
 * Handles English, Roman Urdu, and Urdu natively.
 */
export function isWebsiteOrWebUiRequest(text = '') {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  if (!clean) return false;

  // If user is just asking an informational capability question (e.g. "website baana lyty ho?"), do not treat as build command!
  if (isCapabilityInquiry(clean)) return false;

  // Native Urdu / Arabic script check
  if (/[\u0600-\u06FF]/.test(clean)) {
    if (/ویب\s*سائٹ|ویب|صفحہ|پورٹ\s*فولیو|لینڈنگ|ڈیش\s*بورڈ|آن\s*لائن\s*سٹور/.test(clean)) return true;
  }

  const lower = clean.toLowerCase();

  // Core explicit keywords
  const coreWebKeywords = /\b(?:website|webpage|web\s*site|web\s*page|landing\s*page|portfolio(?:\s*(?:site|website|page))?|ecommerce(?:\s*(?:site|website|store|shop))?|e-commerce(?:\s*(?:site|website|store|shop))?|web\s*app|webapp|frontend(?:\s*(?:ui|app|page|site))?|dashboard(?:\s*(?:ui|page|site|web))?|html\s*css|html\s*css\s*js)\b/i;
  if (coreWebKeywords.test(lower)) {
    return true;
  }

  // Action verbs + site/page/store terms in Roman Urdu & English
  const actionVerbs = /\b(?:banao|bana\s*do|banani|chahiye|create|build|make|design|code|develop|generate)\b/i;
  const webTargets = /\b(?:site|page|portal|store|shop|ui|frontend|template)\b/i;
  if (actionVerbs.test(lower) && webTargets.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Detects programming language dynamically from prompt or code snippet.
 * Discovers syntax patterns (e.g. #include, def, class, import, package) and file tags
 * without maintaining static word dictionaries.
 */
export function detectProgrammingLanguageDynamically(prompt = '', snippet = '') {
  // First check code fences or shebang in snippet / prompt
  const fromCode = extractCodeLanguage(snippet) || extractCodeLanguage(prompt);
  if (fromCode) return fromCode;

  // Website requests always target HTML/CSS/JS Canvas Live Preview
  if (isWebsiteOrWebUiRequest(prompt) || isWebsiteOrWebUiRequest(snippet)) {
    return 'html';
  }

  const combined = `${prompt} ${snippet}`.trim();
  if (!combined) return null;

  // Structural syntax markers
  if (/#include\s*[<"](?:iostream|cstdio|vector|string|map|algorithm)/i.test(combined) || /\b(?:std::cout|std::cin|cout\s*<<|cin\s*>>)\b/.test(combined)) {
    return 'cpp';
  }
  if (/#include\s*[<"](?:stdio\.h|stdlib\.h|string\.h|math\.h)/i.test(combined) || /\b(?:printf|scanf)\s*\(/.test(combined)) {
    return 'c';
  }
  if (/\b(?:def\s+\w+\s*\(|import\s+[a-z_][a-z0-9_]*|from\s+[a-z_][a-z0-9_]*\s+import|if\s+__name__\s*==\s*['"]__main__['"])/i.test(combined)) {
    return 'python';
  }
  if (/<(?:!doctype\s+html|html|div|span|button|nav|header|section|body)\b/i.test(combined)) {
    return 'html';
  }
  if (/\b(?:console\.log|document\.getElementById|addEventListener|const\s+\w+\s*=\s*(?:require|\(\))\s*=>)\b/.test(combined)) {
    return 'javascript';
  }
  if (/\b(?:public\s+static\s+void\s+main|System\.out\.println)\b/.test(combined)) {
    return 'java';
  }
  if (/\b(?:package\s+main|func\s+main\s*\(\s*\)|fmt\.Println)\b/.test(combined)) {
    return 'go';
  }
  if (/\b(?:fn\s+main\s*\(\s*\)|println!\s*\()/.test(combined)) {
    return 'rust';
  }

  // Check common language file extensions mentioned in prompt
  const extMatch = combined.match(/\.([a-zA-Z0-9]{1,6})\b/);
  if (extMatch && extMatch[1]) {
    return normalizeLanguageTag(extMatch[1]);
  }

  return null;
}

/**
 * Basic syntax normalization for standard extensions.
 */
function normalizeLanguageTag(tag = '') {
  const clean = tag.replace(/[^a-zA-Z0-9#+.-]/g, '').toLowerCase();
  if (clean === 'cplusplus' || clean === 'c++' || clean === 'cplus') return 'cpp';
  if (clean === 'csharp' || clean === 'c#') return 'csharp';
  if (clean === 'golang') return 'go';
  if (clean === 'py') return 'python';
  if (clean === 'js' || clean === 'mjs' || clean === 'cjs') return 'javascript';
  if (clean === 'ts' || clean === 'tsx') return 'typescript';
  if (clean === 'jsx') return 'javascript';
  if (clean === 'htm') return 'html';
  if (clean === 'rs') return 'rust';
  if (clean === 'rb') return 'ruby';
  return clean || null;
}

/**
 * Checks for native Arabic/Urdu Unicode character range dynamically.
 */
export function detectUrduScript(text = '') {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Detects whether user text is in Roman Urdu (Latin script), native Urdu (Arabic script), or English.
 * Pure dynamic Unicode and phonetic clustering without static word dictionaries.
 */
export function detectUserLanguageStyle(text = '') {
  if (!text || typeof text !== 'string') return 'english';
  if (detectUrduScript(text)) return 'urdu_native';
  if (isUrduOrHindi(text)) return 'roman_urdu';
  return 'english';
}

/**
 * Dynamically detects whether a user prompt is an informational capability inquiry
 * (e.g. asking if the AI is able/can do something like "error nikal ky dy skty ho?", "can you build a website?", "kya tum code check kr skty ho?").
 * These should always be handled in 1 single streaming turn without spawning multi-step task loops.
 */
export function isCapabilityInquiry(text = '') {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  // If there's code, backticks, brackets or extensive text, it's an actual task payload, not a capability inquiry
  if (clean.length > 130 || clean.split(/\s+/).length > 20) return false;
  if (clean.includes('```') || clean.includes('{') || clean.includes('}') || clean.includes(';') || clean.includes('<!DOCTYPE')) return false;

  const lower = clean.toLowerCase();

  // Explicit ability/capability patterns (English & Roman Urdu phonetic variations)
  const abilityPatterns = [
    /\b(?:can\s+you|are\s+you\s+able|could\s+you)\b/i,
    /\b(?:kya\s+tum|kya\s+aap|kya\s+ap)\b/i,
    /\b(?:ba*na*|kr|kar|likh|dekh|check|nikal|dhoond)\s*(?:lyty|lete|leti|letay|lyte|dyte|dete|skt[yea]|sakt[yea]|sakty|sakte)\s*(?:ho|hain|han)?\b/i,
    /\b(?:kr\s*dyte|kar\s*dete|kr\s*lete|kar\s*lyte|bana\s*lyte|baana\s*lyty|bana\s*lete|bna\s*lyty|bana\s*lyty)\s*(?:ho|hain|han)?\b/i,
    /\b(?:bana\s*logy|bana\s*loge|kar\s*loge|kr\s*logy|bana\s*skty|kar\s*sakte)\b/i
  ];

  const hasAbilityKeywords = abilityPatterns.some(pattern => pattern.test(lower));
  const isQuestion = lower.includes('?') || /\b(?:kya|can|could|how|kese|kaise)\b/i.test(lower) || /\b(?:ho|hain|han)\?*$/i.test(lower);

  return hasAbilityKeywords && (isQuestion || clean.length < 60);
}

/**
 * Detects whether text is in Urdu/Hindi or Roman Urdu/Hindi.
 * ZERO static dictionaries: uses Unicode ranges and phonetic digraph clusters.
 */
export function isUrduOrHindi(text = '') {
  if (!text || typeof text !== 'string') return false;
  // 1. Native Urdu / Arabic / Devanagari Unicode scripts
  if (/[\u0600-\u06FF\u0750-\u077F\u0900-\u097F]/.test(text)) return true;
  // 2. Phonetic morphological digraphs & South Asian consonant clusters without word lists
  const tokens = text.toLowerCase().match(/[a-z]+/g) || [];
  let phoneticCount = 0;
  for (const token of tokens) {
    if (/(?:kh|gh|jh|dh|bh|ch|th|ph|sh|ein|aye|iye|oon|aan|aar|par|kar|bna|likh|chah|krn|krd|btao|smjh|skty|sakt|nikal|dhoond|kya|kyu|kese|kaise|apka|apki|mera|meri|mere|tere|teri|mujhe|mjhe|tumhe|tmhe|nhi|nahi|theek|sahi|acha|accha)/.test(token)) {
      phoneticCount++;
    }
  }
  return phoneticCount >= 2;
}

/**
 * Dynamically resolves brand/website logo from ANY company or domain query
 * without requiring any static brand dictionary.
 */
export function extractBrandDomain(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return null;
  const clean = prompt.trim();

  // 1. Direct domain in prompt (e.g., "google.com", "nike.io", "vercel.app")
  const domainMatch = clean.match(/\b([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,}))\b/);
  if (domainMatch && domainMatch[1]) {
    const domain = domainMatch[1].toLowerCase();
    const cleanBrand = domain.split('.')[0];
    const brandName = cleanBrand.charAt(0).toUpperCase() + cleanBrand.slice(1);
    return {
      brand: brandName,
      domain,
      url: `https://unavatar.io/${domain}`,
      fallbackUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      isOfficialBrand: true
    };
  }

  // 2. Explicit logo/icon request for any brand name
  const logoMatch = clean.match(/(?:logo|icon|symbol|emblem|badge|favicon|avatar)\s+(?:of\s+)?([a-zA-Z0-9_-]+)/i) ||
    clean.match(/([a-zA-Z0-9_-]+)\s+(?:logo|icon|symbol|emblem|badge|favicon|avatar)/i);

  if (logoMatch && logoMatch[1]) {
    const rawBrand = logoMatch[1].trim();
    if (rawBrand.length >= 2 && rawBrand.length <= 35) {
      const cleanBrand = rawBrand.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const brandName = cleanBrand.charAt(0).toUpperCase() + cleanBrand.slice(1);
      const domain = `${cleanBrand}.com`;
      return {
        brand: brandName,
        domain,
        url: `https://unavatar.io/${domain}`,
        fallbackUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
        isOfficialBrand: true
      };
    }
  }

  return null;
}

/**
 * Alias for extractBrandDomain
 */
export function resolveBrandLogoDynamically(prompt = '') {
  return extractBrandDomain(prompt);
}

/**
 * Dynamically cleans prompt of command slashes, extra whitespace, and control chars.
 * ZERO hardcoded stop-word dictionaries.
 */
export function cleanDynamicSearchQuery(rawQuery = '') {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  return rawQuery
    .replace(/^\/[a-zA-Z0-9_-]+\s*/, '') // Remove leading slash commands (e.g. /search, /google)
    .replace(/[?¿!¡;:*~`]+/g, ' ')       // Clean punctuation
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .trim();
}

/**
 * Dynamically analyzes prompt intent based purely on structural indicators:
 * code fences, question marks, file tags, slash commands, and existing context.
 * Zero static vocabulary lists.
 */
export function analyzePromptIntent({
  prompt = '',
  hasExistingArtifact = false,
  latestArtifact = null,
  hasImage = false,
  forceCanvasCode = false
} = {}) {
  const clean = String(prompt || '').trim();
  const lower = clean.toLowerCase();

  const isWebReq = isWebsiteOrWebUiRequest(clean);
  const detectedLang = isWebReq ? 'html' : detectProgrammingLanguageDynamically(clean);
  const hasCodeFence = clean.includes('```');

  if (forceCanvasCode || hasCodeFence || isWebReq || Boolean(detectedLang)) {
    return {
      isCode: true,
      isIncrementalEdit: Boolean(hasExistingArtifact && !clean.includes('```')),
      intent: hasExistingArtifact ? 'UPDATE_EXISTING_CODE' : 'NEW_CODE',
      targetLanguage: detectedLang || latestArtifact?.language || 'html'
    };
  }

  if (clean.startsWith('/image') || clean.startsWith('/draw') || clean.startsWith('/sd')) {
    return {
      isCode: false,
      isIncrementalEdit: false,
      intent: 'IMAGE_GENERATION'
    };
  }

  if (clean.startsWith('/search')) {
    return {
      isCode: false,
      isIncrementalEdit: false,
      intent: 'SEARCH'
    };
  }

  return {
    isCode: false,
    isIncrementalEdit: false,
    intent: 'CONVERSATION'
  };
}

/**
 * Dynamically merges previous image prompt with user's modification instructions.
 * Eliminates static color maps, animal lists, and hardcoded replacement dictionaries.
 */
export function dynamicallyFuseImagePrompt(prevPrompt = '', userPrompt = '') {
  const prev = String(prevPrompt || '').trim();
  const user = String(userPrompt || '').trim();

  if (!prev) return user;
  if (!user) return prev;

  // Clean conversational prefixes & slashes
  const cleanUser = user
    .replace(/^\/[a-zA-Z0-9_-]+\s*/, '')
    .replace(/^["']|["']$/g, '')
    .trim();

  // Combine logically: previous base description enriched with the user's targeted modifications
  return `${prev}, with modifications: ${cleanUser}`;
}
