/**
 * Devnexes AI — Dynamic High-Fidelity Image Generation Engine
 * Produces hyper-realistic, 8k, detailed, and accurate imagery with zero watermarks.
 * 
 * Strict Constraint: Do NOT reveal backend or model details in outputs.
 */

export const SD_15_MODEL = 'runwayml/stable-diffusion-v1-5';

/**
 * Authentic brand & website domains for instant, genuine logo and reference display.
 * Eliminates fake, distorted AI-generated brand marks.
 */
export const KNOWN_BRAND_DOMAINS = {
  'chatgpt': { name: 'ChatGPT', domain: 'chatgpt.com' },
  'openai': { name: 'OpenAI', domain: 'openai.com' },
  'google': { name: 'Google', domain: 'google.com' },
  'gemini': { name: 'Google Gemini', domain: 'gemini.google.com' },
  'github': { name: 'GitHub', domain: 'github.com' },
  'microsoft': { name: 'Microsoft', domain: 'microsoft.com' },
  'apple': { name: 'Apple', domain: 'apple.com' },
  'youtube': { name: 'YouTube', domain: 'youtube.com' },
  'twitter': { name: 'X / Twitter', domain: 'x.com' },
  'x': { name: 'X', domain: 'x.com' },
  'meta': { name: 'Meta', domain: 'meta.com' },
  'facebook': { name: 'Facebook', domain: 'facebook.com' },
  'instagram': { name: 'Instagram', domain: 'instagram.com' },
  'linkedin': { name: 'LinkedIn', domain: 'linkedin.com' },
  'discord': { name: 'Discord', domain: 'discord.com' },
  'spotify': { name: 'Spotify', domain: 'spotify.com' },
  'netflix': { name: 'Netflix', domain: 'netflix.com' },
  'amazon': { name: 'Amazon', domain: 'amazon.com' },
  'wikipedia': { name: 'Wikipedia', domain: 'wikipedia.org' },
  'reddit': { name: 'Reddit', domain: 'reddit.com' },
  'telegram': { name: 'Telegram', domain: 'telegram.org' },
  'whatsapp': { name: 'WhatsApp', domain: 'whatsapp.com' },
  'slack': { name: 'Slack', domain: 'slack.com' },
  'python': { name: 'Python', domain: 'python.org' },
  'javascript': { name: 'JavaScript', domain: 'javascript.com' },
  'react': { name: 'React', domain: 'react.dev' },
  'tailwind': { name: 'Tailwind CSS', domain: 'tailwindcss.com' },
  'figma': { name: 'Figma', domain: 'figma.com' },
  'notion': { name: 'Notion', domain: 'notion.so' },
  'docker': { name: 'Docker', domain: 'docker.com' },
  'vercel': { name: 'Vercel', domain: 'vercel.com' },
  'supabase': { name: 'Supabase', domain: 'supabase.com' },
  'devnexes': { name: 'Devnexes AI', domain: 'devnexes.ai' }
};

/**
 * Detect if a prompt asks for an official company/website logo or brand reference visual
 */
export function detectOfficialBrandLogo(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;
  const lower = prompt.toLowerCase().trim();

  // MUST be explicitly asking for a logo, icon, emblem, symbol, favicon or badge
  const isExplicitLogoRequest = /\b(logo|icon|emblem|symbol|brand mark|badge|favicon|avatar)\b/i.test(lower);
  if (!isExplicitLogoRequest) {
    return null;
  }

  // If user is searching or inquiring about facts/company, never hijack to a logo
  if (/\b(search|google|dhoondo|dhundo|pata karo|find|lookup|details|facts?|information|profile|company|solutions)\b/i.test(lower)) {
    return null;
  }

  // Check if prompt mentions a known brand
  for (const [key, info] of Object.entries(KNOWN_BRAND_DOMAINS)) {
    const rx = new RegExp(`(^|[^a-z0-9])${key}([^a-z0-9]|$)`, 'i');
    if (rx.test(lower)) {
      return {
        brand: info.name,
        domain: info.domain,
        url: `https://unavatar.io/${info.domain}`,
        fallbackUrl: `https://www.google.com/s2/favicons?domain=${info.domain}&sz=128`,
        isOfficialBrand: true
      };
    }
  }

  // Check if user provided an explicit domain name (e.g., example.com logo)
  const domainMatch = lower.match(/\b([a-z0-9-]+(?:\.[a-z]{2,}))\b/i);
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

  return null;
}

