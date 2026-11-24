/**
 * Devnexes AI — Structured RAG & Long-Term Memory Storage System
 * 
 * Features:
 * - Persistent cross-conversation memory stored in localStorage
 * - Structured memory schema (id, category, title, content, tags, confidence, timesRecalled)
 * - Self-improving agent: Automatically learns from user corrections & mistakes ("apni galtyo sy bi sikhy")
 * - Smart TF-IDF + Tag + Category semantic retrieval (RAG)
 * - Integrated across all 4 Devnexes AI Modes:
 *     1. Groq (Brain reasoning, planning, intake)
 *     2. Gemini (Canvas code generation & bug-free implementation)
 *     3. Tavily (Search query grounding)
 *     4. Stability AI (Style & visual preference injection)
 * - Zero bloat: Does NOT store raw code files or massive transcripts, only high-value distilled rules & facts
 */

import { isUrduOrHindi, isRealApiKey } from '../utils/dynamicNLP.js';
import { getAvailableGroqKey } from './groqService.js';
import { BM25Index, VectorSpaceIndex, tokenizeText, generateNgrams } from './ragEngine.js';

export const MEMORY_STORAGE_KEY = 'devnexes_rag_memory';
export const MEMORY_SETTINGS_KEY = 'devnexes_memory_settings';

export const MEMORY_CATEGORIES = [
  { id: 'all', label: 'All Knowledge', icon: 'Brain' },
  { id: 'lesson_learned', label: 'Lessons Learned', icon: 'GraduationCap', color: 'amber' },
  { id: 'tech_stack', label: 'Tech Stack', icon: 'Layers', color: 'blue' },
  { id: 'user_preference', label: 'User Preferences', icon: 'Sliders', color: 'purple' },
  { id: 'project_fact', label: 'Project Facts', icon: 'FileText', color: 'emerald' },
  { id: 'rule', label: 'Custom Rules', icon: 'ShieldCheck', color: 'rose' }
];

// Pre-seeded foundational knowledge so Devnexes AI is mature from turn 1
const DEFAULT_FOUNDATIONAL_MEMORIES = [
  {
    id: 'mem_seed_1',
    category: 'tech_stack',
    title: 'Tailwind CSS v4 Configuration Rule',
    content: 'In Tailwind CSS v4, use @import "tailwindcss"; directly in CSS. Do not generate or look for tailwind.config.js or postcss.config.js.',
    tags: ['tailwind', 'css', 'vite', 'styling', 'v4'],
    confidence: 1.0,
    source: 'system',
    createdAt: 1732000000000,
    updatedAt: 1732000000000,
    timesRecalled: 0
  },
  {
    id: 'mem_seed_2',
    category: 'tech_stack',
    title: 'React 19 & Lucide Icons Integration',
    content: 'Always use standard functional components with React 19 hooks. Use lucide-react for modern icons and smooth transitions.',
    tags: ['react', 'react19', 'lucide', 'icons', 'hooks'],
    confidence: 1.0,
    source: 'system',
    createdAt: 1732000000000,
    updatedAt: 1732000000000,
    timesRecalled: 0
  },
  {
    id: 'mem_seed_3',
    category: 'lesson_learned',
    title: 'Zero Placeholder / Complete Code Delivery',
    content: 'Never write placeholders like "// TODO" or "// rest of code here". Always produce full, working, production-grade self-contained code.',
    tags: ['code', 'completeness', 'quality', 'production'],
    confidence: 1.0,
    source: 'system',
    createdAt: 1732000000000,
    updatedAt: 1732000000000,
    timesRecalled: 0
  },
  {
    id: 'mem_seed_4',
    category: 'project_fact',
    title: 'Devnexes AI Multi-Engine Architecture',
    content: 'Devnexes AI dynamically coordinates Groq (planning & reasoning), Gemini (Code Canvas), Tavily (web search), and Stability AI (visuals).',
    tags: ['devnexes', 'architecture', 'groq', 'gemini', 'tavily', 'stability'],
    confidence: 1.0,
    source: 'system',
    createdAt: 1732000000000,
    updatedAt: 1732000000000,
    timesRecalled: 0
  },
  {
    id: 'mem_seed_5',
    category: 'lesson_learned',
    title: 'Clean Actionable Trace Nodes Only',
    content: 'Do not generate or display useless filler nodes (understand, plan, update, empty think). Only actual tool actions (code, search, file operations, cmd, image) should appear in the trace tree.',
    tags: ['nodes', 'trace', 'ui', 'react-loop', 'cleanup'],
    confidence: 1.0,
    source: 'system',
    createdAt: 1732000000000,
    updatedAt: 1732000000000,
    timesRecalled: 0
  }
];

