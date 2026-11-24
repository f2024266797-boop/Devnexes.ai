import { DETAILED_SKILLS } from '../skills/index.js';
import { planDynamicExecutionGraph, formatConversationHistoryWithIndices, getLatestCodeArtifact, detectCodeIntent, detectCompoundMultiIntent, detectRequestedProgrammingLanguage } from './agentOrchestrator.js';
import { streamGeminiCode, hasGeminiApiKey } from './geminiService.js';
import { executePrioritizedSearch, resolveContextualSearchQuery } from './searchService.js';
import { generateStableDiffusionImage } from './imageService.js';
import { isUrduOrHindi, isRealApiKey } from '../utils/dynamicNLP.js';
import { runDynamicAgent } from './dynamicAgentEngine.js';

// ── Groq Model Configuration ─────────────────────────────────────
export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

/**
 * Format authentic, actual model names matching real AI architectures
 */
export function formatActualModelName(m) {
  const id = typeof m === 'string' ? m : (m?.id || '');
  const rawName = (typeof m === 'object' && m?.name) ? m.name : '';

  if (id === 'qwen/qwen3.8-27b') return 'Qwen 3.8 27B';
  if (id === 'openai/gpt-oss-120b') return 'GPT-OSS 120B';
  if (id === 'openai/gpt-oss-20b') return 'GPT-OSS 20B';
  if (id === 'allam-2-7b') return 'ALLaM 2 7B';
  if (id.includes('allam')) return 'ALLaM 7B';
  if (id === 'llama-3.3-70b-versatile') return 'Llama 3.3 70B Versatile';
  if (id === 'llama-3.1-8b-instant') return 'Llama 3.1 8B Instant';
  if (id === 'llama-3.2-11b-vision-preview') return 'Llama 3.2 11B Vision';
  if (id === 'llama-3.2-90b-vision-preview') return 'Llama 3.2 90B Vision';

  // If Groq provided a clean actual name from the API, clean & use it
  if (rawName && rawName.trim()) {
    return rawName
      .replace(/^canopylabs\//i, '')
      .replace(/^openai\//i, '')
      .replace(/^meta-llama\//i, '')
      .trim();
  }

  // Fallback: format model ID nicely
  const parts = id.split('/');
  const base = parts.pop();
  return base
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const AVAILABLE_MODELS = [
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', vision: true },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', vision: false },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', vision: false }
];

/**
 * Dynamically queries Groq's live /openai/v1/models endpoint using the active key.
 * Strictly filters out moderation/safeguard/whisper/audio models so user never hits tiny 2000 TPM limit.
 */
export async function listLocalModels() {
  const { key } = getAvailableGroqKey();
  if (!key || !isRealApiKey(key)) return AVAILABLE_MODELS;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`
      },
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      const rawModels = data.data || [];
      const valid = rawModels
        .filter(m => m.id &&
          !m.id.includes('whisper') &&
          !m.id.includes('safeguard') &&
          !m.id.includes('guard') &&
          !m.id.includes('tts') &&
          !m.id.includes('orpheus') &&
          !m.id.includes('canopylabs') &&
          m.active !== false
        )
        .map(m => {
          const isVision = m.id.includes('vision') || m.id.includes('qwen') || m.id.includes('vl');
          return {
            id: m.id,
            name: formatActualModelName(m),
            vision: isVision
          };
        });

      // Priority ordering: Qwen 3.8 27B first, then GPT-OSS 120B, then GPT-OSS 20B, then others
      valid.sort((a, b) => {
        if (a.id === 'qwen/qwen3.8-27b') return -1;
        if (b.id === 'qwen/qwen3.8-27b') return 1;
        if (a.id === 'openai/gpt-oss-120b') return -1;
        if (b.id === 'openai/gpt-oss-120b') return 1;
        if (a.id === 'openai/gpt-oss-20b') return -1;
        if (b.id === 'openai/gpt-oss-20b') return 1;
        return a.name.localeCompare(b.name);
      });

      if (valid.length > 0) return valid;
    }
  } catch (err) {
    console.warn('[Groq Models] Could not fetch live models:', err.message);
  }

  return AVAILABLE_MODELS;
}

// ── Multi-Key Management for Groq (3 API Keys with Failover) ─────
const groqKeyCooldowns = { 0: 0, 1: 0, 2: 0 };
let activeGroqKeyIndex = 0;

export function getGroqApiKeys() {
  const envKeys = [
    import.meta.env?.VITE_GROQ_API_KEY_1 || import.meta.env?.GROQ_API_KEY_1 || '',
    import.meta.env?.VITE_GROQ_API_KEY_2 || import.meta.env?.GROQ_API_KEY_2 || '',
    import.meta.env?.VITE_GROQ_API_KEY_3 || import.meta.env?.GROQ_API_KEY_3 || ''
  ];
  const singleLegacy = import.meta.env?.VITE_GROQ_API_KEY || import.meta.env?.GROQ_API_KEY || '';

  return [0, 1, 2].map(idx => {
    try {
      const stored = localStorage.getItem(`devnexes_groq_key_${idx + 1}`);
      if (stored && isRealApiKey(stored)) return stored.trim();
    } catch { }
    if (envKeys[idx] && isRealApiKey(envKeys[idx])) return envKeys[idx].trim();
    if (idx === 0 && singleLegacy && isRealApiKey(singleLegacy)) return singleLegacy.trim();
    return '';
  });
}

export function saveGroqApiKeys(keys) {
  if (!Array.isArray(keys)) return;
  keys.forEach((key, idx) => {
    try {
      if (typeof key === 'string' && key.trim()) {
        localStorage.setItem(`devnexes_groq_key_${idx + 1}`, key.trim());
      } else {
        localStorage.removeItem(`devnexes_groq_key_${idx + 1}`);
      }
    } catch { }
  });
}

export function hasGroqApiKey() {
  return getGroqApiKeys().some(k => Boolean(k && k.trim()));
}

export function getGroqKeysStatus() {
  const keys = getGroqApiKeys();
  const now = Date.now();
  return keys.map((key, idx) => ({
    index: idx + 1,
    configured: Boolean(key && key.trim()),
    isActive: idx === activeGroqKeyIndex,
    inCooldown: groqKeyCooldowns[idx] > now,
    cooldownRemainingMs: Math.max(0, groqKeyCooldowns[idx] - now),
    maskedKey: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : 'Not configured'
  }));
}

export function markGroqKeyCooldown(index, errorBody = '') {
  if (index >= 0 && index < 3) {
    let duration = 12 * 1000; // 12s default cooldown instead of 60s
    const match = String(errorBody).match(/try again in ([0-9.]+)s/i);
    if (match && match[1]) {
      duration = Math.ceil(parseFloat(match[1]) * 1000) + 1500;
    }
    groqKeyCooldowns[index] = Date.now() + duration;
    console.warn(`[Groq Failover] Key #${index + 1} marked in cooldown for ${Math.round(duration / 1000)}s`);
  }
}

export function getAvailableGroqKey() {
  const keys = getGroqApiKeys();
  const now = Date.now();

  if (keys[activeGroqKeyIndex] && groqKeyCooldowns[activeGroqKeyIndex] <= now) {
    return { key: keys[activeGroqKeyIndex], index: activeGroqKeyIndex };
  }

  for (let offset = 1; offset <= 3; offset++) {
    const candidateIdx = (activeGroqKeyIndex + offset) % 3;
    if (keys[candidateIdx] && groqKeyCooldowns[candidateIdx] <= now) {
      activeGroqKeyIndex = candidateIdx;
      console.info(`[Groq Failover] Switched to Key #${activeGroqKeyIndex + 1}`);
      return { key: keys[activeGroqKeyIndex], index: activeGroqKeyIndex };
    }
  }

  let bestIdx = -1;
  let minCooldown = Infinity;
  keys.forEach((key, idx) => {
    if (key && groqKeyCooldowns[idx] < minCooldown) {
      minCooldown = groqKeyCooldowns[idx];
      bestIdx = idx;
    }
  });

  if (bestIdx !== -1) {
    activeGroqKeyIndex = bestIdx;
    return { key: keys[bestIdx], index: bestIdx, warnCooldown: true };
  }

  return { key: null, index: -1 };
}

function isGroqRateLimitError(status, errorBody = '') {
  if (status === 429) return true;
  const lower = String(errorBody).toLowerCase();
  return (
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('tokens per minute') ||
    lower.includes('tpm') ||
    lower.includes('rpm') ||
    lower.includes('quota') ||
    lower.includes('too many requests')
  );
}

function isGroqModelNotFoundError(errorBody = '') {
  const lower = String(errorBody).toLowerCase();
  return (
    lower.includes('model_not_found') ||
    lower.includes('model_decommissioned') ||
    lower.includes('does not exist or you do not have access to it') ||
    lower.includes('has been decommissioned')
  );
}

function isGroqSafeguardOrRestrictedModel(model = '', errorBody = '') {
  const lower = (model + ' ' + errorBody).toLowerCase();
  return (
    lower.includes('safeguard') ||
    lower.includes('guard') ||
    lower.includes('orpheus') ||
    lower.includes('canopylabs') ||
    lower.includes('whisper') ||
    lower.includes('tts') ||
    lower.includes('terms') ||
    lower.includes('model_terms_required') ||
    lower.includes('limit 2000') ||
    lower.includes('request too large for model')
  );
}

// ── Normalize Messages for Groq / OpenAI API format ───────────────
function normalizeGroqMessage(msg) {
  const role = msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';
  let rawContent = typeof msg.content === 'string' ? msg.content : '';

  // Sanitize raw text to strip huge base64 strings so Groq ITPM (7000 limit) never explodes
  if (rawContent.includes('data:image/')) {
    rawContent = rawContent.replace(/data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]{60,}/g, '[Attached Image]');
  }

  if (msg.images && msg.images.length > 0) {
    const content = [{ type: 'text', text: rawContent }];
    msg.images.forEach(img => {
      if (typeof img === 'string') {
        const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
        content.push({ type: 'image_url', image_url: { url } });
      }
    });
    return { role, content };
  }
  return { role, content: rawContent };
}

export function getSafeMaxTokens(modelId, requestedTokens) {
  const req = Number(requestedTokens);
  if (req && req > 0) {
    return Math.min(req, 4096);
  }
  if (modelId && (modelId.includes('qwen') || modelId.includes('27b') || modelId.includes('gpt-oss') || modelId.includes('allam'))) {
    return 600;
  }
  return 1200;
}

/**
 * Non-streaming Groq Chat Completion with 3-Key Failover, Token Clamping & Self-Healing Fallback
 */
export async function callGroqChatJson({
  messages,
  maxTokens,
  model = DEFAULT_GROQ_MODEL,
  responseFormatJson = true,
  temperature = 0.1,
  signal
}) {
  const keys = getGroqApiKeys();
  const configuredCount = keys.filter(Boolean).length;
  if (configuredCount === 0) {
    throw new Error('No Groq API key configured. Please configure your Groq key in Settings or .env.');
  }

  // Force safe flagship model if a safeguard or deprecated model was passed
  let currentModel = model;
  if (isGroqSafeguardOrRestrictedModel(currentModel)) {
    currentModel = DEFAULT_GROQ_MODEL;
  }

  let attempts = 0;
  const maxAttempts = Math.max(configuredCount * 2, 4);
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts++;
    const { key, index } = getAvailableGroqKey();
    if (!key) throw new Error('All Groq API keys are exhausted.');

    try {
      const bodyPayload = {
        model: currentModel,
        messages: messages.map(normalizeGroqMessage),
        temperature,
        stream: false,
        max_tokens: getSafeMaxTokens(currentModel, maxTokens)
      };
      if (responseFormatJson) {
        bodyPayload.response_format = { type: 'json_object' };
      }

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(bodyPayload),
        signal: signal || AbortSignal.timeout(12000)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        const err = new Error(`Groq API error (Key #${index + 1}): ${errText}`);
        err.status = res.status;
        if (res.status === 401) throw err; // Fail fast on invalid key, no retry delay
        throw err;
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw err;
      if (err.status === 401) throw err; // Invalid API key: stop immediately, no retry lag

      // Self-healing: if OTPM exceeded, clamp token count down to 180-250 and rotate key
      if (err.message && (err.message.includes('OTPM') || err.message.includes('output tokens per minute'))) {
        const nextClamped = Math.max(160, Math.floor((maxTokens || 380) * 0.45));
        console.warn(`[Groq Rate Failover] Model "${currentModel}" OTPM limit exceeded. Clamping max_tokens from ${maxTokens} to ${nextClamped} and rotating key...`);
        maxTokens = nextClamped;
        markGroqKeyCooldown(index, err.message);
        continue;
      }

      // Self-healing: if ITPM or 413 Payload Too Large, prune messages payload
      if (err.status === 413 || err.message?.includes('ITPM') || err.message?.includes('input tokens per minute') || err.message?.includes('Request too large') || err.message?.includes('limit 7000') || err.message?.includes('limit 8000')) {
        console.warn(`[Groq Rate Failover] Model "${currentModel}" ITPM (413) limit exceeded. Pruning message payloads and rotating key...`);
        messages = messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string'
            ? m.content.replace(/data:image\/[^\s'"]+/g, '[Image]').slice(0, 1000)
            : m.content
        }));
        markGroqKeyCooldown(index, err.message);
        if (currentModel !== 'openai/gpt-oss-120b') {
          currentModel = 'openai/gpt-oss-120b';
        }
        continue;
      }

      // Self-healing: if model not found or safeguard limit, auto-switch to DEFAULT_GROQ_MODEL
      if ((isGroqModelNotFoundError(err.message) || isGroqSafeguardOrRestrictedModel(currentModel, err.message)) && currentModel !== DEFAULT_GROQ_MODEL) {
        console.warn(`[Groq Model Fallback] Model "${currentModel}" is invalid or restricted. Auto-switching to "${DEFAULT_GROQ_MODEL}"...`);
        currentModel = DEFAULT_GROQ_MODEL;
        attempts = 0;
        try { localStorage.setItem('devnexes_selected_model', DEFAULT_GROQ_MODEL); } catch { }
        continue;
      }

      if (isGroqRateLimitError(err.status, err.message)) {
        console.warn(`[Groq Failover] Key #${index + 1} hit rate limit in JSON call. Rotating to next key...`);
        markGroqKeyCooldown(index, err.message);

        if (currentModel === 'qwen/qwen3.8-27b' && attempts >= configuredCount) {
          console.warn(`[Groq Failover] Switching to "openai/gpt-oss-120b"...`);
          currentModel = 'openai/gpt-oss-120b';
          attempts = 0;
          continue;
        } else if (currentModel === 'openai/gpt-oss-120b' && attempts >= configuredCount) {
          console.warn(`[Groq Failover] Switching to "openai/gpt-oss-20b"...`);
          currentModel = 'openai/gpt-oss-20b';
          attempts = 0;
          continue;
        }
      } else {
        if (attempts >= configuredCount) throw err;
      }
    }
  }

  throw lastError || new Error('All Groq keys failed.');
}