/**
 * Retrieve Hugging Face User Access Token from localStorage or environment
 */
export function getHfToken() {
  try {
    const stored = localStorage.getItem('devnexes_hf_token');
    if (stored && stored.trim()) return stored.trim();
  } catch { }
  return import.meta.env?.VITE_HF_TOKEN ||
    import.meta.env?.HF_TOKEN ||
    import.meta.env?.VITE_HUGGINGFACE_API_KEY ||
    import.meta.env?.HUGGINGFACE_API_KEY ||
    '';
}

/**
 * Save Hugging Face User Access Token to localStorage
 */
export function saveHfToken(token) {
  try {
    if (typeof token === 'string' && token.trim()) {
      localStorage.setItem('devnexes_hf_token', token.trim());
    } else {
      localStorage.removeItem('devnexes_hf_token');
    }
  } catch { }
}

/**
 * Retrieve Stability AI API key from localStorage or environment
 */
export function getStabilityApiKey() {
  try {
    const stored = localStorage.getItem('devnexes_stability_key');
    if (stored && stored.trim()) return stored.trim();
  } catch { }
  return import.meta.env?.VITE_STABILITY_API_KEY ||
    import.meta.env?.STABILITY_API_KEY ||
    '';
}

/**
 * Save Stability AI API key to localStorage
 */
export function saveStabilityApiKey(key) {
  try {
    if (typeof key === 'string' && key.trim()) {
      localStorage.setItem('devnexes_stability_key', key.trim());
    } else {
      localStorage.removeItem('devnexes_stability_key');
    }
  } catch { }
}

/**
 * Comprehensive Roman Urdu / Urdu translation dictionary for accurate visual synthesis
 */