const DEFAULT_SETTINGS = {
  autoLearnEnabled: true,
  maxRetrievedMemories: 5,
  minRelevanceThreshold: 0.18
};

// ── In-Memory Cache & Storage Utilities ──────────────────────────────
let cachedMemories = null;
let cachedSettings = null;

export function getMemorySettings() {
  if (cachedSettings) return cachedSettings;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(MEMORY_SETTINGS_KEY);
      if (stored) {
        cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        return cachedSettings;
      }
    }
  } catch {}
  cachedSettings = { ...DEFAULT_SETTINGS };
  return cachedSettings;
}

export function saveMemorySettings(newSettings) {
  try {
    cachedSettings = { ...getMemorySettings(), ...newSettings };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MEMORY_SETTINGS_KEY, JSON.stringify(cachedSettings));
    }
    dispatchMemoryUpdatedEvent();
    return true;
  } catch (err) {
    console.warn('[MemoryRAG] Failed to save settings:', err);
    return false;
  }
}

/**
 * Get all stored memories from localStorage
 */
export function getAllMemories() {
  if (cachedMemories) return cachedMemories;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedMemories = parsed;
          return cachedMemories;
        }
      }
    }
  } catch (err) {
    console.warn('[MemoryRAG] Error reading memories from storage:', err);
  }

  // Pre-seed default memories on first initialization
  cachedMemories = [...DEFAULT_FOUNDATIONAL_MEMORIES];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(cachedMemories));
    }
  } catch {}
  return cachedMemories;
}

/**
 * Save all memories back to localStorage
 */
function persistMemories(memories) {
  cachedMemories = memories;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
    }
    dispatchMemoryUpdatedEvent();
  } catch (err) {
    console.warn('[MemoryRAG] Error saving memories to storage:', err);
  }
}

function dispatchMemoryUpdatedEvent() {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('devnexes-memory-updated', { detail: { count: (cachedMemories || []).length } }));
    } catch {}
  }
}

/**
 * Add or update a memory item
 */
export function saveMemory(item) {
  if (!item || !item.content || !item.content.trim()) return null;

  const memories = getAllMemories();
  const trimmedContent = item.content.trim();
  const trimmedTitle = (item.title || trimmedContent.slice(0, 45) + '...').trim();

  // Deduplication check: check if an identical or near-identical memory already exists
  const existingIdx = memories.findIndex(m => {
    if (item.id && m.id === item.id) return true;
    const sameCategory = m.category === (item.category || 'rule');
    const contentSim = calculateLevenshteinSimilarity(m.content.toLowerCase(), trimmedContent.toLowerCase());
    return sameCategory && contentSim > 0.85;
  });

  const now = Date.now();
  let savedItem = null;

  if (existingIdx !== -1) {
    // Update existing memory
    savedItem = {
      ...memories[existingIdx],
      title: trimmedTitle,
      content: trimmedContent,
      tags: Array.from(new Set([...(memories[existingIdx].tags || []), ...(item.tags || [])])),
      confidence: Math.max(memories[existingIdx].confidence || 0.8, item.confidence || 0.8),
      updatedAt: now
    };
    memories[existingIdx] = savedItem;
  } else {
    // Create new memory
    savedItem = {
      id: item.id || `mem_${now}_${Math.random().toString(36).slice(2, 7)}`,
      category: item.category || 'lesson_learned',
      title: trimmedTitle,
      content: trimmedContent,
      tags: Array.isArray(item.tags) ? item.tags : extractTagsFromText(trimmedContent),
      confidence: item.confidence || 0.9,
      source: item.source || 'auto_extracted',
      conversationId: item.conversationId || null,
      createdAt: now,
      updatedAt: now,
      timesRecalled: 0
    };
    memories.unshift(savedItem);
  }

  persistMemories(memories);
  return savedItem;
}

/**
 * Delete a memory item by ID
 */
export function deleteMemory(id) {
  if (!id) return false;
  const memories = getAllMemories();
  const filtered = memories.filter(m => m.id !== id);
  if (filtered.length !== memories.length) {
    persistMemories(filtered);
    return true;
  }
  return false;
}

/**
 * Clear all memories and optionally restore default foundational memories
 */
export function clearAllMemories(restoreDefaults = false) {
  const newMemories = restoreDefaults ? [...DEFAULT_FOUNDATIONAL_MEMORIES] : [];
  persistMemories(newMemories);
  return newMemories;
}

