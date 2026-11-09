/**
 * Devnexes AI — Gemini Multi-Key Coding Engine
 * Manages 3 Gemini API keys with automatic failover and token limit rotation.
 * Exclusively executes all code generation and Canvas implementation tasks.
 */

export const DEFAULT_GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || import.meta.env?.GEMINI_MODEL || 'gemini-3-flash-preview';

const COOLDOWN_DURATION_MS = 60 * 1000; // 60 seconds cooldown for rate-limited keys
const keyCooldowns = { 0: 0, 1: 0, 2: 0 };
let activeKeyIndex = 0;

/**
 * Retrieve all 3 configured Gemini API keys from localStorage or env
 */
export function getGeminiApiKeys() {
  const envKeys = [
    import.meta.env?.VITE_GEMINI_API_KEY_1 || import.meta.env?.GEMINI_API_KEY_1 || '',
    import.meta.env?.VITE_GEMINI_API_KEY_2 || import.meta.env?.GEMINI_API_KEY_2 || '',
    import.meta.env?.VITE_GEMINI_API_KEY_3 || import.meta.env?.GEMINI_API_KEY_3 || ''
  ];

  // Also support legacy single key fallback
  const singleLegacy = import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY || '';

  return [0, 1, 2].map(idx => {
    try {
      const stored = localStorage.getItem(`devnexes_gemini_key_${idx + 1}`);
      if (stored && stored.trim()) return stored.trim();
    } catch {}
    if (envKeys[idx] && envKeys[idx].trim()) return envKeys[idx].trim();
    if (idx === 0 && singleLegacy && singleLegacy.trim()) return singleLegacy.trim();
    return '';
  });
}

/**
 * Save Gemini keys to localStorage
 */
export function saveGeminiApiKeys(keys) {
  if (!Array.isArray(keys)) return;
  keys.forEach((key, idx) => {
    try {
      if (typeof key === 'string' && key.trim()) {
        localStorage.setItem(`devnexes_gemini_key_${idx + 1}`, key.trim());
      } else {
        localStorage.removeItem(`devnexes_gemini_key_${idx + 1}`);
      }
    } catch {}
  });
}

/**
 * Check if at least one Gemini API key is configured
 */
export function hasGeminiApiKey() {
  const keys = getGeminiApiKeys();
  return keys.some(k => Boolean(k && k.trim()));
}

/**
 * Get detailed status of all 3 Gemini keys (active, cooldown, available)
 */
export function getGeminiKeysStatus() {
  const keys = getGeminiApiKeys();
  const now = Date.now();
  return keys.map((key, idx) => ({
    index: idx + 1,
    configured: Boolean(key && key.trim()),
    isActive: idx === activeKeyIndex,
    inCooldown: keyCooldowns[idx] > now,
    cooldownRemainingMs: Math.max(0, keyCooldowns[idx] - now),
    maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : 'Not configured'
  }));
}

/**
 * Mark a key in cooldown when rate-limited / quota exhausted
 */
export function markGeminiKeyCooldown(index) {
  if (index >= 0 && index < 3) {
    keyCooldowns[index] = Date.now() + COOLDOWN_DURATION_MS;
    console.warn(`[Gemini Failover] Key #${index + 1} marked in cooldown for ${COOLDOWN_DURATION_MS / 1000}s`);
  }
}

/**
 * Get the next available Gemini key that is not in cooldown
 */
export function getAvailableGeminiKey() {
  const keys = getGeminiApiKeys();
  const now = Date.now();

  // 1. Check current active key first if available and not cooled down
  if (keys[activeKeyIndex] && keyCooldowns[activeKeyIndex] <= now) {
    return { key: keys[activeKeyIndex], index: activeKeyIndex };
  }

  // 2. Rotate through the rest of the 3 keys
  for (let offset = 1; offset <= 3; offset++) {
    const candidateIdx = (activeKeyIndex + offset) % 3;
    if (keys[candidateIdx] && keyCooldowns[candidateIdx] <= now) {
      activeKeyIndex = candidateIdx;
      console.info(`[Gemini Failover] Switched to Key #${activeKeyIndex + 1}`);
      return { key: keys[activeKeyIndex], index: activeKeyIndex };
    }
  }

  // 3. If all configured keys are in cooldown, pick the one with earliest cooldown expiry
  let bestIdx = -1;
  let minCooldown = Infinity;
  keys.forEach((key, idx) => {
    if (key && keyCooldowns[idx] < minCooldown) {
      minCooldown = keyCooldowns[idx];
      bestIdx = idx;
    }
  });

  if (bestIdx !== -1) {
    activeKeyIndex = bestIdx;
    return { key: keys[bestIdx], index: bestIdx, warnCooldown: true };
  }

  return { key: null, index: -1 };
}

/**
 * Detect rate limit / quota exhaustion errors from Gemini
 */
function isGeminiRateLimitError(status, errorBody = '') {
  if (status === 429) return true;
  const lower = String(errorBody).toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('exceeded your current quota')
  );
}