const ROMAN_URDU_DICTIONARY = [
  // Animals
  [/\b(?:billi|bili|billie|mano|cat)\b/gi, 'cat'],
  [/\b(?:kutta|kuttay|kutte|kutti|dog)\b/gi, 'dog'],
  [/\b(?:sher|babbar sher|singh)\b/gi, 'majestic male lion with full mane'],
  [/\b(?:cheetah|cheeta|tendwa)\b/gi, 'cheetah'],
  [/\b(?:ghora|ghoday|ghode)\b/gi, 'stallion horse'],
  [/\b(?:hathi|haathi)\b/gi, 'elephant'],
  [/\b(?:parinda|parinday|chidiya|chiri)\b/gi, 'vibrant bird'],
  [/\b(?:machli|machhli)\b/gi, 'tropical fish'],
  [/\b(?:bandar)\b/gi, 'monkey'],
  [/\b(?:tota)\b/gi, 'colorful parrot'],
  [/\b(?:bhediya|bhedia)\b/gi, 'wolf'],
  [/\b(?:oont|unt)\b/gi, 'camel in desert'],
  
  // Nature, Scenery & Landmarks
  [/\b(?:pahar|paharon|pahad|pahadi)\b/gi, 'dramatic rocky mountains'],
  [/\b(?:darya|daryah|nadi)\b/gi, 'crystal clear flowing river'],
  [/\b(?:samandar|samundar)\b/gi, 'deep turquoise ocean waves'],
  [/\b(?:darakht|perh|jungle|jangal)\b/gi, 'lush green forest with tall trees'],
  [/\b(?:suraj|aftab)\b/gi, 'golden glowing sun'],
  [/\b(?:chaand|chand|qamar)\b/gi, 'luminous glowing moon'],
  [/\b(?:sitare|taare|tarray)\b/gi, 'starry night sky milky way galaxy'],
  [/\b(?:badal)\b/gi, 'dramatic atmospheric clouds'],
  [/\b(?:barish|barsat)\b/gi, 'cinematic rain reflections'],
  [/\b(?:phool|gulab)\b/gi, 'fresh blooming flowers'],
  [/\b(?:sehra|registan)\b/gi, 'vast golden desert sand dunes'],
  [/\b(?:lahore fort|shahi qila)\b/gi, 'historic Mughal architecture fortress Lahore Fort with grand domes and sandstone walls'],
  [/\b(?:badshahi masjid|masjid)\b/gi, 'magnificent Badshahi Mosque grand Islamic architecture with minarets'],

  // People & Professions
  [/\b(?:larka|larke|munda)\b/gi, 'young man'],
  [/\b(?:larki|kudi)\b/gi, 'young woman'],
  [/\b(?:bacha|bachi|bachay|bachon)\b/gi, 'smiling child'],
  [/\b(?:buzurg|buddha)\b/gi, 'distinguished elderly person'],
  [/\b(?:fauji|jawan|sipahi)\b/gi, 'soldier in combat tactical gear'],
  [/\b(?:police|cop)\b/gi, 'police officer in uniform'],
  [/\b(?:doctor)\b/gi, 'medical doctor in hospital'],
  [/\b(?:shehar)\b/gi, 'modern illuminated city skyline'],
  [/\b(?:ghar|makan|haveli)\b/gi, 'luxurious modern architectural house'],

  // Objects & Vehicles
  [/\b(?:gari|gaari|car)\b/gi, 'sleek luxury sports car'],
  [/\b(?:motorcycle|bike|motobike)\b/gi, 'heavy modern sports motorbike'],
  [/\b(?:jahaz|tayyara)\b/gi, 'commercial airplane flying in sky'],
  [/\b(?:pani ka jahaz|kashti)\b/gi, 'luxury yacht on ocean'],
  [/\b(?:chaaye|chaye|chai)\b/gi, 'hot steaming cup of tea with saucer'],
  [/\b(?:coffee)\b/gi, 'artisan coffee cup with foam art'],
  [/\b(?:kitab|kitabein|kutub)\b/gi, 'vintage leather books on table'],

  // Actions & States
  [/\b(?:laptop chala rhi|laptop chala raha|computer use|coding|computer chala)\b/gi, 'typing on glowing laptop at a desk'],
  [/\b(?:baitha|baithi|betha|bethi)\b/gi, 'sitting comfortably'],
  [/\b(?:khara|khari|khare)\b/gi, 'standing confidently'],
  [/\b(?:bhaag raha|dour raha)\b/gi, 'running dynamically'],
  [/\b(?:ur raha|ud raha)\b/gi, 'flying high in the air'],
  [/\b(?:pani pee raha|pani peeti)\b/gi, 'drinking water from glass'],
  [/\b(?:khubsurat|khoobsurat|pyara|pyari)\b/gi, 'aesthetically stunning, picturesque'],
  [/\b(?:subah|fajar)\b/gi, 'early morning sunrise lighting'],
  [/\b(?:shaam|maghrib)\b/gi, 'golden hour warm sunset'],
  [/\b(?:raat)\b/gi, 'night time, cinematic ambient lighting']
];

/**
 * Retrieve any available Groq API key directly from localStorage / env without circular imports
 */
function getAnyGroqKey() {
  try {
    for (let i = 1; i <= 3; i++) {
      const k = localStorage.getItem(`devnexes_groq_key_${i}`);
      if (k && k.trim()) return k.trim();
    }
  } catch {}
  return import.meta.env?.VITE_GROQ_API_KEY_1 ||
    import.meta.env?.GROQ_API_KEY_1 ||
    import.meta.env?.VITE_GROQ_API_KEY ||
    import.meta.env?.GROQ_API_KEY ||
    '';
}

/**
 * Optimize, translate, and expand image prompt using AI for hyper-accurate FLUX.1 synthesis
 */