/**
 * Export memories as JSON file / string
 */
export function exportMemoriesAsJson() {
  const memories = getAllMemories();
  return JSON.stringify(memories, null, 2);
}

/**
 * Import memories from JSON string
 */
export function importMemoriesFromJson(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error('Invalid JSON format: expected an array of memories.');
    const valid = parsed.filter(m => m && m.content && typeof m.content === 'string');
    if (valid.length === 0) throw new Error('No valid memories found in imported data.');

    const current = getAllMemories();
    const merged = [...valid];
    // Keep current items that aren't in incoming
    current.forEach(c => {
      if (!merged.some(m => m.id === c.id || m.content.toLowerCase() === c.content.toLowerCase())) {
        merged.push(c);
      }
    });

    persistMemories(merged);
    return { success: true, count: valid.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── NLP & Keyword Helper Functions ───────────────────────────────────
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'to', 'in', 'for', 'with', 'from', 'as', 'by',
  'that', 'this', 'it', 'be', 'are', 'was', 'were', 'of', 'i', 'me', 'my', 'you', 'your', 'we', 'our',
  'kya', 'hai', 'hain', 'ka', 'ki', 'ke', 'ko', 'se', 'par', 'mein', 'aur', 'ya', 'yeh', 'woh', 'karo', 'karein'
]);

function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s#_@-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function extractTagsFromText(text = '') {
  const words = tokenize(text);
  const commonTech = ['react', 'tailwind', 'css', 'javascript', 'html', 'python', 'c++', 'vite', 'node', 'ui', 'api', 'groq', 'gemini'];
  const matched = commonTech.filter(tech => text.toLowerCase().includes(tech));
  const otherTokens = words.slice(0, 4);
  return Array.from(new Set([...matched, ...otherTokens])).slice(0, 5);
}

function calculateLevenshteinSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  let costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return (longerLength - costs[s2.length]) / longerLength;
}

// ── Memory RAG Hybrid Index Cache ──────────────────────────────────
let memoryBM25Cache = null;
let memoryVectorCache = null;
let memoryCacheHash = '';

function getOrBuildMemoryIndexes(memories) {
  const hash = memories.map(m => m.id + '_' + (m.updatedAt || m.createdAt || 0)).join('|');
  if (memoryBM25Cache && memoryVectorCache && memoryCacheHash === hash) {
    return { bm25: memoryBM25Cache, vector: memoryVectorCache };
  }

  const chunks = memories.map(m => ({
    id: m.id,
    fileName: m.title || 'Knowledge Item',
    heading: m.category || 'general',
    filePath: `memory://${m.category}/${m.id}`,
    lineStart: 1,
    lineEnd: 1,
    content: `${m.title || ''}. ${m.content || ''}. Tags: ${(m.tags || []).join(' ')}`,
    raw: m
  }));

  const bm25 = new BM25Index();
  bm25.buildIndex(chunks);

  const vector = new VectorSpaceIndex();
  vector.buildVectors(chunks);

  memoryBM25Cache = bm25;
  memoryVectorCache = vector;
  memoryCacheHash = hash;

  return { bm25, vector };
}

// ── RAG Semantic Retrieval Engine ────────────────────────────────────

/**
 * Retrieve top relevant memories matching the incoming prompt or context across conversations
 * Uses Okapi BM25 + Vector Cosine Hybrid Search + Intent Boosts
 * 
 * @param {string} queryText - The current user prompt or context
 * @param {Object} options - { limit, minScore, categoryFilter }
 * @returns {Array} - Ranked array of memory objects with relevanceScore
 */