/**
 * Streaming Groq Chat with 3-Key Automatic Failover, Token Clamping & Self-Healing Model Fallback
 */
export async function streamGroqChat({
  messages,
  model = DEFAULT_GROQ_MODEL,
  onChunk,
  onError,
  maxTokens,
  signal
}) {
  const keys = getGroqApiKeys();
  const configuredCount = keys.filter(Boolean).length;
  if (configuredCount === 0) {
    throw new Error('No Groq API key configured. Please configure your Groq key in Settings or .env.');
  }

  // Force safe flagship model if a safeguard or deprecated model was passed
  let currentModel = model;
  if (isGroqSafeguardOrRestrictedModel(currentModel)) {
    currentModel = DEFAULT_GROQ_MODEL;
  }

  let attempts = 0;
  const maxAttempts = Math.max(configuredCount * 2, 4);
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts++;
    const { key, index } = getAvailableGroqKey();
    if (!key) throw new Error('All Groq API keys are currently exhausted.');

    try {
      const result = await executeSingleGroqStream({
        key,
        keyIndex: index,
        messages,
        model: currentModel,
        maxTokens,
        onChunk,
        signal
      });
      return result;
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw err;
      if (err.status === 401) throw err; // Invalid API key: stop immediately, no retry lag

      // Self-healing: if OTPM exceeded, clamp token count down to 180-250 and rotate key
      if (err.message && (err.message.includes('OTPM') || err.message.includes('output tokens per minute'))) {
        const nextClamped = Math.max(160, Math.floor((maxTokens || 380) * 0.45));
        console.warn(`[Groq Rate Failover] Model "${currentModel}" OTPM limit exceeded. Clamping max_tokens from ${maxTokens} to ${nextClamped} and rotating key...`);
        maxTokens = nextClamped;
        markGroqKeyCooldown(index, err.message);
        continue;
      }

      // Self-healing: if ITPM or 413 Payload Too Large, prune messages payload
      if (err.status === 413 || err.message?.includes('ITPM') || err.message?.includes('input tokens per minute') || err.message?.includes('Request too large') || err.message?.includes('limit 7000') || err.message?.includes('limit 8000')) {
        console.warn(`[Groq Rate Failover] Model "${currentModel}" ITPM (413) limit exceeded. Pruning message payloads and rotating key...`);
        messages = messages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string'
            ? m.content.replace(/data:image\/[^\s'"]+/g, '[Image]').slice(0, 1000)
            : m.content
        }));
        markGroqKeyCooldown(index, err.message);
        if (currentModel !== 'openai/gpt-oss-120b') {
          currentModel = 'openai/gpt-oss-120b';
        }
        continue;
      }

      // Self-healing: if model not found or safeguard limit, auto-switch to DEFAULT_GROQ_MODEL
      if ((isGroqModelNotFoundError(err.message) || isGroqSafeguardOrRestrictedModel(currentModel, err.message)) && currentModel !== DEFAULT_GROQ_MODEL) {
        console.warn(`[Groq Model Fallback] Model "${currentModel}" is invalid or restricted. Auto-switching to "${DEFAULT_GROQ_MODEL}"...`);
        currentModel = DEFAULT_GROQ_MODEL;
        attempts = 0;
        try { localStorage.setItem('devnexes_selected_model', DEFAULT_GROQ_MODEL); } catch { }
        continue;
      }

      if (isGroqRateLimitError(err.status, err.message)) {
        console.warn(`[Groq Failover] Key #${index + 1} hit rate limit: ${err.message}. Rotating to next Groq key...`);
        markGroqKeyCooldown(index, err.message);

        // Auto failover across available models
        if (currentModel === 'qwen/qwen3.8-27b' && attempts >= configuredCount) {
          console.warn(`[Groq Failover] Model "${currentModel}" hit rate limit across keys. Switching to "openai/gpt-oss-120b"...`);
          currentModel = 'openai/gpt-oss-120b';
          attempts = 0;
          continue;
        } else if (currentModel === 'openai/gpt-oss-120b' && attempts >= configuredCount) {
          console.warn(`[Groq Failover] Switching to "openai/gpt-oss-20b"...`);
          currentModel = 'openai/gpt-oss-20b';
          attempts = 0;
          continue;
        }
      } else {
        if (attempts >= configuredCount) {
          if (onError) onError(err);
          throw err;
        }
      }
    }
  }

  if (onError) onError(lastError);
  throw lastError || new Error('All Groq API keys failed.');
}