/**
 * Stream Gemini code generation and vision analysis with automatic multi-key failover
 */
export async function streamGeminiCode({
  prompt,
  image = null,
  systemPrompt = '',
  history = [],
  model = DEFAULT_GEMINI_MODEL,
  onChunk,
  onError,
  signal
}) {
  const keys = getGeminiApiKeys();
  const configuredKeysCount = keys.filter(Boolean).length;

  if (configuredKeysCount === 0) {
    const err = new Error('No Gemini API key configured. Please add your Gemini API key in Settings or .env for Code Generation.');
    if (onError) onError(err);
    throw err;
  }

  // Attempt generation with up to configuredKeysCount retries across keys
  let attempts = 0;
  const maxAttempts = Math.max(configuredKeysCount, 3);
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts++;
    const { key, index } = getAvailableGeminiKey();

    if (!key) {
      const err = new Error('All configured Gemini API keys are currently exhausted or unavailable.');
      if (onError) onError(err);
      throw err;
    }

    try {
      const result = await executeSingleGeminiStream({
        key,
        keyIndex: index,
        prompt,
        image,
        systemPrompt,
        history,
        model,
        onChunk,
        signal
      });
      return result;
    } catch (err) {
      lastError = err;
      if (signal?.aborted) throw err;

      const isLimit = isGeminiRateLimitError(err.status, err.message);
      console.warn(`[Gemini Failover] Key #${index + 1} encountered ${isLimit ? 'rate limit' : 'error'}: ${err.message}. Rotating to next Gemini key...`);
      markGeminiKeyCooldown(index);
      activeKeyIndex = (index + 1) % keys.length;

      if (attempts >= configuredKeysCount) {
        if (onError) onError(err);
        throw err;
      }
    }
  }

  if (onError) onError(lastError);
  throw lastError || new Error('All Gemini API keys failed.');
}

/**
 * Execute a single streaming request to Gemini API (supports Multimodal Images natively)
 */
async function executeSingleGeminiStream({
  key,
  keyIndex,
  prompt,
  image = null,
  systemPrompt,
  history = [],
  model,
  onChunk,
  signal
}) {
  // Use active flagship Gemini model (gemini-3-flash-preview or gemini-3.8-flash)
  const activeModel = (model === 'gemini-2.5-flash' || !model) ? 'gemini-3-flash-preview' : model;
  const isBearerToken = key.startsWith('ya29.');
  const url = isBearerToken
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:streamGenerateContent?alt=sse`
    : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;

  const contents = [];

  // Add conversation history if present
  if (Array.isArray(history) && history.length > 0) {
    history.slice(-8).forEach(msg => {
      const role = msg.role === 'user' ? 'user' : 'model';
      const text = typeof msg.content === 'string' ? msg.content : '';
      if (text) {
        const cleanHistoryText = text
          .replace(/```[\s\S]*?```/g, '[Previous Code Artifact]')
          .slice(0, 2000);
        if (cleanHistoryText.trim()) {
          contents.push({
            role,
            parts: [{ text: cleanHistoryText }]
          });
        }
      }
    });
  }

  // Construct current user parts with optional inline multimodal image
  const userParts = [];
  if (image && typeof image === 'string') {
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      userParts.push({
        inline_data: {
          mime_type: match[1],
          data: match[2]
        }
      });
    }
  }
  userParts.push({ text: prompt });

  // Add current user prompt
  contents.push({
    role: 'user',
    parts: userParts
  });

  const requestBody = {
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192
    }
  };

  if (systemPrompt && systemPrompt.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt.trim() }]
    };
  }

  const headers = {
    'Content-Type': 'application/json'
  };
  if (isBearerToken) {
    headers['Authorization'] = `Bearer ${key}`;
  } else {
    headers['x-goog-api-key'] = key;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => `HTTP ${response.status}`);
    let friendlyMessage = errorText;
    if (errorText.includes('API_KEY_SERVICE_BLOCKED') || errorText.includes('generativelanguage.googleapis.com are blocked')) {
      friendlyMessage = 'Google Generative Language API is blocked on this key. Please use a standard Gemini API key (starts with AIzaSy...) created free at https://aistudio.google.com/app/apikey.';
    }
    const err = new Error(`Gemini API error (Key #${keyIndex + 1}): ${friendlyMessage}`);
    err.status = response.status;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  const parseSSELine = (line) => {
    if (!line.startsWith('data:')) return;
    const jsonStr = line.slice(5).trim();
    if (!jsonStr || jsonStr === '[DONE]') return;

    try {
      const data = JSON.parse(jsonStr);
      const candidates = data.candidates || [];
      if (candidates.length > 0) {
        const parts = candidates[0].content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            fullText += part.text;
            onChunk?.(part.text, fullText);
          }
        }
      }
    } catch {
      // Ignore intermediate json parse chunk edges
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (line) parseSSELine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    parseSSELine(buffer.trim());
  }

  return fullText;
}

