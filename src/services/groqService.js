import { DETAILED_SKILLS } from '../skills/index.js';
import { planDynamicExecutionGraph, formatConversationHistoryWithIndices, getLatestCodeArtifact, detectCodeIntent, detectCompoundMultiIntent, detectRequestedProgrammingLanguage } from './agentOrchestrator.js';
import { streamGeminiCode, hasGeminiApiKey } from './geminiService.js';
import { executePrioritizedSearch, resolveContextualSearchQuery } from './searchService.js';
import { generateStableDiffusionImage } from './imageService.js';

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
  if (!key) return AVAILABLE_MODELS;

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
      if (stored && stored.trim()) return stored.trim();
    } catch { }
    if (envKeys[idx] && envKeys[idx].trim()) return envKeys[idx].trim();
    if (idx === 0 && singleLegacy && singleLegacy.trim()) return singleLegacy.trim();
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
  // On-demand tier models (qwen 27b, gpt-oss) have a strict 1,000 OTPM ceiling.
  // Clamping requested tokens to 380-420 guarantees headroom and eliminates 429 OTPM rejections.
  if (modelId && (modelId.includes('qwen') || modelId.includes('27b') || modelId.includes('gpt-oss') || modelId.includes('allam'))) {
    return req ? Math.min(req, 420) : 380;
  }
  return req ? Math.min(req, 1200) : 600;
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
        signal: signal || AbortSignal.timeout(30000)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        const err = new Error(`Groq API error (Key #${index + 1}): ${errText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw err;

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
 * - Groq handles: DAG Planning, Thinking, Text Chat, Commands (CMD/CLI), Analysis, Synthesis.
 *   STRICT RESTRICTION: Groq is FORBIDDEN from generating application source code.
 * - Code Generation & Error Fixing:
 *     100% Dedicated to Google Gemini (with 3-key rotation & failover).
 * - Prioritized Search: Tavily -> Brave -> DuckDuckGo + Wikipedia.
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
  signal
}) {
  // Sanitize model to prevent safeguard/decommissioned models from being called
  const safeModel = isGroqSafeguardOrRestrictedModel(model) ? DEFAULT_GROQ_MODEL : (model || DEFAULT_GROQ_MODEL);

  // Compact conversation history to prevent TPM limits on on-demand Groq tiers
  const historyArchive = formatConversationHistoryWithIndices(messagesHistory);
  const pastContext = historyArchive ? [
    {
      role: 'system',
      content: `CONVERSATION ARCHIVE (${messagesHistory.length} total messages):\n${historyArchive.slice(-1200)}`
    }
  ] : [];

  // ── STAGE 0: Plan execution graph with Groq Flagship ────────────
  const plan = await planDynamicExecutionGraph({
    prompt: userPrompt,
    image: userImage,
    model: safeModel,
    messagesHistory,
    forceWebSearch,
    forceCanvasCode,
    isFromImageStudio,
    activeCanvasCode,
    activeCanvasLanguage,
    signal
  });

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

  // Interactive Clarification - strictly delivered to ChatInput dock, NOT written into chat messages list
  if (plan.needsClarification && plan.clarification && !userImage) {
    const clar = plan.clarification;
    return { hasCode: false, needsClarification: true, clarification: clar };
  }

  // Capability refusal check
  if (plan.cannotPerform && !userImage) {
    const refusalText = plan.cannotPerformReason || 'I cannot perform this task.';
    const steps = [
      { id: 'node_refusal', name: 'Capability Boundary Check', type: 'cannot_perform', status: 'completed', content: refusalText },
      { type: 'response', content: refusalText }
    ];
    if (onStepUpdate) onStepUpdate(steps);
    if (onChunk) onChunk(refusalText, refusalText);
    return { hasCode: false };
  }

  // Pure conversation / Greeting -> Instant direct Groq stream
  if (!forceWebSearch && !forceCanvasCode && !userImage &&
    (plan.intentCategory === 'GREETING' || plan.intentCategory === 'CONVERSATION' || !plan.nodes || plan.nodes.length === 0)) {
    const steps = [{ type: 'response', content: '' }];
    if (onStepUpdate) onStepUpdate(steps, true);

    await streamGroqChat({
      messages: [
        {
          role: 'system',
          content: `You are Devnexes AI — a helpful, highly accurate, and intelligent AI assistant.
Answer the user's prompt directly, naturally, and concisely in the user's language (English, Roman Urdu, or Urdu).
If the user asks whether you can generate images or logos (e.g. "image generation?", "image generate kar skty ho"), confirm warmly in 1-2 sentences that you CAN generate photorealistic 8K images, digital art, portraits, and brand logos directly. Ask them what they would like you to create.
CRITICAL RESTRICTION: Do NOT dump technical lectures on diffusion models, GANs, APIs, Python code, or tutorials unless specifically asked.
CODE REVIEW RESTRICTION: If the user provides code containing errors or asks to identify defects/bugs, ONLY diagnose and explain the errors with clear line references. DO NOT rewrite or output the entire corrected code unsolicited! Full code implementations belong exclusively in Code Canvas (Side Bar) when requested.`
        },
        ...pastContext,
        { role: 'user', content: userPrompt }
      ],
      model: safeModel,
      signal,
      onChunk: (delta, fullText) => {
        steps[0].content = fullText;
        if (onStepUpdate) onStepUpdate([...steps], true);
        if (onChunk) onChunk(delta, fullText);
      },
      onError
    });
    return { hasCode: false };
  }

  // ── STAGE 1: Build trace tree ──────────────────────────────────
  const activeSkill = DETAILED_SKILLS[plan.skillId] || DETAILED_SKILLS['web-research-analyst'];

  if (forceWebSearch && !plan.nodes.some(n => n.type === 'search' || /search|research/i.test(n.type))) {
    const cleanQuery = userPrompt.replace(/google py|google pe|search karo|dhoondo|btao/gi, '').trim() || userPrompt;
    plan.nodes.unshift({
      id: 'node_forced_search', name: 'Real-Time Web Grounding', type: 'search',
      task: `Execute real-time web search for: "${cleanQuery}"`,
      inputFrom: [], canParallel: false, executionStage: 1, searchQuery: cleanQuery
    });
  }

  if (forceCanvasCode && !plan.nodes.some(n => n.type === 'code' || /code|artifact|build/i.test(n.type))) {
    const isHtml = /\b(html|css|website|dashboard|ui|ecommerce|react|store|canvas|frontend)\b/i.test(userPrompt);
    plan.nodes.push({
      id: 'node_forced_canvas_code',
      name: isHtml ? 'Interactive Canvas UI' : 'Canvas Code Implementation',
      type: 'code',
      task: `Generate 100% complete, standalone runnable code for: "${userPrompt}" into Code Canvas`,
      inputFrom: plan.nodes.map(n => n.id), canParallel: false,
      executionStage: plan.nodes.length + 1,
      artifactLanguage: isHtml ? 'html' : 'python',
      artifactTitle: userPrompt.slice(0, 36)
    });
  }

  const traceSteps = [];
  traceSteps.push({
    id: 'node_thinking_plan', name: 'Dynamic Graph Architecture', type: 'thinking', status: 'completed',
    content: plan.thinkingSummary || (userImage ? 'Image uploaded. Inspecting visual components...' : 'Processing request.'),
    executionPlanSummary: plan.executionPlanSummary || null,
    doneStateCriteria: plan.doneStateCriteria || null,
    totalPlannedNodes: plan.nodes.length,
    isStreaming: false
  });
  traceSteps.push({ type: 'response', content: '' });
  if (onStepUpdate) onStepUpdate([...traceSteps]);

  const nodeOutputs = {};
  let hasCode = false;

  // ── STAGE 2: Execute DAG Nodes ─────────────────────────────────
  const stages = Array.from(new Set(plan.nodes.map(n => n.executionStage || 1))).sort((a, b) => a - b);

  const executeNode = async (nodeConfig) => {
    const activeNode = {
      id: nodeConfig.id, name: nodeConfig.name, type: nodeConfig.type, status: 'running',
      task: nodeConfig.task, image: nodeConfig.type === 'vision' ? userImage : null,
      inputFrom: nodeConfig.inputFrom || [], canParallel: !!nodeConfig.canParallel,
      executionStage: nodeConfig.executionStage || 1, content: '', code: '',
      language: nodeConfig.artifactLanguage || 'html', title: nodeConfig.artifactTitle || nodeConfig.name,
      query: nodeConfig.searchQuery || null, results: [], isStreaming: true
    };

    const respIdx = traceSteps.findIndex(s => s.type === 'response');
    if (respIdx !== -1) traceSteps.splice(respIdx, 0, activeNode);
    else traceSteps.push(activeNode);
    if (onStepUpdate) onStepUpdate([...traceSteps]);

    // Gather all deliverables from preceding dependent nodes (Strict Chain of Custody)
    const precedingOutputs = (nodeConfig.inputFrom || [])
      .map(depId => {
        const out = nodeOutputs[depId];
        const prevStep = traceSteps.find(s => s.id === depId);
        const name = prevStep?.name || depId;
        return out ? `=== PRECEDING STAGE COMPLETED: [${name}] ===\n${out}` : null;
      })
      .filter(Boolean).join('\n\n');

    // Auto-fallback: if inputFrom was empty but prior execution steps finished, attach them
    const completedPreceding = traceSteps.filter(s => s.status === 'completed' && s.id !== activeNode.id && s.type !== 'response' && s.type !== 'thinking');
    const dependencyContexts = precedingOutputs || (completedPreceding.length > 0
      ? completedPreceding.map(s => {
        const out = nodeOutputs[s.id] || s.content || s.code;
        return out ? `=== PRECEDING STAGE COMPLETED: [${s.name}] ===\n${out}` : null;
      }).filter(Boolean).join('\n\n')
      : '');

    const getNodeIdx = () => traceSteps.findIndex(s => s.id === activeNode.id);

    try {
      const isSearchType = /search|research|lookup|google/i.test(activeNode.type);
      const isCodeType = /code|artifact|implementation|build|coding|develop/i.test(activeNode.type);
      const isCmdType = /cmd|terminal|cli|command|runner|powershell/i.test(activeNode.type);
      const isImageType = /^(?:image|sd|diffusion|art_generation)$/i.test(activeNode.type) || activeNode.type === 'image' || activeNode.name?.toLowerCase().includes('stable diffusion');
      const isVisionType = !isImageType && /vision|ocr/i.test(activeNode.type);

      // ── 1. CODE GENERATION NODE -> EXCLUSIVELY GOOGLE GEMINI (GROQ STRICTLY FORBIDDEN FROM WRITING CODE) ──
      if (isCodeType) {
        hasCode = true;
        const latestArtifact = getLatestCodeArtifact(messagesHistory, activeCanvasCode, activeCanvasLanguage);
        const codeIntent = detectCodeIntent({
          prompt: userPrompt,
          hasExistingArtifact: Boolean(latestArtifact?.code),
          hasImage: Boolean(userImage),
          latestArtifact,
          forceCanvasCode,
          messagesHistory
        });

        // ── Authoritative Target Language Resolution ──
        const detectedPromptLang = detectRequestedProgrammingLanguage(userPrompt);
        let lang = activeNode.artifactLanguage || activeNode.language || detectedPromptLang || codeIntent.targetLanguage;
        if (!lang) {
          lang = (codeIntent.isIncrementalEdit && latestArtifact?.language) ? latestArtifact.language : 'html';
        }

        // If this is a CODE_FIX or language switched, strictly prevent incremental hijack of unrelated artifact!
        const isIncrementalEdit = Boolean(
          codeIntent.isIncrementalEdit &&
          codeIntent.intent !== 'CODE_FIX' &&
          latestArtifact?.language &&
          latestArtifact.language.toLowerCase() === lang.toLowerCase()
        );

        activeNode.language = lang;
        activeNode.artifactLanguage = lang;

        let codeSystemPrompt = '';
        let codeUserPrompt = '';

        if (isIncrementalEdit) {
          codeSystemPrompt = `${activeSkill.systemPrompt}

You are the Dedicated Senior Code Architect for Devnexes AI executing code via Google Gemini.
You are executing Node: "${activeNode.name}".
Task: ${activeNode.task}
Target Language: ${lang}

CRITICAL RULES FOR INCREMENTAL CODE UPDATE:
1. STRICT PRESERVATION INVARIANT:
   - The user ALREADY HAS an existing, working ${lang.toUpperCase()} application shown below.
   - You MUST STRICTLY PRESERVE 100% of all existing components, styling, layout, HTML tags, CSS rules, JavaScript functions, images, and content from that existing code.
   - STRICT PROHIBITION: DO NOT rewrite the code from scratch! DO NOT replace the layout with a new template! DO NOT delete or wipe any existing sections!
   - Every single existing section, style block, script, and feature must remain intact in the final code.

2. SURGICAL MODIFICATION:
   - Identify the EXACT location in the existing code where the user's requested modification belongs.
   - Apply ONLY the user's requested additions, fixes, style changes, or modifications directly inside that exact location in the existing code.
   - If an image is provided, integrate it into a suitable component (e.g. <img> tag or card) within the existing design.

3. COMPLETE RUNNABLE OUTPUT:
   - Output the ENTIRE updated ${lang.toUpperCase()} source file from the very first line to the very last line, with the changes cleanly incorporated.
   - Start IMMEDIATELY with the markdown code fence: \`\`\`${lang}
   - NO placeholders, NO "<!-- existing code unchanged -->", NO partial snippets. Return the full runnable code.
   - End cleanly with \`\`\`.`;

          codeUserPrompt = `[SURGICAL INCREMENTAL CODE UPDATE]:
The user wants to make a modification to their EXISTING ${latestArtifact.language.toUpperCase()} application below.
DO NOT regenerate from scratch! KEEP all existing components, content, structure, styles, cards, and logic.
Apply the user's requested changes directly into this existing code.

=== USER'S REQUESTED MODIFICATION ===
"${userPrompt}"

=== SPECIFIC TARGET TASK ===
${activeNode.task}
${dependencyContexts ? `\n=== TARGETED INTEGRATION SPECIFICATION ===\n${dependencyContexts}\n\nSTRICT INSTRUCTION: Apply ONLY the targeted changes described in the specification into the existing code below. Keep all other sections of the existing code exactly as they are.\n` : ''}
=== CURRENT EXISTING CODE (PRESERVE & MODIFY) ===
\`\`\`${latestArtifact.language}
${latestArtifact.code}
\`\`\`

Return the COMPLETE updated ${latestArtifact.language} code with the user's modifications precisely applied into the existing code:`;
        } else {
          codeSystemPrompt = `${activeSkill.systemPrompt}

You are the Dedicated Senior Code Architect for Devnexes AI executing code via Google Gemini.
You are executing Node: "${activeNode.name}".
Task: ${activeNode.task}
Target Language: ${lang}

CRITICAL RULES & STRICT LANGUAGE RESTRICTION (MANDATORY):
1. ABSOLUTE LANGUAGE RESTRICTION:
   - Target Language is: ${lang.toUpperCase()}
   - You MUST write 100% of the code STRICTLY and EXCLUSIVELY in ${lang.toUpperCase()}!
   ${lang !== 'html' ? `- STRICT PROHIBITION: You are FORBIDDEN from generating HTML, CSS, JavaScript, <div> tags, web pages, or browser templates! The user specifically requested ${lang.toUpperCase()}.` : ''}
   ${lang === 'cpp' ? '- Generate pure, idiomatic C++ source code with #include <iostream>, vector/string if needed, namespace std, and main().' : ''}
   ${lang === 'c' ? '- Generate standard C source code with #include <stdio.h>, printf, and main().' : ''}
   ${lang === 'python' ? '- Generate pure, idiomatic Python code with clean functions, type hints, and runnable entry point.' : ''}
   ${lang === 'java' ? '- Generate valid Java code with class structure and public static void main(String[] args).' : ''}
   ${lang === 'csharp' ? '- Generate valid C# code with using System; and Main method.' : ''}
   ${lang === 'rust' ? '- Generate valid Rust code with fn main().' : ''}
   ${lang === 'sql' ? '- Generate valid SQL queries / DDL statements.' : ''}

2. COMPLETE RUNNABLE OUTPUT:
   - Output 100% COMPLETE, WORKING, PRODUCTION-READY ${lang.toUpperCase()} source code.
   - Start IMMEDIATELY with the markdown code fence: \`\`\`${lang}
   - Zero placeholders, zero TODOs, zero partial functions.
   - End cleanly with \`\`\`.`;

          if (codeIntent.diagnosedCode?.code) {
            codeUserPrompt = `[CODE ERROR CORRECTION & FIX]:
The user wants to fix errors in the following ${lang.toUpperCase()} code:

=== ORIGINAL ${lang.toUpperCase()} CODE WITH ERRORS ===
\`\`\`${lang}
${codeIntent.diagnosedCode.code}
\`\`\`

=== USER INSTRUCTIONS ===
"${userPrompt}"

STRICT DIRECTIVE: Output 100% complete, corrected, fully working ${lang.toUpperCase()} code resolving all errors.
DO NOT output HTML, CSS, or web templates. Generate pure ${lang.toUpperCase()} code only.`;
          } else {
            codeUserPrompt = `User Request: "${userPrompt}"\n\nTarget Language: ${lang.toUpperCase()}\nTask: ${activeNode.task}\n\nSTRICT INSTRUCTION: Output 100% complete, working ${lang.toUpperCase()} code only. Do NOT output HTML/CSS or web templates unless requested.`;
          }
          if (dependencyContexts) {
            codeUserPrompt += `\n\nPRECEDING STAGE DELIVERABLES (COMPLETED SPECIFICATIONS):\n${dependencyContexts}\n\nSTRICT EXECUTION DIRECTIVE: Implement the exact specification above in pure ${lang.toUpperCase()}.`;
          }
        }

        if (!hasGeminiApiKey()) {
          throw new Error('Google Gemini API key is required for all code generation and error fixes. Groq is strictly restricted from writing code. Please configure your Gemini API key in Settings.');
        }

        // Exclusively executed by Google Gemini with 3-key auto-failover (Groq will never write code)
        await streamGeminiCode({
          prompt: codeUserPrompt,
          image: userImage,
          systemPrompt: codeSystemPrompt,
          history: messagesHistory,
          signal,
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
          const completedCode = traceSteps[idx].code || '';
          const lineCount = completedCode ? completedCode.split('\n').length : 0;
          nodeOutputs[activeNode.id] = `[Code Artifact Completed & Delivered in Canvas: "${traceSteps[idx].title || 'Application'}" (${lineCount} lines of ${traceSteps[idx].language || 'code'}). Key features and requested modifications successfully integrated.]`;
        }
        if (onStepUpdate) onStepUpdate([...traceSteps]);
      }

      // ── 2. SEARCH NODE -> DUAL REAL-TIME SEARCH (TAVILY + SEARXNG) ──
      else if (isSearchType) {
        const rawSearchTarget = activeNode.searchQuery || activeNode.query || userPrompt;
        const query = resolveContextualSearchQuery(rawSearchTarget, messagesHistory);
        const searchResults = await executePrioritizedSearch(query, { signal });
        const idx = getNodeIdx();
        if (idx !== -1) {
          traceSteps[idx].results = searchResults || [];
          traceSteps[idx].status = 'completed';
          traceSteps[idx].isStreaming = false;
        }
        const searchSummary = (searchResults || []).map((r, sIdx) => {
          const providerTag = r.source === 'tavily'
            ? 'Tavily AI Verified'
            : (r.source === 'searxng'
              ? (r.engine ? `SearXNG [${r.engine}]` : 'SearXNG Multi-Engine')
              : (r.source || 'Web'));
          return `--- Finding #${sIdx + 1} [${providerTag}] (${r.domain}): ${r.title} ---\n${r.snippet}\nLink: ${r.url}`;
        }).join('\n\n');
        nodeOutputs[activeNode.id] = searchSummary || `Search for: "${query}" (${searchResults ? searchResults.length : 0} sources)`;
        if (onStepUpdate) onStepUpdate([...traceSteps]);
      }

      // ── 3. CMD / TERMINAL NODE -> HANDLED BY GROQ ─────────────
      else if (isCmdType) {
        const cmdSystemPrompt = `${activeSkill.systemPrompt}

You are Devnexes CLI Engine powered by Groq. Executing Node: "${activeNode.name}".
Task: ${activeNode.task}

Output ONLY 1-3 exact, minimal, copy-pasteable Windows CMD/PowerShell commands with short comment labels.
NO long conversational paragraphs.`;

        const cmdUserPrompt = dependencyContexts
          ? `User Request: "${userPrompt}"\n\nProject Context:\n${dependencyContexts.slice(0, 500)}\n\nTask: ${activeNode.task}`
          : `User Request: "${userPrompt}"\n\nTask: ${activeNode.task}`;

        await streamGroqChat({
          messages: [
            { role: 'system', content: cmdSystemPrompt },
            ...pastContext,
            { role: 'user', content: cmdUserPrompt }
          ],
          model: safeModel,
          signal,
          onChunk: (delta, fullText) => {
            const idx = getNodeIdx();
            if (idx !== -1) { traceSteps[idx].content = fullText; if (onStepUpdate) onStepUpdate([...traceSteps]); }
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

      // ── 4. VISION NODE -> EXCLUSIVELY GOOGLE GEMINI (MULTIMODAL 1M CONTEXT) ──
      else if (isVisionType) {
        if (!userImage) throw new Error('No image was attached for the visual analysis node.');

        // Google Gemini provides multimodal vision with 1M tokens context and zero Groq 7k TPM constraints
        if (hasGeminiApiKey()) {
          await streamGeminiCode({
            prompt: `User Request: "${userPrompt}"\n\nTask: ${activeNode.task}\n\nPlease perform deep visual inspection and OCR analysis. Extract all visible text, design aesthetics, layout elements, color scheme, and key attributes faithfully in the user's language.`,
            image: userImage,
            systemPrompt: 'You are an expert visual and OCR analysis engine for Devnexes AI. Inspect the provided image in detail and extract all key aesthetic, structural, and content elements.',
            signal,
            onChunk: (delta, fullText) => {
              const idx = getNodeIdx();
              if (idx !== -1) { traceSteps[idx].content = fullText; onStepUpdate?.([...traceSteps]); }
            }
          });
        } else {
          // Fallback to Groq vision
          await streamGroqChat({
            messages: [
              {
                role: 'system',
                content: 'You are a precise vision, screenshot, OCR, and UI-analysis assistant. Analyze the image itself. Extract readable text faithfully, describe visual evidence, and answer in the user\'s language.'
              },
              {
                role: 'user',
                content: `User request: ${userPrompt}\n\nNode task: ${activeNode.task}`,
                images: [userImage]
              }
            ],
            model: safeModel,
            signal,
            onChunk: (delta, fullText) => {
              const idx = getNodeIdx();
              if (idx !== -1) { traceSteps[idx].content = fullText; onStepUpdate?.([...traceSteps]); }
            }
          });
        }

        const idx = getNodeIdx();
        if (idx !== -1) {
          traceSteps[idx].status = 'completed';
          traceSteps[idx].isStreaming = false;
          nodeOutputs[activeNode.id] = traceSteps[idx].content;
        }
        onStepUpdate?.([...traceSteps]);
      }

      // ── 5. IMAGE GENERATION NODE -> STABLE DIFFUSION 1.5 ENGINE ─
      else if (isImageType) {
        // Ingest visual prompt from preceding analysis stage if engineered
        let dynamicPrompt = activeNode.imagePrompt;
        if (!dynamicPrompt && dependencyContexts) {
          const promptMatch = dependencyContexts.match(/(?:Enriched (?:SD 1\.5 )?Prompt|Optimized Prompt|Visual Prompt|SD 1\.5 Prompt|Image Prompt):\s*([^\n]+)/i);
          if (promptMatch && promptMatch[1]?.trim()) {
            dynamicPrompt = promptMatch[1].trim();
          }
        }
        if (!dynamicPrompt) dynamicPrompt = activeNode.query || userPrompt;

        const result = await generateStableDiffusionImage({
          prompt: dynamicPrompt,
          seed: activeNode.seed || null,
          initImage: activeNode.initImage || null,
          isModification: Boolean(activeNode.isModification),
          signal
        });

        const idx = getNodeIdx();
        if (idx !== -1) {
          traceSteps[idx].imageResult = result;
          if (result.error) {
            traceSteps[idx].status = 'error';
            traceSteps[idx].error = result.message || 'Image generation failed';
          } else {
            traceSteps[idx].status = 'completed';
          }
          traceSteps[idx].isStreaming = false;
        }
        nodeOutputs[activeNode.id] = result.error
          ? `[Image Generation Status: ${result.message || 'Failed'}]`
          : `[Image synthesized successfully for: "${result.originalPrompt || result.prompt}"]`;
        if (onStepUpdate) onStepUpdate([...traceSteps]);
      }

      // ── 6. ANALYSIS / GENERAL NODE -> REAL WORK BY GROQ ────────
      else {
        // Determine whether this analysis follows search, precedes code, precedes image, or is a diagnostic
        const isFollowingSearch = (nodeConfig.inputFrom || []).some(id => {
          const st = traceSteps.find(s => s.id === id);
          return st && /search|lookup/i.test(st.type);
        }) || (dependencyContexts.toLowerCase().includes('findings from [node_search') || dependencyContexts.toLowerCase().includes('live web grounding') || dependencyContexts.toLowerCase().includes('real-time web search'));

        const isPrecedingCode = plan.nodes.some(n =>
          (n.executionStage || 1) > (nodeConfig.executionStage || 1) && /code|artifact|canvas/i.test(n.type)
        );

        const isPrecedingImage = plan.nodes.some(n =>
          (n.executionStage || 1) > (nodeConfig.executionStage || 1) && /image|sd|diffusion/i.test(n.type)
        );

        let dynamicTaskDirective = '';
        if (isFollowingSearch && !isPrecedingCode) {
          dynamicTaskDirective = `TASK: REAL FACTUAL SYNTHESIS & GROUNDED DATA EXTRACTION
- The preceding stage performed a live web search.
- Examine the search findings provided in the prompt.
- Perform real factual synthesis: extract verified entities, dates, concrete numbers, executive profiles, company facts, or direct answers.
- Eliminate raw snippets, broken links, and promotional fluff.
- Organize the verified knowledge into clear, high-density structured sections with exact details.
- FORMATTING: Use clean markdown hierarchy (headings like ### 🔍 Verification Report, bold bullet points, and callout blocks). Never wrap plain URLs in backticks or output broken link syntax.`;
        } else if (isPrecedingCode) {
          const hasExistingArt = Boolean(getLatestCodeArtifact(messagesHistory, activeCanvasCode, activeCanvasLanguage)?.code);
          const isIncrementalPlan = hasExistingArt || /incremental|update|modification|change|tweak|fix/i.test(activeNode.name) ||
            /modify|update|change|fix/i.test(activeNode.task);

          const codeNode = plan.nodes.find(n => /code|artifact|canvas/i.test(n.type));
          const targetLang = (codeNode?.artifactLanguage || '').toLowerCase();
          const isSystemsOrBackend = /cpp|c\+\+|c|python|java|rust|go|golang|sql|algo|system|backend/i.test(targetLang) ||
            /\b(c\+\+|cpp|c|python|java|rust|golang|algorithm|compiler|error|backend|database|sql)\b/i.test(userPrompt);

          if (isIncrementalPlan) {
            dynamicTaskDirective = `TASK: PRECISE CODE UPDATE BLUEPRINT FOR CODE ENGINE
- The user wants to update their existing application code in Canvas.
- Formulate a razor-sharp, authoritative change specification (50-80 words).
- Structure strictly:
  ### 🎯 Target Modules & Scope
  - Components, methods, or blocks to modify.
  ### ⚡ Technical Modifications
  - Concrete syntax changes, class modifications, or styling tokens.
- STRICT PROHIBITION: NEVER use childish robotic phrases like "mandates a single node executed by Google Gemini". Speak authoritatively as a Lead Principal Engineer.
- Do NOT output full code blocks.`;
          } else if (isSystemsOrBackend) {
            dynamicTaskDirective = `TASK: PRINCIPAL SYSTEMS & SOFTWARE ARCHITECTURAL SPECIFICATION
- You are a Principal Systems Architect defining the authoritative technical specification for code implementation.
- Formulate a razor-sharp, authoritative engineering blueprint (120-180 words) structured into 3 high-density sections:

### 🎯 Architecture & Technical Strategy
- Paradigm & Standards: (Define language standard [e.g. C++20 / ISO C++ / Python 3.12], execution model, and data structures).
- Modular Decomposition: (List 3-5 specific modules, functions, or compiler diagnostic categories).

### ⚙️ Engine Invariants & Constraints
- Boundary Rules: (Enforce strict invariants: e.g. memory safety, RAII, zero comments directive, error count thresholds, type safety).
- Standard Libraries: (Explicit header requirements or zero-dependency constraints).

### 🔬 Implementation Matrix & Verification
- Execution Pipeline: (Exact phases for implementation, syntax generation, and edge-case validation).
- Critical Invariants: (Specific edge cases, compiler phases, or test vectors).

- STRICT PROHIBITION: NEVER use childish robotic phrases like "The architecture mandates a single node executed by Google Gemini" or "Groq is planning". Speak authoritatively as a Lead Principal Architect.
- Do NOT output full code blocks. Produce only this rigorous technical specification.`;
          } else {
            dynamicTaskDirective = `TASK: PRINCIPAL UI ARCHITECTURAL BLUEPRINT
- You are a Lead Product Architect formulating the technical specification for frontend implementation.
- Formulate an authoritative, modern blueprint (100-150 words) structured into 3 crisp sections:

### 🎯 Component Hierarchy & Wireframe
- Visual Structure: (List 3-5 visual sections/components in order: e.g. Sticky Nav, Hero Banner, Metric Grid, Interactive Canvas).
- Layout Architecture: (Responsive schema, container constraints, breakpoints).

### 🎨 Design System & Visual Tokens
- Color Tokens: (Primary surfaces, typography hues, border accents, contrast ratios).
- Design Language: (Modern typography, micro-interactions, subtle glassmorphism, Tailwind CSS).

### ⚡ State Management & Interaction Pipeline
- Reactive Model: (State variables, active filters, form states, transitions).
- Event Handlers: (User inputs, modal triggers, async states).

- STRICT PROHIBITION: NEVER use childish robotic phrases like "The architecture mandates a single node executed by Google Gemini". Speak authoritatively as a Lead Product Architect.
- Do NOT output full code blocks. Produce only this rigorous architectural blueprint.`;
          }
        } else if (isPrecedingImage) {
          dynamicTaskDirective = `TASK: VISUAL COMPOSITION & STABLE DIFFUSION 1.5 PROMPT ENGINEERING
- The next stage will generate an image with Stable Diffusion 1.5.
- Perform REAL aesthetic direction and prompt engineering:
  1. Composition & Perspective: Camera shot type (wide-angle, macro, 35mm), rule of thirds, perspective.
  2. Lighting & Atmosphere: Volumetric lighting, directional shadows, color temperature, time of day.
  3. Style Tokens: Photorealism, textures, fine details, rendering keywords.
  4. Enriched SD 1.5 Prompt: (Provide a clear single-line enriched visual prompt that the SD 1.5 generator will directly ingest).
  5. Negative Prompt: Flaws, artifacts, and unwanted elements to filter out.`;
        } else {
          dynamicTaskDirective = `TASK: CONCRETE TECHNICAL SPECIFICATION
- Execute Node: "${activeNode.name}". Task: ${activeNode.task}
- Provide substantive, high-density, project-specific analysis tailored to the user request.
- Focus directly on actionable decisions and concrete conclusions. ZERO empty boilerplate.`;
        }

        const analysisSystemPrompt = `${activeSkill.systemPrompt}

You are executing Node: "${activeNode.name}".
Task: ${activeNode.task}

${dynamicTaskDirective}

STAGE PROGRESSION DIRECTIVE:
- Each stage in the pipeline performs a distinct, indispensable role.
- Acknowledge that prior stages have finished and their deliverables are established.
- Do NOT re-execute, re-explain, or duplicate the work of preceding stages. Consume their deliverables, execute your distinct role, and produce actionable substance for the next stage.`;

        const analysisUserPrompt = dependencyContexts
          ? `User Request: "${userPrompt}"\n\nPRECEDING COMPLETED STAGE DELIVERABLES:\n${dependencyContexts}\n\nYOUR SPECIFIC NODE OBJECTIVE:\nNode Name: "${activeNode.name}"\nTask: ${activeNode.task}\n\nExecute your specific task now based strictly on the verified deliverables above:`
          : `User Request: "${userPrompt}"\n\nYOUR SPECIFIC NODE OBJECTIVE:\nNode Name: "${activeNode.name}"\nTask: ${activeNode.task}\n\nExecute your specific task now with high-density, concrete substance:`;

        try {
          await streamGroqChat({
            messages: [
              { role: 'system', content: analysisSystemPrompt },
              ...pastContext,
              { role: 'user', content: analysisUserPrompt }
            ],
            model: safeModel,
            signal,
            onChunk: (delta, fullText) => {
              const idx = getNodeIdx();
              if (idx !== -1) { traceSteps[idx].content = fullText; if (onStepUpdate) onStepUpdate([...traceSteps]); }
            }
          });
        } catch (analysisErr) {
          console.warn('[Analysis Fallback] Groq rate limited on analysis node, seamlessly completing via Gemini:', analysisErr.message);
          if (hasGeminiApiKey()) {
            await streamGeminiCode({
              prompt: analysisUserPrompt,
              systemPrompt: analysisSystemPrompt,
              signal,
              onChunk: (delta, fullText) => {
                const idx = getNodeIdx();
                if (idx !== -1) { traceSteps[idx].content = fullText; if (onStepUpdate) onStepUpdate([...traceSteps]); }
              }
            });
          } else {
            throw analysisErr;
          }
        }

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
        traceSteps[idx].error = err.message;
        traceSteps[idx].isStreaming = false;
      }
      if (onStepUpdate) onStepUpdate([...traceSteps]);
    }
  };

  // Run stages (parallel independent nodes, serial dependent nodes)
  for (const currentStage of stages) {
    const stagePlannedNodes = plan.nodes.filter(node => (node.executionStage || 1) === currentStage);
    const parallelNodes = stagePlannedNodes.filter(node => node.canParallel && !(node.inputFrom || []).length);
    const serialNodes = stagePlannedNodes.filter(node => !parallelNodes.includes(node));
    await Promise.all(parallelNodes.map(executeNode));
    for (const nodeConfig of serialNodes) await executeNode(nodeConfig);
  }

  // ── STAGE 3: Final Synthesis Response -> HANDLED BY GROQ ───────
  const respNode = traceSteps.find(s => s.type === 'response');
  if (respNode && (!respNode.content || respNode.content.trim().startsWith('[Source #'))) {
    const rawData = Object.entries(nodeOutputs)
      .map(([k, v]) => `=== Findings from [${k}] ===\n${v}`)
      .join('\n\n');

    const hasImageDelivered = traceSteps.some(s => (s.type === 'image' || s.imageResult) && s.status === 'completed');
    const hasImageNode = traceSteps.some(s => s.type === 'image' || s.imageResult);
    const compoundCheck = detectCompoundMultiIntent(userPrompt);
    const hasOtherPipelineTasks = hasCode || traceSteps.some(s => s.type === 'search' || s.type === 'code' || s.type === 'cmd' || (s.type === 'analysis' && s.id === 'node_composition'));
    const isPureImageOnly = hasImageNode && !compoundCheck.isCompound && !hasOtherPipelineTasks;

    // If pure image delivery (NO other tasks, NO code, NO search, NO writing/composition task requested)
    if (isPureImageOnly) {
      const isUrdu = /\b(karo|kardo|banao|hai|hain|ki|ka|ke|chahiye|mujhe|ap|aap|tasveer|bhi|ye|yeh|kripya|me|mein)\b/i.test(userPrompt);
      const isModified = traceSteps.some(s => s.isModification || s.imageResult?.isModified);
      const deliveryText = hasImageDelivered
        ? (isUrdu
            ? (isModified ? 'Aap ki darkhwast ke mutabiq image update kar di gayi hai.' : 'Aap ki image tayyar hai.')
            : (isModified ? 'Your image has been updated.' : 'Here is your image.'))
        : (isUrdu ? 'Maazrat, abhi image generate nahi ho saki. Kripya thori der baad dobara koshish karein.' : 'Sorry, the image could not be generated at this time. Please try again.');
      respNode.content = deliveryText;
      if (onStepUpdate) onStepUpdate([...traceSteps]);
      if (onChunk) onChunk(deliveryText, deliveryText);
      return { hasCode };
    }

    const finalSynthPrompt = `${activeSkill.systemPrompt}

You are Devnexes AI — a world-class, highly intelligent, and direct AI assistant powered by Groq.

CRITICAL RESPONSE & BENCHMARK DIRECTIVES:
1. ZERO FAKE DATA / FACTUAL CONFIRMATION:
   - NEVER fabricate, invent, or guess facts, person profiles, credentials, dates, or company achievements.
   - If verified search findings are present, base 100% of your factual statements strictly on those verified findings.
   - If a specific detail was not confirmed in the search findings, explicitly state the verified facts and transparently acknowledge what could not be confirmed, rather than inventing fake data.

2. LOGICAL REASONING RIGOR:
   - Every intermediate deduction step MUST be strictly necessary and directly derived from given premises.
   - NEVER introduce redundant, speculative, or irrelevant assumptions (e.g. if a problem already states the subject is a man, do NOT redundantly deduce gender from unrelated context). Keep proofs clean, minimal, and watertight.

3. DATA ANALYSIS & STATISTICAL RIGOR:
   - ZERO CURRENCY ASSUMPTION: NEVER assume '$', 'USD', or any currency unless explicitly stated in the input data. Use raw numbers or the user's explicit denomination.
   - NO SPECULATIVE HISTORICAL GENERALIZATIONS: NEVER claim "historical seasonality" or "recurring trend" from an isolated, single-period data point. If only one March is given, it is an isolated observation, not a historical seasonal pattern.
   - SAMPLE SIZE LIMITATIONS: Explicitly state statistical sample size limitations. For short horizons (e.g. 6 months), note that data is insufficient for complex models like ARIMA or Prophet, and recommend appropriate short-term baseline metrics with caveats.
   - Separate mathematical verification from qualitative business interpretation.

4. COMPLEX AGENT & SYSTEMS ARCHITECTURE STANDARDS:
   - DEFINITIVE SINGLE STACK: NEVER provide ambiguous "FastAPI or NestJS, Celery or BullMQ" laundry lists. Choose ONE coherent, justified, production-grade stack tailored to the domain.
   - VECTOR INDEXING INVARIANTS: PostgreSQL pgvector vector similarity search MUST use HNSW ('hnsw (vector_cosine_ops)') or IVFFlat. NEVER recommend GIN for vector embeddings (GIN is for full-text/JSONB, not high-dimensional vectors).
   - TRUE MULTI-TENANCY: In enterprise/agent architectures, ALWAYS model 'tenant_id' / 'organization_id', organization memberships, and tenant-scoped RBAC, not just flat 'user_id'.
   - PLANNER & DAG ENGINE DESIGN: Specify dynamic DAG validation (cycle check via topological sort), dependency-aware parallel execution stages, node I/O contracts, exponential backoff retries, timeouts, cancellation tokens, and idempotent recovery.
   - DEFENSE-IN-DEPTH SECURITY: Treat external web scrapes and document uploads as untrusted data (mitigating indirect prompt injection); enforce SSRF egress firewalls, strict tool permission scopes, and containerized sandbox isolation.

5. CONVERSATIONAL PROACTIVITY & OBJECTIVE GUIDANCE:
   - Avoid generic, shallow summaries. Naturally guide technical conversations toward concrete, actionable implementations (e.g. connecting agent concepts to DAG planning, deterministic tool calling, and multi-tier memory).

6. STRICT CODE ENGINE INVARIANT (GOOGLE GEMINI DEDICATION):
   - All code generation (full applications, web canvas, and small snippets alike) is powered 100% exclusively by Google Gemini via dedicated code stages. Groq is strictly restricted from generating application source code.
   - CHOTA MOTA CODE (Small snippets <= 15 lines, functions, quick algorithms, bug fix snippets): When Gemini has generated a small code snippet in the preceding code stage, present your concise explanation directly on the main screen. The Gemini code block is already displayed directly on the main screen.
   - BADA CODE (Full applications, web pages, HTML/CSS projects, full files > 15 lines): The complete artifact is delivered into the Code Canvas (Side Bar). Briefly introduce the solution on the main screen and point the user to the Code Canvas sidebar where the full project is open.

7. ZERO VISUAL REFUSALS: NEVER, under any circumstances, say "I cannot generate or create images directly", "As an AI text model, I am restricted from producing visual content", or lecture the user to use external tools like Midjourney or DALL-E. Devnexes AI HAS integrated visual synthesis powers.
8. Match the user's language (Roman Urdu, Urdu, or English) with natural intelligence.
9. STAGE CLOSURE DIRECTIVE: The pipeline work is now complete. Deliver the final authoritative resolution without conversational meta-commentary or repeating internal stage scratchpads.

10. EXECUTIVE-GRADE PRESENTATION & OUTPUT FORMAT (MANDATORY):
    - STRUCTURE & HEADINGS: Format answers with clean visual hierarchy using clear markdown headings with intuitive emojis (e.g. "### 🔍 Verification Report", "### 🌐 Verified Findings", "### 💡 Khulasa / Conclusion").
    - HIGHLIGHT CALLOUTS: Use modern GitHub-style alerts (like > [!NOTE] or > [!INFO]) to frame key status, takeaways, or ground-truth summaries.
    - CLEAN BULLET POINTS: In bullet lists, start with bold descriptors:
      * **Item / Domain:** Explanation...
    - CLEAN HYPERLINKS:
      * Format all URLs as proper, clean Markdown links: [Domain / Title](https://...) (e.g. [portfoilio-beige-rho.vercel.app](https://portfoilio-beige-rho.vercel.app)).
      * NEVER put spaces inside parentheses like [url]( url ).
      * NEVER enclose ordinary web URLs in ugly backtick code snippets.
      * NEVER write awkward parenthesized constructs like Exact URL ( example.com ). Speak with natural, polished, executive elegance.
    - AVOID CLUTTER: Separate sections with clean dividers (---) when presenting multiple distinct topics or URLs.

11. ELEGANT VISUAL & IMAGE DELIVERY:
    - NEVER mention engine or model names (do NOT say "Stable Diffusion", "SDXL", "DALL-E", "API", or explain where/how the image was synthesized).
    - If the user asked to modify a previous image, acknowledge that the change has been applied to their original image (e.g. "Aap ki darkhwast ke mutabiq car ka color change kar diya gaya hai.").
    - Keep conversational text concise, natural, and friendly (1 clear sentence).

12. MULTI-TASK & COMPOUND REQUEST FULFILLMENT (MANDATORY):
    - When the user requested MULTIPLE tasks at once (e.g. an image AND writing a document like a sick leave application, letter, essay, poem, or answering questions):
      * You MUST fulfill ALL requested tasks completely, thoroughly, and professionally!
      * For sick leave / leave applications: Draft the complete, formal, ready-to-submit application with proper structure (To / Manager or Principal, Subject, Salutation, Clear explanation of sickness/fever/medical reason, Exact dates requested, Gratitude, and Sign-off).
      * Acknowledge that the visual asset was also created and is displayed above in the image card.
      * NEVER omit or skip the written document! Fulfill the entire compound request!`;

    try {
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
        model: safeModel,
        signal,
        onChunk: (delta, fullText) => {
          let cleaned = cleanMetaPlanningPreamble(fullText);
          cleaned = sanitizeImageResponse(cleaned);
          respNode.content = cleaned;
          if (onStepUpdate) onStepUpdate([...traceSteps]);
          if (onChunk) onChunk(delta, cleaned);
        }
      });
    } catch (finalErr) {
      console.warn('[Final Synthesis Fallback] Groq final response error:', finalErr.message);
      
      // Fallback 1: Stream via Gemini if available
      let fallbackHandled = false;
      if (hasGeminiApiKey()) {
        try {
          await streamGeminiCode({
            prompt: `User Request: "${userPrompt}"\n\nVerified Deliverables:\n${rawData}\n\nDeliver a friendly, direct, professional response explaining what was done and summarizing the solution in the user's language:`,
            systemPrompt: finalSynthPrompt,
            signal,
            onChunk: (delta, fullText) => {
              respNode.content = fullText;
              if (onStepUpdate) onStepUpdate([...traceSteps]);
              if (onChunk) onChunk(delta, fullText);
            }
          });
          fallbackHandled = true;
        } catch {}
      }

      // Fallback 2: Direct courteous completion message
      if (!fallbackHandled || !respNode.content) {
        const isUrdu = /\b(karo|kardo|banao|hai|hain|ki|ka|ke|chahiye|mujhe|ap|aap|tasveer|bhi|ye|yeh|kripya|me|mein|karoo|diya|diye)\b/i.test(userPrompt);
        let completionText = '';
        if (hasCode) {
          const codeStep = traceSteps.find(s => s.type === 'code' || s.type === 'artifact');
          const title = codeStep?.title || 'Code Artifact';
          completionText = isUrdu
            ? `Aap ka code mukammal kar ke **Code Canvas** mein update kar diya gaya hai (${title}). Tamam requested features aur changes live apply ho chuki hain. Aap right side par Canvas ya Preview tab mein iska live result dekh sakte hain.`
            : `I have completed and updated your code in the **Code Canvas** (${title}). All requested features and updates have been applied. You can test and view the live implementation in the Canvas preview.`;
        } else {
          completionText = isUrdu
            ? `Aap ki request mukammal ho chuki hai.`
            : `Your request has been processed successfully.`;
        }
        respNode.content = completionText;
        if (onStepUpdate) onStepUpdate([...traceSteps]);
        if (onChunk) onChunk(completionText, completionText);
      }
    }

    // Absolute Guarantee: Ensure respNode.content is never left blank when code has been completed
    if (respNode && (!respNode.content || respNode.content.trim().length === 0)) {
      const isUrdu = /\b(karo|kardo|banao|hai|hain|ki|ka|ke|chahiye|mujhe|ap|aap|tasveer|bhi|ye|yeh|kripya|me|mein|karoo|diya|diye)\b/i.test(userPrompt);
      if (hasCode) {
        respNode.content = isUrdu
          ? `Aap ka code mukammal kar ke **Code Canvas** mein update kar diya gaya hai. Tamam requested changes live apply ho chuki hain. Aap right side par Canvas ya Preview tab mein iska live result check kar sakte hain.`
          : `I have completed and updated your code in the **Code Canvas**. All requested changes have been integrated and are live in the preview. You can test and view it in the Canvas panel.`;
      } else {
        respNode.content = isUrdu
          ? `Aap ki request mukammal ho chuki hai.`
          : `Your request has been processed successfully.`;
      }
      if (onStepUpdate) onStepUpdate([...traceSteps]);
      if (onChunk) onChunk(respNode.content, respNode.content);
    }
  }

  const codeStep = traceSteps.find(s => s.type === 'code' || s.type === 'artifact');
  const codeText = cleanCodeContent(codeStep?.code || '');
  const codeLines = codeText ? codeText.split('\n').length : 0;
  const isHtml = codeStep?.language === 'html' || codeText.includes('<!DOCTYPE') || codeText.includes('<html');
  const isSubstantialCode = forceCanvasCode || isHtml || codeLines > 15;

  return { hasCode, isSubstantialCode, codeCount: codeLines };
}