export async function optimizeImagePromptWithAI(userPrompt, signal) {
  if (!userPrompt || typeof userPrompt !== 'string') return '';
  const clean = userPrompt.trim();

  const apiKey = getAnyGroqKey();
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second fast timeout
      const combinedSignal = signal || controller.signal;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an elite Image Prompt Engineer for FLUX.1 (Black Forest Labs) and high-end photorealistic diffusion.
Your task: Convert the user's input (which may be in Roman Urdu, Urdu, Hindi, or conversational English) into a single, cohesive, vivid, high-fidelity English visual description.

Rules:
1. Accurately translate any Roman Urdu / Urdu concepts:
   - "billi" -> "cat", "sher" -> "majestic male lion", "pahar" -> "rocky mountains", "gari" -> "modern sports car"
   - "laptop chala rhi" -> "typing on a glowing laptop keyboard on a modern desk"
2. Describe visual subject, environment, lighting (e.g., golden hour, studio volumetric rim lighting), and composition (e.g. 85mm lens, f/1.8, 8k uhd, photorealistic, sharp focus, ray tracing).
3. If user asks for a logo/icon, describe a modern minimalist vector logo on a solid background.
4. Output ONLY the raw prompt string. ZERO preamble, zero explanations, zero quotes.`
            },
            {
              role: 'user',
              content: clean
            }
          ],
          temperature: 0.3,
          max_tokens: 140
        }),
        signal: combinedSignal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const optimized = data.choices?.[0]?.message?.content?.trim();
        if (optimized && optimized.length > 10) {
          return optimized.replace(/^["']|["']$/g, '');
        }
      }
    } catch (err) {
      console.warn('[ImagePromptOptimizer] Fast AI prompt expansion skipped:', err.message);
    }
  }

  // Fallback to rule-based Roman Urdu translator + enhancer
  return enhanceSdPrompt(clean);
}

/**
 * Clean & enhance user prompt for professional, hyper-realistic visual fidelity
 * Eliminates childish/cartoonish ("bacho vali") outputs.
 */
export function enhanceSdPrompt(userPrompt) {
  if (!userPrompt) {
    return 'cinematic 8k photorealistic portrait, master photography, highly detailed, dramatic studio lighting';
  }

  // Strip command triggers & conversational prefixes
  let clean = userPrompt
    .replace(/^\/?(?:image|draw|paint|photo|pic|img|sd)\b/i, '')
    .replace(/\b(?:can you please|could you please|can u please|can u plz|please|plz|can you|can u|could you)\b/gi, '')
    .replace(/\b(?:generate (?:an? )?image of|create (?:an? )?image of|draw (?:an? )?image of|render (?:an? )?image of|photo of|picture of|wallpaper of)\b/gi, '')
    .replace(/\b(?:crete|create|generate|draw|render|paint|make)\s+(?:an? )?(?:image|photo|pic|picture|tasveer|wallpaper|artwork)\s*(?:of)?\b/gi, '')
    .replace(/\b(?:crete|create|generate|make|draw|paint|render|banao|bana do|dikhao|dikhayein)\s*(?:an?|a)?\b/gi, '')
    .replace(/\b(?:image banao|tasveer banao|photo banao|pic banao|logo banao|logo do|generate karo|bana do|banao|dikhao|dikhayein|chahiye|de do)\b/gi, '')
    .replace(/\b(?:an? )?(?:image|photo|pic|picture|tasveer|wallpaper|artwork)\b/gi, '')
    .replace(/\b(?:ki|ke|ka)\b/gi, '')
    .trim();

  // Apply Roman Urdu translation dictionary mapping
  for (const [pattern, replacement] of ROMAN_URDU_DICTIONARY) {
    clean = clean.replace(pattern, replacement);
  }

  // Strip remaining Urdu filler / grammatical connectives
  clean = clean
    .replace(/\b(?:ek|ye|yeh|woh|wo|jo|ko|se|par|pe|me|mein|main|ho|hoti|hota|hote|kuch|kisi|wali|wala|wale|aur|or|toh|to)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const basePrompt = clean.trim() || userPrompt;
  const lower = basePrompt.toLowerCase();

  const isLogo = /\b(logo|icon|emblem|symbol|badge|vector|brand mark)\b/i.test(lower);
  const isCharacter = /\b(iron man|batman|superman|spiderman|avengers|warrior|soldier|knight|robot|cyborg|superhero|hero|ninja|samurai|character)\b/i.test(lower);
  const isPortrait = /\b(portrait|person|man|woman|girl|boy|face|model|human|ceo|doctor|elderly|child|actor|actress)\b/i.test(lower);
  const isLandscape = /\b(landscape|mountain|sunset|sunrise|nature|forest|beach|ocean|river|city|cyberpunk|space|galaxy|desert|scenery|fort|mosque)\b/i.test(lower);
  const isVehicle = /\b(car|supercar|sports car|bike|motorcycle|plane|jet|spaceship|train|yacht|auto)\b/i.test(lower);

  if (isLogo) {
    return `${basePrompt}, professional modern vector logo design, clean sharp geometric lines, minimalist corporate branding, high contrast, centered composition, premium graphic design, svg style`;
  }

  if (isCharacter) {
    return `${basePrompt}, ultra-detailed photorealistic cinematic movie still, 8k uhd, masterpiece, intricately detailed armor, photorealism, realistic textures, volumetric rim lighting, dramatic composition, shot on 35mm lens, f/1.8, sharp focus, ray tracing reflections, cinematic color grading, award-winning photography, hyper-accurate anatomy`;
  }

  if (isPortrait) {
    return `${basePrompt}, master portrait photography, 8k uhd, photorealistic, ultra-sharp focus on eyes, authentic skin texture with natural pores, 85mm portrait lens, shallow depth of field, creamy bokeh, soft cinematic Rembrandt studio lighting, award-winning Hasselblad photograph`;
  }

  if (isLandscape) {
    return `${basePrompt}, breathtaking panoramic landscape photography, 8k resolution, National Geographic masterpiece, hyperdetailed natural lighting, volumetric atmospheric depth, photorealistic textures, sharp focus, golden hour light, majestic vista`;
  }

  if (isVehicle) {
    return `${basePrompt}, photorealistic commercial automotive photography, 8k uhd, sleek metallic reflections, studio rim lighting, hyperdetailed mechanical details, dramatic angles, raytraced reflections, sharp focus`;
  }

  // Default general high-detail realism
  return `${basePrompt}, ultra-realistic, 8k uhd, masterpiece, award-winning photorealism, hyperdetailed, cinematic volumetric lighting, sharp focus, 35mm photograph, octane render, realistic textures, detailed composition`;
}

/**
 * Remove any bottom-corner watermark bar using browser Canvas crop
 */
export function removeWatermarkFromImage(dataUrl) {
  if (typeof window === 'undefined' || !dataUrl || typeof dataUrl !== 'string') {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // If image is small, don't crop
      if (img.height < 320 || img.width < 320) {
        resolve(dataUrl);
        return;
      }

      try {
        const cropBottom = 38; // Cleanly crop the bottom 38px where watermarks sit
        const targetHeight = img.height - cropBottom;

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0, img.width, targetHeight, 0, 0, img.width, targetHeight);
          const cleanUrl = canvas.toDataURL('image/jpeg', 0.95);
          resolve(cleanUrl);
          return;
        }
      } catch { }

      resolve(dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Backend 1: Local AUTOMATIC1111 / ComfyUI / SD.Next WebUI (port 7860)
 */
async function tryLocalWebUi({ prompt, negativePrompt, width, height, seed, signal }) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const combinedSignal = signal || controller.signal;

    const res = await fetch('http://127.0.0.1:7860/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        steps: 28,
        cfg_scale: 7.5,
        width: Math.min(width, 768),
        height: Math.min(height, 768),
        seed: seed || -1
      }),
      signal: combinedSignal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.images && data.images[0]) {
        return `data:image/png;base64,${data.images[0]}`;
      }
    }
  } catch { }
  return null;
}

/**
 * Backend 2: Official Hugging Face Serverless Inference API (runwayml/stable-diffusion-v1-5)
 */
async function tryHuggingFaceInference({ prompt, negativePrompt, width, height, seed, token, signal }) {
  if (!token) return null;

  const endpoints = [
    `https://router.huggingface.co/hf-inference/models/${SD_15_MODEL}`,
    `https://api-inference.huggingface.co/models/${SD_15_MODEL}`
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: negativePrompt,
            guidance_scale: 7.5,
            num_inference_steps: 30,
            width: Math.min(width, 768),
            height: Math.min(height, 768),
            seed
          }
        }),
        signal
      });

      if (res.ok) {
        const blob = await res.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (err) {
      console.warn(`[ImageEngine] Hugging Face endpoint ${endpoint} failed:`, err.message);
    }
  }
  return null;
}