async function executeSingleGroqStream({
  key,
  keyIndex,
  messages,
  model,
  maxTokens,
  onChunk,
  signal
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Groq took too long to respond.')), 90000);
  const abortFromCaller = () => controller.abort(signal?.reason || new DOMException('Generation stopped', 'AbortError'));
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map(normalizeGroqMessage),
        stream: true,
        temperature: 0.2,
        max_tokens: getSafeMaxTokens(model, maxTokens)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      const err = new Error(`Groq error (Key #${keyIndex + 1}): ${errText}`);
      err.status = response.status;
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    const consumeLine = (line) => {
      if (!line.startsWith('data:')) return;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === '[DONE]') return;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk?.(delta, fullText);
        }
      } catch { }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let lineEndIdx;
      while ((lineEndIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEndIdx).trim();
        buffer = buffer.slice(lineEndIdx + 1);
        if (line) consumeLine(line);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      consumeLine(buffer.trim());
    }

    return fullText;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function cleanMetaPlanningPreamble(text) {
  if (!text) return '';
  return text
    .replace(/^The user wants\b[\s\S]*?(?:Plan Strategy\b[\s\S]*?Success Goal\b[\s\S]*?\n\n|Success Goal\b[\s\S]*?\n\n)/i, '')
    .replace(/^Plan Strategy\b[\s\S]*?Success Goal\b[\s\S]*?\n\n/i, '')
    .replace(/^Stage\s*\d+:[\s\S]*?Success Goal[\s\S]*?\n\n/i, '')
    .trimStart();
}