export function retrieveRelevantMemories(queryText = '', options = {}) {
  if (!queryText || typeof queryText !== 'string' || !queryText.trim()) return [];

  const settings = getMemorySettings();
  const limit = options.limit || settings.maxRetrievedMemories || 5;
  const minScore = options.minScore || settings.minRelevanceThreshold || 0.12;
  const categoryFilter = options.categoryFilter || null;

  const memories = getAllMemories();
  if (memories.length === 0) return [];

  const candidateMemories = categoryFilter ? memories.filter(m => m.category === categoryFilter) : memories;
  if (candidateMemories.length === 0) return [];

  const { bm25, vector } = getOrBuildMemoryIndexes(candidateMemories);

  const bm25Results = bm25.search(queryText);
  const vectorResults = vector.search(queryText);

  const bm25Map = new Map();
  bm25Results.forEach((r, rank) => {
    bm25Map.set(r.chunk.id, { score: r.score, rank: rank + 1 });
  });

  const vectorMap = new Map();
  vectorResults.forEach((r, rank) => {
    vectorMap.set(r.chunk.id, { score: r.score, rank: rank + 1 });
  });

  const queryLower = queryText.toLowerCase();

  // Detect domain & intent signals to boost relevant memory categories
  const hasErrorOrCorrection = /\b(error|bug|issue|wrong|fix|galti|fail|mistake|don'?t|avoid|nahin|problem)\b/i.test(queryLower);
  const hasCodeIntent = /\b(code|build|component|script|app|tailwind|react|css|html|python|c\+\+|vite|function|class)\b/i.test(queryLower);
  const hasImageIntent = /\b(image|picture|tasveer|photo|draw|render|generate image|visual|style)\b/i.test(queryLower);
  const hasMetaIntent = /\b(devnexes|who are you|capabilities|modes|ap kaun ho|rules|instructions)\b/i.test(queryLower);

  const scoredMemories = candidateMemories
    .map(mem => {
      const bEntry = bm25Map.get(mem.id);
      const vEntry = vectorMap.get(mem.id);

      // Reciprocal Rank Fusion (RRF)
      const rrfBM25 = bEntry ? (0.55 / (60 + bEntry.rank)) : 0;
      const rrfVector = vEntry ? (0.45 / (60 + vEntry.rank)) : 0;
      let hybridScore = (rrfBM25 + rrfVector) * 100; // Normalized baseline

      // Direct tag bonus
      const memTags = (mem.tags || []).map(t => t.toLowerCase());
      const queryTokens = tokenize(queryText);
      queryTokens.forEach(t => {
        if (memTags.includes(t)) hybridScore += 0.35;
      });

      // Category Intent Boosts
      if (hasErrorOrCorrection && mem.category === 'lesson_learned') hybridScore *= 1.8;
      if (hasCodeIntent && (mem.category === 'tech_stack' || mem.category === 'lesson_learned')) hybridScore *= 1.5;
      if (hasImageIntent && mem.category === 'user_preference' && memTags.some(t => ['image', 'visual', 'render', 'style'].includes(t))) hybridScore *= 2.0;
      if (hasMetaIntent && mem.category === 'project_fact') hybridScore *= 1.6;

      const confidence = mem.confidence || 0.85;
      const finalScore = hybridScore * confidence;

      return {
        ...mem,
        relevanceScore: Number(finalScore.toFixed(3)),
        relevancePercent: Math.min(Math.round(finalScore * 85), 99)
      };
    })
    .filter(mem => mem.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  // Debounced recall counter increment
  if (scoredMemories.length > 0) {
    setTimeout(() => {
      try {
        const all = getAllMemories();
        let changed = false;
        scoredMemories.forEach(sm => {
          const target = all.find(m => m.id === sm.id);
          if (target) {
            target.timesRecalled = (target.timesRecalled || 0) + 1;
            changed = true;
          }
        });
        if (changed) persistMemories(all);
      } catch {}
    }, 500);
  }

  return scoredMemories;
}

/**
 * Format retrieved memories into a clean prompt string for models
 */
export function formatMemoriesForPrompt(memories = []) {
  if (!Array.isArray(memories) || memories.length === 0) return '';

  const lines = memories.map(m => {
    const categoryLabel = m.category.replace('_', ' ').toUpperCase();
    return `• [${categoryLabel}] ${m.title}: ${m.content}`;
  });

  return `[Active Cross-Session Memory & Learned Lessons]\n${lines.join('\n')}\n(Apply these rules strictly and avoid past mistakes)`;
}

// ── Real-Time Self-Learning & Error Extractor ─────────────────────────

/**
 * Analyzes interaction turn to auto-detect user corrections, preferences, or rules
 * "apni galtyo sy bi sikhy and apny ap ko mature karta jay"
 */
export async function analyzeAndLearnFromTurn({
  userPrompt = '',
  assistantResponse = '',
  conversationId = null,
  groqApiKey = null
}) {
  const settings = getMemorySettings();
  if (!settings.autoLearnEnabled) return null;
  if (!userPrompt || userPrompt.trim().length < 5) return null;

  const promptLower = userPrompt.toLowerCase();

  // 1. Instant Pattern-Based Correction / Rule Detector
  const correctionPatterns = [
    // Negative correction: "don't do X", "never use X", "avoid X", "galat hai"
    {
      regex: /(?:don'?t\s+use|do\s+not\s+use|never\s+use|avoid\s+using|stop\s+using|mat\s+use\s+karo|yeh\s+galat\s+hai|galti\s+hui|galat\s+tha)\s+([^.,;\n]+)/i,
      category: 'lesson_learned',
      type: 'negative_rule'
    },
    // Replacement correction: "use X instead of Y", "instead of X use Y"
    {
      regex: /(?:use|prefer|always\s+use|hamesha\s+use\s+karo)\s+([^.,;\n]+)\s+(?:instead\s+of|ke\s+bajaye)\s+([^.,;\n]+)/i,
      category: 'lesson_learned',
      type: 'replacement'
    },
    // Strong preference / rule: "always ...", "remember that ...", "yaad rakhna ..."
    {
      regex: /(?:remember\s+that|please\s+remember|keep\s+in\s+mind|yaad\s+rakhna|hamesha\s+dhyan\s+rakhna|rule:?)\s+([^.\n]+)/i,
      category: 'user_preference',
      type: 'persistent_rule'
    },
    // Explicit constraint: "without comments", "in urdu script", "dark mode"
    {
      regex: /(?:without\s+comments|baghair\s+comments\s+ke|no\s+comments|clean\s+code\s+only)/i,
      category: 'user_preference',
      title: 'Code Formatting Preference',
      content: 'User prefers clean code without conversational inline comments or unnecessary clutter.',
      tags: ['code', 'style', 'comments', 'clean'],
      type: 'direct'
    }
  ];

  for (const pat of correctionPatterns) {
    if (pat.type === 'direct' && pat.regex.test(promptLower)) {
      const saved = saveMemory({
        category: pat.category,
        title: pat.title,
        content: pat.content,
        tags: pat.tags,
        source: 'user_correction',
        conversationId,
        confidence: 0.95
      });
      console.log('[MemoryRAG] Auto-learned direct preference:', saved.title);
      return saved;
    }

    const match = promptLower.match(pat.regex);
    if (match) {
      let content = '';
      let title = '';

      if (pat.type === 'negative_rule') {
        const forbidden = match[1].trim();
        title = `Avoid ${forbidden.slice(0, 30)}`;
        content = `User explicitly corrected: Do not use or avoid "${forbidden}". Follow updated best practices instead.`;
      } else if (pat.type === 'replacement') {
        const preferred = match[1].trim();
        const replaced = match[2].trim();
        title = `Use ${preferred} instead of ${replaced}`;
        content = `User corrected: Use "${preferred}" instead of "${replaced}".`;
      } else if (pat.type === 'persistent_rule') {
        const ruleText = match[1].trim();
        title = ruleText.slice(0, 35) + '...';
        content = `User rule: ${ruleText}.`;
      }

      if (content) {
        const saved = saveMemory({
          category: pat.category,
          title,
          content,
          tags: extractTagsFromText(content),
          source: 'user_correction',
          conversationId,
          confidence: 0.9
        });
        console.log('[MemoryRAG] Auto-learned correction from user:', saved.title);
        return saved;
      }
    }
  }

  // 2. Background AI Distillation (Only if user message looks like feedback and Groq key is present)
  const isFeedbackLike = /\b(wrong|galti|correction|not working|instead|bad|fixed|remember|always|never|rule|preference)\b/i.test(promptLower);
  if (isFeedbackLike && isRealApiKey(groqApiKey)) {
    try {
      distillMemoryWithGroq({ userPrompt, assistantResponse, conversationId, groqApiKey });
    } catch {}
  }

  return null;
}

/**
 * Asynchronous background extractor using lightweight Groq helper model
 */
async function distillMemoryWithGroq({ userPrompt, assistantResponse, conversationId, groqApiKey }) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `You are a memory extractor. If the user provided a persistent correction, preference, or technical rule, extract it into JSON: {"should_save":true,"category":"lesson_learned|tech_stack|user_preference|project_fact","title":"short title","content":"concise 1-2 sentence actionable rule","tags":["tag1","tag2"]}. If it was just regular conversation, return: {"should_save":false}. Reply with ONLY the JSON object.`
          },
          {
            role: 'user',
            content: `User message: "${userPrompt}"\nAssistant response: "${assistantResponse.slice(0, 300)}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) return;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed.should_save && parsed.content) {
      saveMemory({
        category: parsed.category || 'lesson_learned',
        title: parsed.title || parsed.content.slice(0, 35),
        content: parsed.content,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['learned'],
        source: 'ai_distilled',
        conversationId,
        confidence: 0.88
      });
      console.log('[MemoryRAG] Groq background-learned new memory:', parsed.title);
    }
  } catch (err) {
    // Non-blocking background error
  }
}