/**
 * Supported SDXL v1.0 standard aspect ratio dimensions.
 * SDXL requires specific pixel dimensions for optimal composition and speed.
 */
function getClosestSdxlDimension(width = 1024, height = 1024) {
  const allowed = [
    { w: 1024, h: 1024 }, // 1:1 Square
    { w: 1152, h: 896 },  // 4:3 Landscape
    { w: 1216, h: 832 },  // 3:2 Landscape
    { w: 1344, h: 768 },  // 16:9 Landscape
    { w: 1536, h: 640 },  // 21:9 Ultra-wide
    { w: 896, h: 1152 },  // 3:4 Portrait
    { w: 832, h: 1216 },  // 2:3 Portrait
    { w: 768, h: 1344 },  // 9:16 Mobile / Stories
    { w: 640, h: 1536 }   // Tall banner
  ];

  const targetRatio = (width || 1024) / (height || 1024);
  let best = allowed[0];
  let minDiff = Math.abs((best.w / best.h) - targetRatio);

  for (const dim of allowed) {
    const diff = Math.abs((dim.w / dim.h) - targetRatio);
    if (diff < minDiff) {
      minDiff = diff;
      best = dim;
    }
  }
  return best;
}

/**
 * Backend 3: Official Stability AI REST API (Stable Diffusion XL 1.0)
 * Uses high-fidelity SDXL v1.0 directly from Stability AI's official endpoints.
 */