/**
 * Filter out technical fluff, raw HTML, external URLs, parameter dumps, and checklists
 * when presenting an image deliverable.
 */
export function sanitizeImageResponse(text) {
  if (!text) return '';

  // Intercept any model LLM refusal when image was requested or synthesized
  if (/(?:I'm sorry, but I can't provide that image|I'm sorry, but I can't create or provide|I cannot create or provide|I cannot generate images|as an ai I cannot|I am unable to provide the official logo|can't provide that image|cannot generate or create images|restricted from producing visual content|as an ai text model|cannot generate.*images|cannot create.*images|as an ai, i am restricted)/i.test(text)) {
    return 'Ye rahi aap ki image.';
  }

  return text
    .replace(/<div[\s\S]*?<\/div>/gi, '')
    .replace(/<img[\s\S]*?>/gi, '')
    .replace(/!\[.*?\]\([^)]*\)/gi, '')
    .replace(/https?:\/\/[^\s)]*pollinations\.ai[^\s)]*/gi, '')
    .replace(/\[Download\]\([^)]*\)/gi, '')
    .replace(/(?:Prompt used \(ready for reuse\)|Negative prompt\b|Quick checklist for reproducing|CFG scale\b|Steps 50-70|Feel free to reuse|Key APIs & services|Diffusion models \(e\.g\.|Prompt for Image Generation:)[\s\S]*/gi, '')
    .replace(/\b(?:jo Stable Diffusion (?:1\.5|XL)?(?: 1\.0)? se generate ki gayi hai|synthesized using Stable Diffusion (?:1\.5|XL)?(?: 1\.0)?|using Stable Diffusion (?:1\.5|XL)?(?: 1\.0)?|via Stable Diffusion (?:1\.5|XL)?(?: 1\.0)?|se generate ki gayi hai|jo stable diffusion se generate ki gayi hai)\b/gi, '')
    .replace(/\b(?:Stable Diffusion(?: XL)?(?: 1\.0| 1\.5)?|SDXL(?: 1\.0)?|Stability AI)\b/gi, '')
    .replace(/\b(?:Here is your requested image\.|Ye rahi aap ki requested image\.)\b/gi, 'Aap ki image tayyar hai.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Prioritized Real-Time Search wrapper
 */
export async function realTavilySearch(query, { signal } = {}) {
  return executePrioritizedSearch(query, { signal });
}

export function cleanCodeContent(code) {
  if (!code) return '';
  return code
    .replace(/^```[a-zA-Z0-9_-]*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

/**
 * DYNAMIC AGENT PIPELINE:
 * Delegates directly to the autonomous Dynamic Agent Engine:
 * - Single-call Mode Tag Intake (instant stream for general asks, JSON khaka for tasks)
 * - Single-pass Vision Extraction via Qwen (images never re-sent to save tokens)
 * - Dynamic Loop & Notebook Engine with 7-Question Usefulness Gate
 * - Helper Compactor & Classifier via GPT-OSS 20B (or Llama 3.1 8B Instant)
 * - Main Brain via GPT-OSS 120B (or Llama 3.3 70B / Qwen 27B)
 * - Natural updates (silent on light tasks, brief on heavy tasks)
 * - Question pause & resume (state saved in notebook, 20B intent classification on user reply)
 * - Single-call Artifact Stitching and Synthesis
 * - 100% Dynamic NLP (zero hardcoded word lists or static dictionaries)
 */
export async function generateDynamicAgentPipeline({
  userPrompt,
  userImage = null,
  model = DEFAULT_GROQ_MODEL,
  onStepUpdate,
  onChunk,
  onError,
  messagesHistory = [],
  forceWebSearch = false,
  forceCanvasCode = false,
  isFromImageStudio = false,
  activeCanvasCode = null,
  activeCanvasLanguage = null,
  workspace = null,
  workspaceMeta = null,
  convId = null,
  signal
}) {
  try {
    return await runDynamicAgent({
      userPrompt,
      userImage,
      messagesHistory,
      forceWebSearch,
      forceCanvasCode,
      isFromImageStudio,
      workspace,
      workspaceMeta,
      activeCanvasCode,
      activeCanvasLanguage,
      convId,
      onStepUpdate,
      onChunk,
      signal
    });
  } catch (err) {
    if (onError) onError(err);
    throw err;
  }
}