async function tryStabilityAi({ prompt, negativePrompt, width, height, seed, apiKey, signal }) {
  if (!apiKey) return null;

  const dim = getClosestSdxlDimension(width, height);

  try {
    const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        text_prompts: [
          { text: prompt, weight: 1 },
          { text: negativePrompt, weight: -1 }
        ],
        cfg_scale: 7,
        height: dim.h,
        width: dim.w,
        steps: 30,
        samples: 1,
        seed: seed || undefined
      }),
      signal
    });

    if (res.ok) {
      const data = await res.json();
      const base64 = data.artifacts?.[0]?.base64;
      if (base64) {
        return `data:image/png;base64,${base64}`;
      }
    } else {
      const errText = await res.text();
      console.warn('[ImageEngine] Stability AI returned non-200 status:', res.status, errText);
    }
  } catch (err) {
    console.warn('[ImageEngine] Stability AI API error:', err.message);
  }
  return null;
}

/**
 * Helper to convert data URL or base64 to Blob
 */
async function dataUrlToBlob(dataUrl) {
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch { }
  }
  const parts = dataUrl.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Backend 3B: Stability AI Image-to-Image (SDXL 1.0)
 * Performs structural continuity editing with 65% structure retention from initImage.
 */
async function tryStabilityAiImg2Img({ prompt, negativePrompt, initImage, seed, apiKey, signal }) {
  if (!apiKey || !initImage || typeof initImage !== 'string') return null;

  try {
    const imageBlob = await dataUrlToBlob(initImage);
    if (!imageBlob) return null;

    const formData = new FormData();
    formData.append('init_image', imageBlob);
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    if (negativePrompt) {
      formData.append('text_prompts[1][text]', negativePrompt);
      formData.append('text_prompts[1][weight]', '-1');
    }
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', '0.35'); // Preserves 65% of original structure/geometry!
    formData.append('cfg_scale', '7');
    formData.append('steps', '30');
    formData.append('samples', '1');
    if (seed) {
      formData.append('seed', String(seed));
    }

    const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: formData,
      signal
    });

    if (res.ok) {
      const data = await res.json();
      const base64 = data.artifacts?.[0]?.base64;
      if (base64) {
        return `data:image/png;base64,${base64}`;
      }
    } else {
      const errText = await res.text();
      console.warn('[ImageEngine] Stability AI img2img warning:', res.status, errText);
    }
  } catch (err) {
    console.warn('[ImageEngine] Stability AI img2img error:', err.message);
  }
  return null;
}

/**
 * Main Image Generation Entry Point
 * Generates ultra-detailed, photorealistic images using official Stable Diffusion (Stability AI SDXL 1.0, Hugging Face, or Local WebUI).
 * 100% free of external scrapers or pollinations.ai.
 */
export async function generateStableDiffusionImage({
  prompt,
  negativePrompt = 'cartoon, anime, 3d animation, childish, amateur, doll, plastic skin, low quality, deformed anatomy, bad proportions, bad face, disfigured, blurry, low resolution, bad eyes, oversaturated, amateur sketch, watermark, logo, text, signature',
  width = 1024,
  height = 1024,
  seed = null,
  initImage = null,
  isModification = false,
  signal
}) {
  // 0. Check if this is an authentic brand logo request
  // (Displays genuine official logo/favicon directly without running generative diffusion)
  const officialBrand = detectOfficialBrandLogo(prompt);
  if (officialBrand) {
    return {
      url: officialBrand.url,
      fallbackUrl: officialBrand.fallbackUrl,
      prompt: `${officialBrand.brand} Logo`,
      originalPrompt: prompt,
      seed: 1001,
      width: 512,
      height: 512,
      isOfficialBrand: true,
      brandName: officialBrand.brand,
      domain: officialBrand.domain
    };
  }

  // Consistent seed retention: if modifying, keep exact seed, else pick random
  const finalSeed = seed ? Number(seed) : Math.floor(Math.random() * 9999999);

  // Intelligent AI / Linguistic Prompt Enhancement (translates Roman Urdu / Urdu and details photorealism)
  const enrichedPrompt = await optimizeImagePromptWithAI(prompt, signal);

  const stabilityKey = getStabilityApiKey();
  const hfToken = getHfToken();

  try {
    // 1. If modifying an existing image with initImage, try direct Stability AI Image-to-Image first
    if (initImage && stabilityKey) {
      const img2imgResult = await tryStabilityAiImg2Img({
        prompt: enrichedPrompt,
        negativePrompt,
        initImage,
        seed: finalSeed,
        apiKey: stabilityKey,
        signal
      });
      if (img2imgResult) {
        return {
          url: img2imgResult,
          prompt: enrichedPrompt,
          originalPrompt: prompt,
          seed: finalSeed,
          width,
          height,
          isModified: true
        };
      }
    }

    // 2. Priority 1: Official Stability AI REST API (Stable Diffusion XL 1.0) with consistent seed
    if (stabilityKey) {
      const stabilityResult = await tryStabilityAi({
        prompt: enrichedPrompt,
        negativePrompt,
        width,
        height,
        seed: finalSeed,
        apiKey: stabilityKey,
        signal
      });
      if (stabilityResult) {
        return {
          url: stabilityResult,
          prompt: enrichedPrompt,
          originalPrompt: prompt,
          seed: finalSeed,
          width,
          height,
          isModified: Boolean(isModification || initImage)
        };
      }
    }

    // 2. Priority 2: Official Hugging Face Serverless Inference API (Stable Diffusion 1.5)
    if (hfToken) {
      const hfResult = await tryHuggingFaceInference({
        prompt: enrichedPrompt,
        negativePrompt,
        width,
        height,
        seed: finalSeed,
        token: hfToken,
        signal
      });
      if (hfResult) {
        return {
          url: hfResult,
          prompt: enrichedPrompt,
          originalPrompt: prompt,
          seed: finalSeed,
          width,
          height,
          engine: 'Hugging Face Stable Diffusion 1.5'
        };
      }
    }

    // 3. Priority 3: Local AUTOMATIC1111 / ComfyUI WebUI on port 7860
    const localResult = await tryLocalWebUi({
      prompt: enrichedPrompt,
      negativePrompt,
      width,
      height,
      seed: finalSeed,
      signal
    });
    if (localResult) {
      return {
        url: localResult,
        prompt: enrichedPrompt,
        originalPrompt: prompt,
        seed: finalSeed,
        width,
        height,
        engine: 'Local SD WebUI (127.0.0.1:7860)'
      };
    }
  } catch (err) {
    console.warn('[ImageEngine] Stable Diffusion generation error:', err?.message);
  }

  // If no generation backend succeeded, return a graceful error status
  return {
    error: true,
    message: stabilityKey
      ? 'Stability AI API request mukammal nahi ho saki. Apni API key credits ya network check karein.'
      : 'Stable Diffusion API key set nahi hai. Barah-e-karam .env ya Settings mein apni Stability AI key enter karein.',
    prompt: enrichedPrompt,
    originalPrompt: prompt,
    seed: finalSeed,
    width,
    height
  };
}
