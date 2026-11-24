/**
 * Devnexes AI — Dynamic Agent Engine
 * 
 * 1:1 Implementation of the Agent Chat Architecture from agent-chat.html:
 * - 4-Mode Intake (MODE: GENERAL, MODE: TASK, MODE: ASK, MODE: IMAGE)
 * - Real-time streaming intake with first-line mode parsing
 * - Single-pass Vision Extraction (notes extracted once, raw images never re-sent)
 * - Dynamic Task Loop with 7 Principles and Notebook state
 * - Helper Compactor & Classifier via GPT-OSS 20B (facts compacting, search compacting, reply intent)
 * - Main Brain via GPT-OSS 120B (with Llama 3.3 70B fallback)
 * - Code Generation via Gemini (gemini-2.5-flash) with NOTE: line extraction, fallback to Groq
 * - Real-time Web Grounding via Tavily with helper compaction & Markdown source citations
 * - Image Generation & Editing via Stability AI (generate, variation, replace, recolor, remove_bg, upscale)
 * - Stuck Detection (repeating move signature tracking & escape)
 * - Natural updates (silent on light tasks, throttled single-line updates on heavy tasks)
 * - Exact {{id}} artifact stitching & zero-code-repetition delivery
 * - Background conversation summarization
 */

import {
  callGroqChatJson,
  streamGroqChat,
  DEFAULT_GROQ_MODEL,
  getAvailableGroqKey
} from './groqService.js';
import { getAvailableGeminiKey, markGeminiKeyCooldown } from './geminiService.js';
import { getSearchKeys } from './searchService.js';
import { getStabilityApiKey, generateStableDiffusionImage } from './imageService.js';
import { ingestWorkspaceFiles, createWorkspaceReader } from './fileReaderService.js';
import {
  ragManager,
  formatRagChunksForPrompt
} from './ragEngine.js';
import {
  retrieveRelevantMemories,
  formatMemoriesForPrompt,
  analyzeAndLearnFromTurn
} from './memoryRagService.js';
import {
  detectUserLanguageStyle,
  detectUrduScript,
  isUrduOrHindi,
  detectProgrammingLanguageDynamically,
  isWebsiteOrWebUiRequest,
  isRealApiKey
} from '../utils/dynamicNLP.js';

/* ---------- Config & Models ---------- */
export const EFFORT = { intake: 'low', step: 'medium', helper: 'low' };

export const AGENT_MODELS = {
  main: 'openai/gpt-oss-120b',
  mainFallback: 'llama-3.3-70b-versatile',
  helper: 'openai/gpt-oss-20b',
  helperFallback: 'llama-3.1-8b-instant',
  vision: 'qwen/qwen3.8-27b',
  visionFallback: 'llama-3.2-11b-vision-preview',
  gemini: 'gemini-2.5-flash'
};

const uid = () => Math.random().toString(36).slice(2, 9);
const nowStr = () => new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' });
const stripThink = (s = '') => (s || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

function parseJSON(s) {
  if (!s) return null;
  s = s.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch (e) { }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { }
  }
  return null;
}

function cleanCode(str = '') {
  return str
    .replace(/^```[a-zA-Z0-9_-]*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

/* ---------- Active Runs Registry (for pause & resume across turns) ---------- */
const activeRunsRegistry = new Map();

export function getWaitingRun(convId) {
  if (!convId) return null;
  const run = activeRunsRegistry.get(convId);
  return run && run.status === 'waiting_user' ? run : null;
}

export function saveWaitingRun(convId, run) {
  if (!convId || !run) return;
  run.status = 'waiting_user';
  activeRunsRegistry.set(convId, run);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`devnexes_agent_run_${convId}`, JSON.stringify(run));
    }
  } catch { }
}

export function clearWaitingRun(convId) {
  if (!convId) return;
  activeRunsRegistry.delete(convId);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`devnexes_agent_run_${convId}`);
    }
  } catch { }
}

export function loadWaitingRunFromStorage(convId) {
  if (!convId) return null;
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`devnexes_agent_run_${convId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status === 'waiting_user') {
          activeRunsRegistry.set(convId, parsed);
          return parsed;
        }
      }
    }
  } catch { }
  return null;
}

/* ---------- Conversation Workspace Cache (persists files across turns in the same chat) ---------- */
const conversationWorkspaceCache = new Map();

export function getConversationWorkspace(convId) {
  if (!convId) return null;
  return conversationWorkspaceCache.get(convId) || null;
}

export function setConversationWorkspace(convId, workspace) {
  if (!convId || !workspace) return;
  conversationWorkspaceCache.set(convId, workspace);
}

export function clearConversationWorkspace(convId) {
  if (!convId) return;
  conversationWorkspaceCache.delete(convId);
}

/* ---------- Prompts (Enhanced with Website & Code Engine Architecture) ---------- */
const INTAKE_SYS = `You are a smart, friendly assistant inside a chat app. Always answer in the user's own language and style (Roman Urdu stays Roman Urdu, English stays English, and so on).

Your reply MUST begin with one of these first lines, alone on the line:
MODE: GENERAL
MODE: TASK
MODE: ASK
MODE: IMAGE

MODE: GENERAL - then, on the following lines, write the complete answer. Choose it when everything in the message can be answered well in one go from your own knowledge: questions, explanations, chat, advice, short code, how-to commands. A message may hold several questions; answer all of them. Never choose it when the answer needs live or recent information (news, prices, scores, weather, "latest", "today", "current", anything after your knowledge): that is TASK.

MODE: TASK - then output ONLY this JSON and nothing else:
{"asks":[{"id":"a1","text":"short restatement of one thing the user wants","type":"general|task"}],"weight":"light|heavy","language":"the user's language and style"}
Choose it when the work needs several dependent parts, a long document or program, analysis of provided material or an image, live web information, or whenever one reply would be weak. Split the message into separate asks. Mark an ask "general" if it can simply be answered in the final reply with no extra work. weight "light" = quick (one or two short moves); "heavy" = long, or the user will have to wait.

MODE: ASK - then output ONLY: {"questions":[{"question":"...","options":["...","..."]}]} with 1-3 short questions and 2-4 short options each. Use it when the request is open-ended or big (an app, plan, project, roadmap) and key choices are missing; a good teammate asks first. Do not ask when the request is simple or fully specified.
IMPORTANT EXCEPTION: NEVER use MODE: ASK for website, landing page, portfolio, or UI creation requests. The user wants immediate code generation in HTML/CSS/JS!

MODE: IMAGE - then output ONLY this JSON: {"op":"generate|variation|replace|recolor|remove_bg|upscale","prompt":"...","negative":"...","aspect":"1:1","search":"","strength":0.5,"keep_seed":false,"reply":"..."}
Choose it when the user wants a picture created, or an earlier generated image changed. If the message says "[image generation available: no]", choose GENERAL instead and tell the user to add the Stability API key in Settings.
op "generate" = a new picture. Write "prompt" in English as a rich, specific description: the subject and every detail the user named (never drop or alter them, never add objects they did not ask for), setting, composition, camera angle and lens, lighting, mood, style or medium, colors, then quality words such as "highly detailed, sharp focus, professional". If the user wants text inside the picture, include that exact text. "negative" = what to avoid (blurry, low quality, deformed hands, extra limbs, watermark). "aspect" = one of 1:1, 16:9, 9:16, 3:2, 2:3, 4:5, 21:9, chosen to fit the subject.
Changes to the last image (only when "[last image exists]"): "replace" = swap one object for another (search = the object to find, prompt = what should be there); "recolor" = change the color of an object (search = the object, prompt = the new color); "remove_bg" = cut out the background; "upscale" = more resolution and detail; "variation" = the same picture with a modified prompt (strength 0.3 = small change, 0.7 = big change; prompt = the last prompt plus the requested change). For a small tweak of the whole scene you may use "generate" with keep_seed true and the last prompt edited. "reply" = one short friendly sentence in the user's language shown with the image.

You cannot run commands or programs. If asked for a command, write it for the user; never pretend you ran it.

OUTPUT ACCURACY & USER-FRIENDLY QUALITY RULES:
- WEBSITE & WEB UI CREATION MANDATE: When the user asks to build, create, or design ANY website, web page, landing page, portfolio, ecommerce store, web app, or frontend UI (e.g. "website bana do", "make a gym website", "landing page design karo"):
  * NEVER choose MODE: ASK. Do not delay the user with questions.
  * ALWAYS choose MODE: TASK with a single ask of type "task" to craft the complete interactive website.
- ZERO EXCESSIVE PLACEHOLDERS: Never output documents or responses littered with annoying bracket placeholders like [Supervisor/Manager ka Naam], [number of days], [start date], [end date], [Aapka Naam], [Contact Number], [Email Address]. When drafting letters, emails, code or applications, provide realistic, natural details directly so the text is immediately copy-paste ready, clean, and complete.
- NO PATRONIZING BOILERPLATE: Never append chatty boilerplate instructions like "Just replace the placeholders in brackets with your actual information and you're good to go! If you need a version in Urdu script or any other tweaks, let me know." Deliver direct, accurate, high-taste responses without extra fluff.
- ATTACHED WORKSPACE & FILE PERSISTENCE: When '[attached files available: N]' or '[Attached File: ...]' or '[Attached Files Content]' is provided, the user already uploaded these files in this chat. They persist for the entire conversation. NEVER tell the user to upload or re-attach the file again, and NEVER ask if you should paste file content. Answer their questions directly, accurately, and authoritatively from the provided file content.`;

const STEP_SYS = `You are the working brain of a helpful coding and research assistant. You work in an Agentic ReAct Loop (Reasoning + Acting + Observing).
Each call you receive the user's request, the available tools, and a NOTEBOOK of what is already done and observed, and you make exactly ONE next move, returned as a single JSON object.

PRINCIPLES
1. Every move must be useful: its output goes into the final answer or is needed by a later move. If you cannot say which, do not make it.
2. Be economical with tokens. Finish as soon as every ask is satisfied; no polishing, no extras. Handle independent asks in one move. Asks of type "general" need no move at all: answer them inside "final".
3. If you can complete everything right now, use action "finish" immediately. Once search results, file readings, or working facts are acquired, do not emit repetitive "think" moves; synthesize the answer immediately inside action "finish".
4. The user must never see the machinery: no step numbers, phases, "notebook", "loop", tool or model names. Anything the user reads (tell_user, question, final) must sound like one helpful person talking, in the user's language and style ("language").
5. tell_user: default "" (empty). Fill it only when weight is "heavy" AND the wait will be long or you just found or made something the user would care about. One short sentence about what you found or are making, never about process. Never repeat anything in updates_sent.
6. ask: only when essential information is missing and a wrong guess would waste real work or change the result. Otherwise assume sensibly and put the assumption in "assumption". Put every question in a single message, with 2-4 short options when possible.
7. Available actions:
   - When workspace_files are provided in the notebook or prompt, you already have their contents. Finish and answer immediately using action "finish". Do not emit repetitive "file_read" moves to re-read files you already have. Only use "file_read" if a specific large file slice was truncated.
   - For real-time or recent web information, use "search".
   - To build/generate code or fix bugs, use "code".
   - You cannot run shell commands or modify disk files directly.
8. Anything that needs current or live information must use search. In the final answer keep the [n] source markers next to facts taken from search.
9. Never rewrite an artifact. In "final" put {{id}} exactly where an artifact listed in the notebook must appear; it is inserted as-is. Only use ids that exist.
10. Follow all active rules in the notebook's active_knowledge_and_rules strictly, and avoid repeating any past mistakes or anti-patterns mentioned there.
11. WEBSITE & WEB UI CODING PROTOCOL:
    - Whenever the user asks to build or design a website, web page, landing page, portfolio, e-commerce store, or frontend UI:
      * The action MUST be "code".
      * The "spec" MUST direct the coding engine to generate a complete, self-contained, single-file interactive HTML document ("index.html") with Tailwind CSS CDN, Lucide Icons CDN, Google Fonts, and embedded Vanilla JS.
      * Include all semantic sections: Sticky Navbar with working mobile hamburger drawer, Hero with badge & dual CTAs, detailed Features Grid with icons, Interactive Component (category filter / pricing toggle / live search), Testimonials, FAQ Accordion with JS toggle, CTA banner, and Multi-column Footer.
      * ZERO PLACEHOLDERS: Prohibit "<!-- TODO -->", "// rest of code", and dummy empty blocks. Ensure rich, realistic copy and full styling.

OUTPUT: one JSON object with the keys:
"serves": id of the ask this move serves,
"purpose": one short line (max 12 words, in the user's language) - what this move does for the user,
"action": "think" | "search" | "file_read" | "file_search" | "code" | "ask" | "finish",
"done_asks": ids of asks that are fully handled after this move,
"tell_user": "",
"assumption": "" (only when you assumed something the user should know),
and, by action:
 think       -> "result": the facts you worked out (max 120 words, compact). Optional "artifact": {"title","content","deliver":true|false} for bigger content (a draft, document, table); deliver:true means it reaches the user as-is.
 search      -> "query": a short, focused web query
 file_read   -> "path": relative path from workspace_files to inspect, "offset": starting char index (default 0)
 file_search -> "query": text or symbol to search for across codebase files
 code        -> "title" and "spec": a complete, self-contained instruction for an expert programmer (language, features, constraints, file names, any needed facts)
 ask         -> "questions": [{"question","options"}] (1-3 questions, 2-4 short options each)
 finish      -> "final": the complete answer for the user, covering all asks in the order the user gave them. Quality rule: never spam bracket placeholders like [Name], [Number], [Date]; use realistic details directly. No patronizing filler like 'just replace the placeholders'. "followups": 2-3 things the user may want next (under 7 words each, in the user's language)`;

const WEBSITE_ENGINE_PROMPT = `You are Devnexes AI's Principal Frontend Architect and Elite UI/UX Designer.
You specialize in building world-class, production-grade, highly polished, interactive websites.

MANDATE: ALWAYS BUILD A COMPLETE, SELF-CONTAINED, SINGLE-FILE INTERACTIVE HTML DOCUMENT (HTML + Tailwind CSS CDN + Lucide Icons CDN + Vanilla JS).
The output must run directly inside a browser iframe or web preview with zero build step, zero dependencies, and zero setup.

CRITICAL ARCHITECTURAL STANDARDS:
1. STANDALONE HTML STRUCTURE:
   - Start with <!DOCTYPE html><html lang="en" class="scroll-smooth">.
   - Include Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
   - Include Lucide Icons CDN: <script src="https://unpkg.com/lucide@latest"></script>
   - Include Google Fonts (Plus Jakarta Sans or Inter):
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
   - Tailwind Customization in <script>:
     <script>
       tailwind.config = {
         darkMode: 'class',
         theme: {
           extend: {
             fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
             colors: {
               brand: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' }
             }
           }
         }
       }
     </script>
   - Custom styling in <style>:
     Smooth scrollbar, glassmorphism utilities (.glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }), custom hover glow, and subtle animations.

2. COMPREHENSIVE PRODUCTION-GRADE SECTIONS (MUST BUILD ALL):
   Every website MUST be richly populated with realistic, compelling copy tailored specifically to the user's domain (e.g. gym, crypto, coffee shop, agency, dental, SaaS, portfolio):
   a. STICKY NAVBAR:
      - Brand Logo with Lucide icon + bold typography.
      - Desktop navigation links with active state indicator and smooth anchor scrolling.
      - Call to Action button (e.g., "Get Started", "Book Appointment", "Join Now").
      - WORKING MOBILE HAMBURGER BUTTON & DRAWER: A hamburger button (<button id="mobileMenuBtn">) that smoothly toggles a slide-down or slide-in mobile navigation menu (<div id="mobileMenu" class="hidden ...">) in JavaScript.
   b. HERO SECTION:
      - Status/announcement pill badge with an icon (e.g., "⚡ Next-Gen 2.0 Released").
      - Eye-catching headline with vibrant gradient text highlights.
      - Clear, compelling subheadline explaining value proposition and benefit.
      - Dual Action CTAs (Primary prominent button + Secondary outline button with icon).
      - Social proof banner: 5-star rating (★★★★★), "Trusted by 10,000+ active users", or client company logos.
      - Visual Mockup / Interactive Hero Card: A sleek card preview or dashboard illustration built in pure HTML/CSS.
   c. FEATURES & CAPABILITIES GRID:
      - 4 to 6 comprehensive feature cards with unique Lucide icons in colored rounded containers.
      - Deep descriptive copy (not just 1 sentence), bullet points, and "Learn more →" micro-links.
      - Smooth hover transforms (hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300).
   d. LIVE INTERACTIVE ELEMENT (MANDATORY FUNCTIONING JAVASCRIPT):
      - Build a real, engaging interactive component tailored to the website's topic:
        * E-commerce / Menu / Portfolio: Interactive Category Filter Tabs (All, Popular, New, Featured) that filter cards in real-time in JS!
        * SaaS / Gym / Services: Interactive Billing Toggle (Monthly / Annual with 20% Discount Badge) that dynamically changes pricing numbers with animation in JS!
        * Directory / Real Estate: Live search input that filters cards as the user types!
        * Financial / Booking: Interactive cost estimator or calculator form with instant calculation!
   e. SOCIAL PROOF & TESTIMONIALS:
      - 3+ realistic testimonial cards with verified client avatars (Dicebear or Unsplash URLs), client names, roles, company, 5-star ratings, and authentic quotes.
   f. INTERACTIVE FAQ ACCORDION:
      - 4 to 5 detailed, realistic Q&As addressing common customer questions.
      - Smooth accordion open/close logic in JS with rotating chevron icons.
   g. HIGH-IMPACT CALL TO ACTION (CTA) SECTION:
      - Contrasting gradient or dark background section with email signup input or booking trigger with instant feedback.
   h. COMPLETE MULTI-COLUMN FOOTER:
      - Brand summary, Product links, Company links, Resources links, Legal notices, Social media icons, and dynamic copyright year.

3. EMBEDDED JAVASCRIPT LOGIC (INSIDE <script>):
   - Mobile hamburger menu toggle with overlay animation.
   - FAQ accordion expand/collapse handler.
   - Interactive component handlers (tabs, category filters, pricing toggle, search, or calculator).
   - Form submission handler: event.preventDefault() with a stylish, temporary toast notification or badge confirming success (no page reloads!).
   - MUST CALL lucide.createIcons(); on DOMContentLoaded AND after any DOM manipulations so all icons render crisp and sharp.

4. ABSOLUTE ZERO-PLACEHOLDER MANDATE:
   - Strictly NEVER write "// TODO: add more items", "<!-- add more cards here -->", "/* rest of code */", "[Your Name]", or "Lorem ipsum dolor sit amet".
   - Every single headline, card, paragraph, pricing tier, and review must contain full, realistic, natural, engaging content specifically crafted for the requested website topic.

5. OUTPUT FORMAT:
   - Output ONLY the single complete, self-contained HTML document inside one fenced block:
   \`\`\`html
   <!DOCTYPE html>
   ...
   \`\`\`
   - The very last line must be: NOTE: <one short line describing the built website and features>`;

const CODE_SYS = `You are an expert programmer. Write complete, working, production-grade, clean code for the spec.
Rules:
- Never use placeholder comments like "// TODO", "// rest of code here", "/* add implementation */", or bracket placeholders.
- Always provide the full, complete implementation ready to run without missing imports or incomplete logic.
- Reply with the code in fenced blocks (one block per file, with the file name on the line just above it) and almost no prose. Do not claim to have run or tested anything.
The very last line must be: NOTE: <one short line saying what you built and any assumptions>`;

/* ---------- Model Call Wrappers with Automatic Fallbacks ---------- */
async function callBrainJson({ messages, maxTokens = 7000, temperature = 0.3, effort = EFFORT.step, signal }) {
  try {
    return await callGroqChatJson({
      messages,
      model: AGENT_MODELS.main,
      maxTokens,
      temperature,
      responseFormatJson: true,
      signal
    });
  } catch (err) {
    console.warn(`[Agent Brain] ${AGENT_MODELS.main} failed: ${err.message}. Trying ${AGENT_MODELS.mainFallback}...`);
    return await callGroqChatJson({
      messages,
      model: AGENT_MODELS.mainFallback,
      maxTokens,
      temperature,
      responseFormatJson: true,
      signal
    });
  }
}

async function callHelperJson({ messages, maxTokens = 600, temperature = 0.2, signal }) {
  try {
    return await callGroqChatJson({
      messages,
      model: AGENT_MODELS.helper,
      maxTokens,
      temperature,
      responseFormatJson: true,
      signal
    });
  } catch (err) {
    console.warn(`[Agent Helper] ${AGENT_MODELS.helper} failed: ${err.message}. Trying ${AGENT_MODELS.helperFallback}...`);
    return await callGroqChatJson({
      messages,
      model: AGENT_MODELS.helperFallback,
      maxTokens,
      temperature,
      responseFormatJson: true,
      signal
    });
  }
}

/* ---------- Network: Gemini & Groq Code Engine ---------- */
async function geminiGenerateCode(spec, signal, memoryContext = '', isWeb = false) {
  const baseSys = isWeb ? WEBSITE_ENGINE_PROMPT : CODE_SYS;
  const systemText = memoryContext
    ? `${baseSys}\n\n${memoryContext}`
    : baseSys;

  const candidateModels = [
    AGENT_MODELS.gemini || 'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    const activeModel = candidateModels[attempt] || candidateModels[0];
    const keyObj = getAvailableGeminiKey();
    const currentKey = keyObj?.key;
    const currentIndex = keyObj?.index ?? 0;

    if (!currentKey) {
      console.warn('[Gemini Code Engine] No available Gemini API key configured or all in cooldown.');
      return '';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:generateContent`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': currentKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents: [{ role: 'user', parts: [{ text: spec }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 8192
          }
        }),
        signal
      });

      if (res.status === 429 || res.status === 503) {
        console.warn(`[Gemini Code Engine] Key #${currentIndex + 1} rate limited on ${activeModel}. Rotating key...`);
        markGeminiKeyCooldown(currentIndex);
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }

      if (!res.ok) {
        console.warn(`[Gemini Code Engine] Model ${activeModel} status ${res.status}. Trying next candidate model...`);
        continue;
      }

      const j = await res.json();
      const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
      const codeOutput = parts.map(p => p.text || '').join('');
      if (codeOutput && codeOutput.trim()) {
        return codeOutput;
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.warn(`[Gemini Code Engine] Attempt ${attempt + 1} on ${activeModel} error:`, e.message);
      if (attempt === 2) return '';
    }
  }
  return '';
}

async function writeCode(spec, signal, memoryContext = '', isWeb = false) {
  let text = '';
  try {
    text = await geminiGenerateCode(spec, signal, memoryContext, isWeb);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    text = '';
  }

  // Seamless fallback to Groq flagship models if Gemini keys are temporarily offline
  if (!text) {
    const baseSys = isWeb ? WEBSITE_ENGINE_PROMPT : CODE_SYS;
    const groqSystemPrompt = memoryContext
      ? `${baseSys}\n\n${memoryContext}`
      : baseSys;
    text = await callGroqChatJson({
      messages: [
        { role: 'system', content: groqSystemPrompt },
        { role: 'user', content: spec }
      ],
      model: AGENT_MODELS.main,
      temperature: 0.25,
      responseFormatJson: false,
      signal
    });
  }

  let note = isWeb ? 'Complete interactive HTML/CSS/JS website built' : 'code written';
  const m = (text || '').match(/\n\s*NOTE:\s*([^\n]+)\s*$/i);
  if (m) {
    note = m[1].trim();
    text = text.slice(0, m.index);
  }
  return { content: (text || '').trim(), note };
}

/* ---------- Network: Tavily Live Search ---------- */
async function tavilySearch(query, signal) {
  const { tavilyKey } = getSearchKeys();
  if (!tavilyKey) throw new Error('Search key set nahi hai');

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tavilyKey}` },
    body: JSON.stringify({ api_key: tavilyKey, query, search_depth: 'basic', max_results: 5, include_answer: true }),
    signal
  });
  if (!res.ok) throw new Error(`Search error ${res.status}`);
  return await res.json();
}

async function compactSearch(query, answer, results, signal) {
  const parts = [];
  if (answer) parts.push('Summary: ' + answer);
  results.forEach(r => parts.push('[' + r.n + '] ' + (r.title || '') + ': ' + String(r.content || '').slice(0, 600)));
  const raw = parts.join('\n');
  if (raw.length < 1400) return raw;

  try {
    const s = await callGroqChatJson({
      messages: [
        { role: 'system', content: 'Extract only the facts relevant to the query. Max 170 words. Keep source markers like [3] next to each fact. No filler.' },
        { role: 'user', content: 'Query: ' + query + '\n\n' + raw }
      ],
      model: AGENT_MODELS.helper,
      maxTokens: 450,
      temperature: 0.2,
      responseFormatJson: false,
      signal
    });
    return stripThink(s) || raw.slice(0, 1400);
  } catch {
    return raw.slice(0, 1400);
  }
}

/* ---------- Vision: Single-Pass Image Extraction ---------- */
async function readImage(userText, dataUrl, signal) {
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: "Extract everything from this image that could matter for the user's request: any visible text (verbatim but compact), what is shown, and key details. Max 250 words, plain text.\nUser's request: " + (userText || '(none)')
        },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ];

  try {
    const notes = await callGroqChatJson({
      messages,
      model: AGENT_MODELS.vision,
      maxTokens: 700,
      temperature: 0.2,
      responseFormatJson: false,
      signal
    });
    return stripThink(notes);
  } catch (e) {
    console.warn(`[Agent Vision] ${AGENT_MODELS.vision} failed: ${e.message}. Trying ${AGENT_MODELS.visionFallback}...`);
    try {
      const fallbackNotes = await callGroqChatJson({
        messages,
        model: AGENT_MODELS.visionFallback,
        maxTokens: 700,
        temperature: 0.2,
        responseFormatJson: false,
        signal
      });
      return stripThink(fallbackNotes);
    } catch {
      return 'Image attached by user (visual extraction unavailable).';
    }
  }
}

/* ---------- Fact Compactor (Helper Model) ---------- */
async function maybeCompactFacts(nb, signal) {
  const total = nb.facts.reduce((n, f) => n + f.text.length, 0);
  if (total < 3500) return;
  const joined = nb.facts.map(f => (f.ask ? '[' + f.ask + '] ' : '') + f.text).join('\n');
  try {
    const s = await callGroqChatJson({
      messages: [
        { role: 'system', content: 'Merge these working notes into at most 220 words. Keep every ask tag like [a1] and every source marker like [3] next to its fact. Drop duplicates and anything irrelevant.' },
        { role: 'user', content: joined }
      ],
      model: AGENT_MODELS.helper,
      maxTokens: 600,
      temperature: 0.2,
      responseFormatJson: false,
      signal
    });
    if (s && s.trim()) nb.facts = [{ ask: '', text: stripThink(s.trim()) }];
  } catch { }
}

/* ---------- User Reply Classifier (Helper Model) ---------- */
export async function classifyReply(run, text, signal) {
  try {
    const r = await callHelperJson({
      messages: [
        { role: 'system', content: 'Decide what the new user message is. "answer" = a reply to the pending question; "new" = an unrelated new request; "cancel" = the user wants to stop or forget the pending work. Reply JSON: {"kind":"answer|new|cancel"}' },
        { role: 'user', content: 'Pending question: ' + (run.pending?.question || JSON.stringify(run.pending)) + '\nNew message: ' + text }
      ],
      maxTokens: 60,
      temperature: 0,
      signal
    });
    const j = parseJSON(r);
    return j && ['answer', 'new', 'cancel'].includes(j.kind) ? j.kind : 'answer';
  } catch {
    return 'answer';
  }
}

/* ---------- Question Normalizer ---------- */
function normQ(j) {
  if (!j) return null;
  let qs = Array.isArray(j.questions) ? j.questions : (j.question ? [{ question: j.question, options: j.options }] : []);
  qs = qs.filter(x => x && x.question).slice(0, 3).map(x => ({
    question: String(x.question),
    options: Array.isArray(x.options) ? x.options.slice(0, 4).map(String) : []
  }));
  if (!qs.length) return null;
  return {
    question: qs.map(x => x.question).join(' | '),
    options: qs.length === 1 ? qs[0].options : [],
    questions: qs
  };
}

/* ---------- Notebook Formatting for Model ---------- */
function nbForModel(run, tavilyAvailable) {
  const nb = run.nb;
  const hasWorkspace = Boolean(run.workspace && Array.isArray(run.workspace.files) && run.workspace.files.length > 0);
  const p = {
    now: nowStr(),
    tools: {
      search: Boolean(tavilyAvailable),
      file_read: hasWorkspace,
      file_search: hasWorkspace
    },
    weight: run.weight,
    language: run.language,
    asks: nb.asks.map(a => ({ id: a.id, text: a.text, type: a.type, status: a.status })),
    facts: nb.facts.map(f => (f.ask ? '[' + f.ask + '] ' : '') + f.text),
    artifacts: nb.artifacts.map(a => ({ id: a.id, title: a.title, kind: a.kind, note: a.note, deliver: a.deliver })),
    assumptions: nb.assumptions,
    user_answers: nb.answers,
    updates_sent: nb.updates.slice(-3),
    moves_done: nb.log.slice(-6)
  };
  if (hasWorkspace && run.workspace.treeText) {
    p.workspace_files = run.workspace.treeText.slice(0, 2500);
  }
  if (run.relevantMemories && run.relevantMemories.length > 0) {
    p.active_knowledge_and_rules = run.relevantMemories.map(m => `[${m.category}] ${m.title}: ${m.content}`);
  }
  if (run.userText && run.userText.length <= 6000) p.user_message = run.userText;
  if (run.notes) p.image_notes = run.notes;
  if (run.hint) p.hint = run.hint;
  return JSON.stringify(p);
}

/* ---------- Dynamic High-Taste Agent Status Phrases ---------- */
export const DYNAMIC_AGENT_PHRASES = {
  search: {
    urdu: [
      'Web par taaza maloomat dhoond raha hoon',
      'Live web sources search kiye ja rahe hain',
      'Online data aur facts verify ho rahe hain',
      'Internet se relevant facts search ho rahe hain',
      'Web grounding data collect kiya ja raha hai'
    ],
    en: [
      'Searching live web sources',
      'Verifying real-time information',
      'Gathering web insights',
      'Checking current online data',
      'Collecting web grounding sources'
    ]
  },
  code: {
    urdu: [
      'Gemini ke zariye responsive HTML/CSS/JS website code craft ho raha hai',
      'Production-grade website ka interactive code tayyar ho raha hai',
      'Tailwind CSS aur Lucide icons ke sath modern website design ki ja rahi hai',
      'Clean solution code craft ho raha hai',
      'Interactive components aur styling develop ho rahi hain',
      'High-quality production code likha ja raha hai'
    ],
    en: [
      'Crafting responsive HTML/CSS/JS website with Gemini',
      'Building production-grade interactive website',
      'Designing modern UI with Tailwind CSS & Lucide icons',
      'Developing optimized interactive components',
      'Engineering high-quality code'
    ]
  },
  file_read: {
    urdu: [
      'File structure aur content inspect ho raha hai',
      'File deeply parse aur read ho rahi hai',
      'File content ka tajziya kiya ja raha hai',
      'File inspect karke details check ho rahi hain'
    ],
    en: [
      'Inspecting file content',
      'Reading and parsing file',
      'Analyzing file structure',
      'Reviewing file details'
    ]
  },
  file_search: {
    urdu: [
      'Codebase symbols aur files search ho rahe hain',
      'Files ke andar relevant code dhoond raha hoon',
      'Workspace codebase scan ho raha hai',
      'Relevant files & references search ho rahe hain'
    ],
    en: [
      'Searching codebase symbols',
      'Scanning workspace files',
      'Searching code repository',
      'Finding relevant references'
    ]
  },
  think: {
    urdu: [
      'Facts aur logic ka tajziya ho raha hai...',
      'Next logical step evaluate kiya ja raha hai...',
      'Key requirements cross-check ki ja rahi hain...',
      'Solution strategy formulate ho rahi hai...',
      'Context aur details deeply analyze ho rahe hain...'
    ],
    en: [
      'Evaluating logic & next moves...',
      'Synthesizing facts & requirements...',
      'Cross-checking solution logic...',
      'Analyzing context & dependencies...',
      'Formulating optimal strategy...'
    ]
  },
  finish: {
    urdu: [
      'Polished aur mukammal jawab organize ho raha hai',
      'Comprehensive solution compile kiya ja raha hai',
      'Final response tayyar karke deliver ho raha hai',
      'Solution finalize aur organize kiya ja raha hai'
    ],
    en: [
      'Compiling polished response',
      'Synthesizing comprehensive solution',
      'Finalizing & organizing output',
      'Delivering complete solution'
    ]
  }
};

function pickDynamicPhrase(pool, seed = 0) {
  if (!pool || pool.length === 0) return '';
  const idx = Math.abs(seed) % pool.length;
  return pool[idx];
}

/* ---------- Step Meta Transformation ---------- */
function stepMeta(s, isUrdu = false, seed = 0) {
  const d = String(s.purpose || '').slice(0, 160);
  const phraseSeed = seed || Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100);

  if (s.action === 'search') {
    const phrase = pickDynamicPhrase(isUrdu ? DYNAMIC_AGENT_PHRASES.search.urdu : DYNAMIC_AGENT_PHRASES.search.en, phraseSeed);
    return { type: 'search', name: phrase, content: '"' + String(s.query || '') + '"', status: 'running' };
  }
  if (s.action === 'file_read') {
    const phrase = pickDynamicPhrase(isUrdu ? DYNAMIC_AGENT_PHRASES.file_read.urdu : DYNAMIC_AGENT_PHRASES.file_read.en, phraseSeed);
    return { type: 'file_read', name: s.path ? `${phrase}: ${s.path}` : phrase, content: s.path || d, status: 'running' };
  }
  if (s.action === 'file_search') {
    const phrase = pickDynamicPhrase(isUrdu ? DYNAMIC_AGENT_PHRASES.file_search.urdu : DYNAMIC_AGENT_PHRASES.file_search.en, phraseSeed);
    return { type: 'file_search', name: s.query ? `${phrase}: "${s.query}"` : phrase, content: s.query || d, status: 'running' };
  }
  if (s.action === 'code') {
    const phrase = pickDynamicPhrase(isUrdu ? DYNAMIC_AGENT_PHRASES.code.urdu : DYNAMIC_AGENT_PHRASES.code.en, phraseSeed);
    return { type: 'code', name: s.title ? `${phrase}: ${s.title}` : phrase, content: String(s.spec || d).slice(0, 220), status: 'running' };
  }
  if (s.action === 'ask') {
    return { type: 'ask', name: isUrdu ? 'Aap se clarification darkar hai' : 'Asking clarification', content: d, status: 'running' };
  }
  if (s.action === 'finish') {
    const phrase = pickDynamicPhrase(isUrdu ? DYNAMIC_AGENT_PHRASES.finish.urdu : DYNAMIC_AGENT_PHRASES.finish.en, phraseSeed);
    return { type: 'write', name: phrase, content: d, status: 'completed' };
  }

  const thinkPhrase = pickDynamicPhrase(isUrdu ? DYNAMIC_AGENT_PHRASES.think.urdu : DYNAMIC_AGENT_PHRASES.think.en, phraseSeed);
  return { type: 'think', name: thinkPhrase, content: d, status: 'running' };
}

/* ---------- Artifact Stitching (1:1 from HTML) ---------- */
function stitch(text, nb) {
  const used = new Set();
  let out = String(text || '').replace(/\{\{\s*([a-z]\d+)\s*\}\}/gi, (m, id) => {
    const a = nb.artifacts.find(x => x.id.toLowerCase() === id.toLowerCase());
    if (!a) return '';
    used.add(a.id);
    return '\n\n' + a.content + '\n\n';
  });
  nb.artifacts.forEach(a => {
    if (a.deliver && !used.has(a.id)) {
      out += '\n\n' + a.content;
    }
  });
  const plain = out.replace(/```[\s\S]*?```/g, '');
  const cited = [...new Set([...plain.matchAll(/\[(\d{1,2})\]/g)].map(m => +m[1]))]
    .filter(n => nb.sources.some(s => s.n === n))
    .sort((a, b) => a - b);
  if (cited.length) {
    out += '\n\n**Sources**\n' + cited.map(n => {
      const s = nb.sources.find(x => x.n === n);
      return n + '. [' + (s.title || s.url) + '](' + s.url + ')';
    }).join('\n');
  }
  return out.trim();
}

/* ---------- Force Final Synthesis ---------- */
async function forceFinal(run, signal) {
  const { tavilyKey } = getSearchKeys();
  const nbJson = nbForModel(run, Boolean(tavilyKey));
  const text = await callGroqChatJson({
    model: AGENT_MODELS.main,
    messages: [
      {
        role: 'system',
        content: 'You are finishing a piece of work. Using the notebook, write the final answer for the user now, in their language and style. Never mention steps, notebooks or tools. Put {{id}} where an artifact should appear (it is inserted as-is). Keep [n] source markers next to facts from search.'
      },
      { role: 'user', content: nbJson }
    ],
    temperature: 0.4,
    responseFormatJson: false,
    signal
  });
  return stripThink(text);
}

/* ---------- Background Conversation Summarizer ---------- */
let conversationSummaryCache = new Map();

async function maybeSummarize(messagesHistory, convId, signal) {
  try {
    if (!convId || !Array.isArray(messagesHistory) || messagesHistory.length < 8) return;
    const currentSummary = conversationSummaryCache.get(convId) || '';
    const chunk = messagesHistory.slice(0, messagesHistory.length - 4).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.content || '').slice(0, 400)}`).join('\n');
    const s = await callGroqChatJson({
      messages: [
        { role: 'system', content: 'Update the running summary of a conversation. Keep names, decisions, facts, preferences and open threads. Max 150 words, plain text.' },
        { role: 'user', content: 'Current summary: ' + (currentSummary || '(none)') + '\n\nNew messages:\n' + chunk }
      ],
      model: AGENT_MODELS.helper,
      maxTokens: 300,
      temperature: 0.2,
      responseFormatJson: false,
      signal
    });
    if (s && s.trim()) {
      conversationSummaryCache.set(convId, stripThink(s.trim()));
    }
  } catch { }
}

/* ---------- Recent Chat Context ---------- */
function recentChatContext(messagesHistory = [], maxTurns = 6, maxLen = 800) {
  return (messagesHistory || []).slice(-maxTurns).map(m => {
    let c = String(m.content || '');
    if (c.length > maxLen) c = c.slice(0, maxLen) + '...';
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content: c };
  });
}

/**
 * MAIN ENTRY POINT: runDynamicAgent
 * Replaces old agent loop with the exact HTML logic and state machine.
 */
export async function runDynamicAgent({
  userPrompt,
  userImage = null,
  messagesHistory = [],
  forceWebSearch = false,
  forceCanvasCode = false,
  isFromImageStudio = false,
  workspace = null,
  workspaceMeta = null,
  activeCanvasCode = null,
  activeCanvasLanguage = null,
  convId = null,
  onStepUpdate = null,
  onChunk = null,
  signal = null
}) {
  const text = (userPrompt || '').trim();
  const { tavilyKey } = getSearchKeys();
  const stabKey = getStabilityApiKey();
  const langStyle = detectUserLanguageStyle(text);
  const isUrdu = langStyle === 'roman_urdu' || langStyle === 'urdu_native';

  // ── RESUME AFTER PENDING QUESTION (CLASSIFY REPLY) ──────────
  const waitingRun = convId ? (getWaitingRun(convId) || loadWaitingRunFromStorage(convId)) : null;

  if (waitingRun && waitingRun.status === 'waiting_user' && waitingRun.pending) {
    let kind = 'answer';
    if (text.length > 35) {
      kind = await classifyReply(waitingRun, text, signal);
    }

    if (kind === 'cancel') {
      clearWaitingRun(convId);
      const cancelText = isUrdu ? 'Aap ka task cancel kar diya gaya hai.' : 'Task has been cancelled.';
      if (onStepUpdate) onStepUpdate([{ type: 'response', content: cancelText }], true);
      if (onChunk) onChunk(cancelText, cancelText);
      return { hasCode: false };
    }

    if (kind === 'answer') {
      const answer = text + (waitingRun.notes ? '\n[image notes: ' + waitingRun.notes + ']' : '');
      if (waitingRun.kind === 'preintake') {
        clearWaitingRun(convId);
        return await startFlow({
          text: waitingRun.userText + '\n\n(Clarifying question: "' + waitingRun.pending.question + '" - the user answered: "' + answer + '")',
          notes: waitingRun.notes || '',
          noAsk: true,
          convId,
          messagesHistory,
          activeCanvasCode,
          activeCanvasLanguage,
          onStepUpdate,
          onChunk,
          signal
        });
      } else {
        waitingRun.nb.answers.push({ q: waitingRun.pending.question, a: answer });
        waitingRun.status = 'running';
        waitingRun.pending = null;
        waitingRun.hint = '';
        clearWaitingRun(convId);
        return await continueRun({
          run: waitingRun,
          convId,
          messagesHistory,
          activeCanvasCode,
          activeCanvasLanguage,
          onStepUpdate,
          onChunk,
          signal
        });
      }
    }

    // Treated as new request
    clearWaitingRun(convId);
  }

  let activeWorkspace = workspace || (convId ? getConversationWorkspace(convId) : null);
  const initialTraceSteps = [];

  // ── WORKSPACE EXTRACTION & INDEXING NODES (EXTRACT & READ) ───
  if (workspaceMeta && workspaceMeta.rawFiles && workspaceMeta.rawFiles.length > 0) {
    const isZip = Boolean(workspaceMeta.isZip);
    const isSingleFile = workspaceMeta.rawFiles.length === 1 && !isZip;
    const displayName = workspaceMeta.name || workspaceMeta.rawFiles[0]?.name || 'file';

    // Check if this exact workspace / file was ALREADY extracted and indexed for this conversation (avoid duplicate extraction!)
    const alreadyExtracted = Boolean(
      activeWorkspace &&
      activeWorkspace.files?.length > 0 &&
      (
        activeWorkspace.name === displayName ||
        (activeWorkspace.files.length === 1 && activeWorkspace.files[0].name === displayName) ||
        (workspaceMeta.rawFiles.length === activeWorkspace.files.length && workspaceMeta.rawFiles[0]?.name === activeWorkspace.files[0]?.name)
      )
    );

    if (!alreadyExtracted) {
      if (isSingleFile) {
        // Clean single-file read node (no extraction noise, no redundant tree index)
        const readStep = {
          id: 'node_read',
          name: isUrdu ? `File read ho rahi hai: ${displayName}` : `Reading file: ${displayName}`,
          type: 'read',
          status: 'running',
          content: isUrdu ? `File "${displayName}" check ki ja rahi hai...` : `Reading attached file ${displayName}...`
        };
        initialTraceSteps.push(readStep);
        if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);

        try {
          activeWorkspace = await ingestWorkspaceFiles(workspaceMeta.rawFiles, (progressMsg) => {
            readStep.content = typeof progressMsg === 'string' ? progressMsg : (progressMsg?.message || '');
            if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);
          });

          activeWorkspace.name = displayName;
          if (convId) setConversationWorkspace(convId, activeWorkspace);

          const parsedFile = activeWorkspace.files?.[0];
          readStep.status = 'completed';
          readStep.name = isUrdu ? `File read mukammal: ${displayName}` : `File read: ${displayName}`;
          const sizeKb = Math.round((parsedFile?.size || workspaceMeta.rawFiles[0].size || 0) / 1024);
          readStep.content = `✓ Loaded ${displayName} (${sizeKb} KB${parsedFile?.lineCount ? `, ${parsedFile.lineCount} lines` : ''})`;
          readStep.filesCount = activeWorkspace.files?.length || 1;
          readStep.stats = activeWorkspace.stats;
          if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);
        } catch (err) {
          readStep.status = 'error';
          readStep.content = `Reading failed: ${err.message}`;
          if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);
        }
      } else {
        // Multi-file or ZIP Archive extraction
        const extractStep = {
          id: 'node_extract',
          name: isZip
            ? (isUrdu ? `Archive extract ho raha hai: ${displayName}` : `Extracting archive: ${displayName}`)
            : (isUrdu ? 'Files extract ho rahi hain' : 'Extracting attached files'),
          type: 'extract',
          status: 'running',
          content: isUrdu ? 'Files khol kar check ki ja rahi hain...' : 'Unpacking and validating file structure...'
        };
        initialTraceSteps.push(extractStep);
        if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);

        try {
          activeWorkspace = await ingestWorkspaceFiles(workspaceMeta.rawFiles, (progressMsg) => {
            extractStep.content = typeof progressMsg === 'string' ? progressMsg : (progressMsg?.message || '');
            if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);
          });

          activeWorkspace.name = displayName;
          if (convId) setConversationWorkspace(convId, activeWorkspace);

          extractStep.status = 'completed';
          extractStep.name = isZip
            ? (isUrdu ? `Archive extract mukammal: ${displayName}` : `Extracted: ${displayName}`)
            : (isUrdu ? 'Files extract mukammal' : 'Files extracted');
          extractStep.filesCount = activeWorkspace.files?.length || 0;
          extractStep.content = `✓ Parsed ${activeWorkspace.files?.length || 0} files (${Math.round((activeWorkspace.stats?.totalBytes || 0) / 1024)} KB uncompressed)` +
            (activeWorkspace.skipped?.length > 0 ? `\n• Skipped ${activeWorkspace.skipped.length} build / ignored files` : '');
          extractStep.stats = activeWorkspace.stats;
          extractStep.skipped = activeWorkspace.skipped;
          if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);

          // Add Read Step (File tree & indexing) only if multiple files
          if (activeWorkspace.files?.length > 1) {
            const readStep = {
              id: 'node_read',
              name: isUrdu ? 'Codebase tree index ho gaya' : 'Codebase tree indexed',
              type: 'read',
              status: 'completed',
              content: activeWorkspace.treeText || 'File structure indexed.',
              filesCount: activeWorkspace.files?.length || 0
            };
            initialTraceSteps.push(readStep);
            if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);
          }
        } catch (err) {
          extractStep.status = 'error';
          extractStep.content = `Extraction failed: ${err.message}`;
          if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);
        }
      }
    }
  }

  // ── SINGLE-PASS IMAGE EXTRACTION (VISION MODEL) ─────────────
  let notes = '';
  if (userImage) {
    const visionStep = {
      id: 'node_vision',
      name: isUrdu ? 'Tasveer ka tajziya' : 'Analyze image',
      type: 'vision',
      status: 'running',
      content: ''
    };
    initialTraceSteps.push(visionStep);
    if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);

    notes = await readImage(text, userImage, signal);

    visionStep.status = 'completed';
    visionStep.content = notes;
    if (onStepUpdate) onStepUpdate([...initialTraceSteps, { type: 'response', content: '' }]);
  }

  // Start fresh flow
  const result = await startFlow({
    text: text || '(see the attached file or image)',
    notes,
    noAsk: false,
    workspace: activeWorkspace,
    initialSteps: initialTraceSteps,
    convId,
    messagesHistory,
    activeCanvasCode,
    activeCanvasLanguage,
    onStepUpdate,
    onChunk,
    signal
  });

  // Background summary update
  maybeSummarize(messagesHistory, convId, signal);

  return {
    ...result,
    activeWorkspace
  };
}

/**
 * START FLOW (Intake with first-line streaming mode parse)
 */
async function startFlow({
  text,
  notes = '',
  noAsk = false,
  workspace = null,
  initialSteps = [],
  convId = null,
  messagesHistory = [],
  activeCanvasCode = null,
  activeCanvasLanguage = null,
  onStepUpdate = null,
  onChunk = null,
  signal = null
}) {
  const { tavilyKey } = getSearchKeys();
  const stabKey = getStabilityApiKey();
  const langStyle = detectUserLanguageStyle(text);
  const isUrdu = langStyle === 'roman_urdu' || langStyle === 'urdu_native';
  const summary = (convId && conversationSummaryCache.get(convId)) || '';

  // Retrieve relevant cross-conversation memories & rules (RAG)
  const relevantMemories = retrieveRelevantMemories(text, { limit: 4 });
  const retrievedMemories = relevantMemories || [];
  const memoryPromptSection = formatMemoriesForPrompt(relevantMemories);

  // Retrieve RAG chunks from attached workspace files / codebase
  let retrievedRagSources = [];
  let ragPromptSection = '';
  if (workspace && Array.isArray(workspace.files) && workspace.files.length > 0) {
    try {
      ragManager.indexWorkspace(workspace, convId || 'default');
      retrievedRagSources = ragManager.retrieve(text, convId || 'default', { topK: 5 });
      if (retrievedRagSources.length > 0) {
        ragPromptSection = formatRagChunksForPrompt(retrievedRagSources);
      }
    } catch (e) {
      console.warn('[RAG Engine] Workspace retrieval error:', e);
    }
  }

  const isWebsite = isWebsiteOrWebUiRequest(text);

  // Construct Intake Messages
  const msgs = [{ role: 'system', content: INTAKE_SYS }];
  if (memoryPromptSection) msgs.push({ role: 'system', content: memoryPromptSection });
  if (ragPromptSection) msgs.push({ role: 'system', content: ragPromptSection });
  if (summary) msgs.push({ role: 'system', content: 'Earlier conversation summary: ' + summary });
  msgs.push(...recentChatContext(messagesHistory, 6, 800));

  const flags = [
    `[Now: ${nowStr()}]`,
    `[web search available: ${tavilyKey ? 'yes' : 'no'}]`,
    `[image generation available: ${stabKey ? 'yes' : 'no'}]`,
    workspace ? `[attached files available: ${workspace.files?.length || 0}]` : null,
    noAsk ? '[Do not use MODE: ASK; assume sensibly]' : null,
    isWebsite ? '[WEBSITE/UI INTENT DETECTED: Must use MODE: TASK with action "code". Do NOT use MODE: ASK. User wants the complete interactive HTML/CSS/JS website generated immediately.]' : null
  ].filter(Boolean).join(' ');

  let fileContext = '';
  if (workspace && Array.isArray(workspace.files) && workspace.files.length > 0) {
    if (workspace.files.length === 1) {
      const f = workspace.files[0];
      const maxChars = 40000;
      const content = f.content.length > maxChars
        ? f.content.slice(0, maxChars) + `\n\n... [Remaining content truncated for performance. Total characters: ${f.content.length}]`
        : f.content;
      fileContext = `\n\n[Attached File: ${f.name} (${f.kind}, ${Math.round(f.size / 1024)} KB, ${f.lineCount || 0} lines)]:\n${content}`;
    } else if (workspace.files.length <= 15) {
      // Include full contents for up to 15 files so the AI knows everything inside the uploaded project
      let totalChars = 0;
      const MAX_TOTAL_CHARS = 48000;
      fileContext = '\n\n[Attached Files Content]:\n' + workspace.files.map(f => {
        if (totalChars > MAX_TOTAL_CHARS) {
          return `--- File: ${f.path} (${f.kind}, ${f.lineCount || 0} lines) ---\n${f.snippet || '[Content summary: ' + f.content.slice(0, 300) + ']'}`;
        }
        const fileMax = 16000;
        const body = f.content.length > fileMax ? f.content.slice(0, fileMax) + '\n... [truncated]' : f.content;
        totalChars += body.length;
        return `--- File: ${f.path} (${f.kind}, ${f.lineCount || 0} lines) ---\n${body}`;
      }).join('\n\n');
    } else {
      fileContext = '\n\n[Attached Workspace File Tree]:\n' + workspace.treeText + '\n\n[Sample File Details]:\n' + workspace.files.slice(0, 15).map(f => `• ${f.path} (${f.kind}, ${f.lineCount || 0} lines): ${f.snippet || f.content.slice(0, 250)}`).join('\n');
    }
  }

  msgs.push({
    role: 'user',
    content: `${flags}\n${text}${fileContext}${notes ? '\n\n[Notes extracted from the image the user attached]\n' + notes : ''}`
  });

  // Track initial execution steps (zero filler understand/plan nodes)
  const traceSteps = [...initialSteps, { type: 'response', content: '' }];
  if (onStepUpdate) onStepUpdate([...traceSteps]);

  let mode = null;
  let bodyStart = 0;
  let full = '';

  const processIntakeChunk = (delta, all) => {
    full = all;
    const trimmed = all.trimStart();

    // 1. If stream begins with raw JSON (e.g. { or {"asks" or {"questions" or {"op"),
    // it's immediately identified as a structured mode (TASK, ASK, or IMAGE) and MUST NEVER stream to chat as GENERAL prose!
    if (trimmed.startsWith('{') || trimmed.includes('"asks"') || trimmed.includes('"questions"') || trimmed.includes('"op"')) {
      if (trimmed.includes('"questions"') || trimmed.includes('"question"')) {
        mode = 'ASK';
      } else if (trimmed.includes('"op"') || trimmed.includes('"prompt"')) {
        mode = 'IMAGE';
      } else {
        mode = 'TASK';
      }
      bodyStart = 0;
      return;
    }

    if (!mode) {
      const nl = all.indexOf('\n');
      if (nl === -1) {
        const m = trimmed.match(/^\W*MODE:\s*(GENERAL|TASK|ASK|IMAGE)/i);
        if (m) mode = m[1].toUpperCase();
        return;
      }
      const firstLine = all.slice(0, nl).trim();
      const m = firstLine.match(/^\W*MODE:\s*(GENERAL|TASK|ASK|IMAGE)/i);
      if (m) {
        mode = m[1].toUpperCase();
        bodyStart = nl + 1;
      } else if (firstLine.startsWith('{') || firstLine.includes('"asks"') || firstLine.includes('"questions"') || firstLine.includes('"op"')) {
        mode = firstLine.includes('"questions"') ? 'ASK' : (firstLine.includes('"op"') ? 'IMAGE' : 'TASK');
        bodyStart = 0;
        return;
      } else {
        mode = 'GENERAL';
        bodyStart = 0;
      }
    }

    if (mode === 'GENERAL') {
      if (/^\s*\{/.test(all) || all.includes('"asks"') || all.includes('"questions"') || all.includes('"op"')) return;
      const cleanStreaming = all.slice(bodyStart).replace(/^\s+/, '');
      // In GENERAL mode, keep initial extraction steps if present, otherwise direct stream
      if (initialSteps.length > 0) {
        if (onStepUpdate) onStepUpdate([...initialSteps, { type: 'response', content: cleanStreaming }]);
      } else {
        if (onStepUpdate) onStepUpdate([{ type: 'response', content: cleanStreaming }], true);
      }
      if (onChunk) onChunk(delta, cleanStreaming);
    }
  };

  try {
    full = await streamGroqChat({
      messages: msgs,
      model: AGENT_MODELS.main,
      temperature: 0.5,
      signal,
      onChunk: processIntakeChunk
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('[Intake] Brain stream failed, trying fallback:', err.message);
    full = await streamGroqChat({
      messages: msgs,
      model: AGENT_MODELS.mainFallback,
      temperature: 0.5,
      signal,
      onChunk: processIntakeChunk
    });
  }

  // Parse mode if not caught during stream
  if (!mode) {
    const m = full.match(/^\W*MODE:\s*(GENERAL|TASK|ASK|IMAGE)\s*([\s\S]*)$/i);
    if (m) {
      mode = m[1].toUpperCase();
      bodyStart = full.length - m[2].length;
    }
  }

  let body = full.slice(bodyStart).trim();

  // Bulletproof JSON fallback: if mode is still GENERAL (or unset) but the body is actually JSON
  if (mode === 'GENERAL' || !mode || /^\s*\{/.test(body) || body.includes('"asks"') || body.includes('"questions"') || body.includes('"op"')) {
    if (/^\s*\{/.test(body) || body.includes('"asks"') || body.includes('"questions"') || body.includes('"op"')) {
      const jj = parseJSON(body);
      if (jj) {
        if (Array.isArray(jj.asks) && jj.asks.length > 0) {
          mode = 'TASK';
        } else if (jj.questions || jj.question) {
          mode = 'ASK';
        } else if (jj.op) {
          mode = 'IMAGE';
        }
      }
    }
  }

  // Automatic Website Intent Guard: When user explicitly wants a website/UI created,
  // NEVER stall on MODE: ASK or print partial chat prose in MODE: GENERAL. Route straight to MODE: TASK!
  if (isWebsite && (mode === 'ASK' || mode === 'GENERAL' || !mode)) {
    mode = 'TASK';
    body = JSON.stringify({
      asks: [{ id: 'a1', text: `Build a complete, production-grade interactive HTML, CSS (Tailwind CDN), and JavaScript website for: ${text}`, type: 'task' }],
      weight: 'heavy',
      language: langStyle || (isUrdu ? 'roman_urdu' : 'en')
    });
  }

  if (!mode) mode = 'GENERAL';

  // Mode 1: GENERAL (1 Call Total!)
  if (mode === 'GENERAL') {
    // Extra safety: double check if body is accidentally a raw JSON plan
    const jj = parseJSON(body);
    if (jj && (Array.isArray(jj.asks) || jj.questions || jj.op)) {
      if (Array.isArray(jj.asks) && jj.asks.length > 0) mode = 'TASK';
      else if (jj.questions || jj.question) mode = 'ASK';
      else if (jj.op) mode = 'IMAGE';
    } else {
      const finalAnswer = body.replace(/^\W*MODE:\s*GENERAL\s*/i, '').trim();
      const finalSteps = initialSteps.length > 0 ? [...initialSteps, { type: 'response', content: finalAnswer }] : [{ type: 'response', content: finalAnswer }];
      if (onStepUpdate) onStepUpdate(finalSteps, initialSteps.length === 0);
      if (onChunk) onChunk(finalAnswer, finalAnswer);

      // Auto-learn user corrections & rules in the background
      try {
        const { key: gKey } = getAvailableGroqKey();
        analyzeAndLearnFromTurn({
          userPrompt: text,
          assistantResponse: finalAnswer,
          conversationId: convId || null,
          groqApiKey: gKey
        });
      } catch {}

      return {
        hasCode: false,
        retrievedMemories,
        ragSources: retrievedRagSources
      };
    }
  }

  // Mode 2: IMAGE (Generation / Variation / Replace / Upscale)
  if (mode === 'IMAGE') {
    const imgJson = parseJSON(body);
    const imgStep = {
      id: 'node_image',
      name: isUrdu ? 'Image ban rahi hai' : 'Generating image',
      type: 'image',
      status: 'running',
      content: imgJson?.prompt || text
    };
    traceSteps.splice(traceSteps.length - 1, 0, imgStep);
    if (onStepUpdate) onStepUpdate([...traceSteps]);

    let imgResult = null;
    try {
      imgResult = await generateStableDiffusionImage({
        prompt: imgJson?.prompt || text,
        originalPrompt: text,
        signal
      });
      imgStep.imageResult = imgResult;
      imgStep.status = 'completed';
      imgStep.content = `Generated Image: ${imgResult.prompt || imgJson?.prompt || text}`;
    } catch (e) {
      imgStep.status = 'error';
      imgStep.content = 'Image generation failed: ' + e.message;
    }

    const replyText = imgJson?.reply || (isUrdu ? 'Aap ki image tayyar hai!' : 'Here is your generated image!');
    const respStep = traceSteps.find(s => s.type === 'response');
    if (respStep) respStep.content = replyText;
    if (onStepUpdate) onStepUpdate([...traceSteps]);
    if (onChunk) onChunk(replyText, replyText);

    return { hasCode: false, hasImage: true, retrievedMemories, ragSources: retrievedRagSources };
  }

  // Mode 3: ASK (Interactive Clarification Cards)
  if (mode === 'ASK') {
    const j = parseJSON(body);
    const p = j && normQ(j);
    if (p && !noAsk) {
      const askNode = {
        id: 'node_ask',
        name: isUrdu ? 'Aap se poochh raha hoon' : 'Asking clarification',
        type: 'ask',
        status: 'running',
        content: p.questions.map(x => x.question).join('  /  ')
      };
      traceSteps.splice(traceSteps.length - 1, 0, askNode);
      if (onStepUpdate) onStepUpdate([...traceSteps]);

      const run = {
        id: uid(),
        kind: 'preintake',
        status: 'waiting_user',
        userText: text,
        notes,
        pending: p
      };
      if (convId) saveWaitingRun(convId, run);

      return {
        needsClarification: true,
        clarification: p,
        hasCode: false,
        retrievedMemories,
        ragSources: retrievedRagSources
      };
    }

    // If asked but noAsk is true, retry once with assumptions
    return await startFlow({
      text,
      notes,
      noAsk: true,
      convId,
      messagesHistory,
      activeCanvasCode,
      activeCanvasLanguage,
      onStepUpdate,
      onChunk,
      signal
    });
  }

  // Mode 4: TASK (Multi-step Task Loop)
  const j = parseJSON(body);
  if (!j || !Array.isArray(j.asks) || !j.asks.length) {
    // If plan could not be parsed, answer directly
    const fallbackAns = await forceFinal({ nb: { asks: [{ id: 'a1', text, status: 'open' }], facts: [], artifacts: [], sources: [] }, userText: text, notes }, signal);
    if (onStepUpdate) onStepUpdate([{ type: 'response', content: fallbackAns }], true);
    if (onChunk) onChunk(fallbackAns, fallbackAns);
    return { hasCode: false, retrievedMemories, ragSources: retrievedRagSources };
  }

  const run = {
    id: uid(),
    kind: 'task',
    status: 'running',
    weight: j.weight === 'heavy' ? 'heavy' : 'light',
    language: j.language || langStyle || (isUrdu ? 'roman_urdu' : 'en'),
    userText: text,
    notes,
    workspace,
    workspaceReader: (workspace && Array.isArray(workspace.files)) ? createWorkspaceReader(workspace.files) : null,
    statusText: '',
    lastSig: '',
    repeat: 0,
    hint: '',
    relevantMemories,
    ragSources: retrievedRagSources,
    convId,
    language: j.language || langStyle || (isUrdu ? 'roman_urdu' : 'en'),
    userText: text,
    notes,
    workspace,
    workspaceReader: (workspace && Array.isArray(workspace.files)) ? createWorkspaceReader(workspace.files) : null,
    statusText: '',
    lastSig: '',
    repeat: 0,
    hint: '',
    nb: {
      asks: j.asks.map((a, i) => ({
        id: a.id || 'a' + (i + 1),
        text: String(a.text || ''),
        type: a.type === 'general' ? 'general' : 'task',
        status: 'open'
      })),
      facts: [],
      artifacts: [],
      sources: [],
      assumptions: [],
      answers: [],
      updates: [],
      log: [],
      counters: { c: 0, r: 0, s: 0 }
    }
  };

  return await continueRun({
    run,
    traceSteps,
    convId,
    messagesHistory,
    activeCanvasCode,
    activeCanvasLanguage,
    onStepUpdate,
    onChunk,
    signal
  });
}

/**
 * CONTINUE RUN (Task loop engine with 7 principles, stuck detection & artifact delivery)
 */
async function continueRun({
  run,
  traceSteps = [],
  convId = null,
  messagesHistory = [],
  activeCanvasCode = null,
  activeCanvasLanguage = null,
  onStepUpdate = null,
  onChunk = null,
  signal = null
}) {
  const nb = run.nb;
  const { tavilyKey } = getSearchKeys();
  const langStyle = run.language || detectUserLanguageStyle(run.userText);
  const isUrdu = langStyle === 'roman_urdu' || langStyle === 'urdu_native';
  let lastUpdateAt = 0;
  let finalArtifact = null;
  let consecutiveThinks = 0;

  if (traceSteps.length === 0) {
    traceSteps.push({ type: 'response', content: '' });
  }

  for (let turn = 1; turn <= 6; turn++) {
    if (signal && signal.aborted) throw new Error('Aborted');

    // 1. Maybe compact facts if > 3500 chars
    await maybeCompactFacts(nb, signal);

    // 2. Add running step node on tree
    const currentStepId = `step_${turn}_${Date.now()}`;
    const dynamicThink = pickDynamicPhrase(
      isUrdu ? DYNAMIC_AGENT_PHRASES.think.urdu : DYNAMIC_AGENT_PHRASES.think.en,
      turn * 5 + Math.floor(Date.now() / 1000)
    );
    const pn = {
      id: currentStepId,
      name: dynamicThink,
      type: 'think',
      status: 'running',
      content: ''
    };

    const respIdx = traceSteps.findIndex(s => s.type === 'response');
    if (respIdx !== -1) traceSteps.splice(respIdx, 0, pn);
    else traceSteps.push(pn);
    if (onStepUpdate) onStepUpdate([...traceSteps]);

    // 3. Call Brain Model for Next Move
    const step = await getStep(run, tavilyKey, signal);
    if (!step) {
      const pIdx = traceSteps.findIndex(s => s.id === pn.id);
      if (pIdx !== -1) traceSteps.splice(pIdx, 1);
      const forced = await forceFinal(run, signal);
      return deliver({ run, text: forced, traceSteps, finalArtifact, onStepUpdate, onChunk });
    }

    // 4. Stuck Prevention & Loop Control
    if (step.action === 'think') {
      consecutiveThinks++;
      // If facts are already present from search or files, or if thought once without artifact:
      if ((consecutiveThinks >= 1 && nb.facts.length > 0 && !step.artifact) || (consecutiveThinks >= 2 && !step.artifact)) {
        const pIdx = traceSteps.findIndex(s => s.id === pn.id);
        if (pIdx !== -1) traceSteps.splice(pIdx, 1);
        const forced = await forceFinal(run, signal);
        return deliver({ run, text: forced, traceSteps, finalArtifact, onStepUpdate, onChunk });
      }
    } else {
      consecutiveThinks = 0;
    }

    // Semantic signature: extracts core keywords ignoring filler words
    const normAction = step.action || '';
    const rawTokens = (step.query || step.spec || step.purpose || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'obtain', 'exact', 'fill', 'needed', 'user'].includes(w));
    const tokenBag = Array.from(new Set(rawTokens)).sort().slice(0, 4).join('_');
    const sig = `${normAction}|${tokenBag}`;
    run.repeat = (run.lastSig === sig && sig.length > 3) ? run.repeat + 1 : 0;
    run.lastSig = sig;
    if (run.repeat >= 1 && step.action !== 'finish' && step.action !== 'ask') {
      const pIdx = traceSteps.findIndex(s => s.id === pn.id);
      if (pIdx !== -1) traceSteps.splice(pIdx, 1);
      const forced = await forceFinal(run, signal);
      return deliver({ run, text: forced, traceSteps, finalArtifact, onStepUpdate, onChunk });
    }
    run.hint = '';

    // 5. Bookkeeping
    (step.done_asks || []).forEach(id => {
      const a = nb.asks.find(x => x.id === id);
      if (a) a.status = 'done';
    });
    if (step.assumption) {
      nb.assumptions.push(String(step.assumption));
    }
    nb.log.push(step.action + ': ' + (step.purpose || ''));

    // Update current step node with clean friendly title
    const meta = stepMeta(step, isUrdu, turn * 7 + Math.floor(Date.now() / 1000));
    pn.type = meta.type;
    pn.name = meta.name;
    pn.content = meta.content;
    if (onStepUpdate) onStepUpdate([...traceSteps]);

    // 6. Optional Natural Update for heavy tasks (Rule 4)
    const tu = String(step.tell_user || '').trim();
    if (tu && run.weight === 'heavy' && Date.now() - lastUpdateAt > 3000 && !nb.updates.includes(tu)) {
      run.statusText = tu;
      nb.updates.push(tu);
      lastUpdateAt = Date.now();
      pn.content = `${tu}\n\n${pn.content}`.trim();
      if (onStepUpdate) onStepUpdate([...traceSteps]);
    }

    // ── ACTION: FINISH ──────────────────────────────────────────
    if (step.action === 'finish') {
      const pIdx = traceSteps.findIndex(s => s.id === pn.id);
      if (pIdx !== -1) traceSteps.splice(pIdx, 1);
      const ansText = step.final ? step.final : await forceFinal(run, signal);
      return deliver({
        run,
        text: ansText,
        followups: Array.isArray(step.followups) ? step.followups.slice(0, 3).map(String) : [],
        traceSteps,
        finalArtifact,
        onStepUpdate,
        onChunk
      });
    }

    // ── ACTION: ASK ─────────────────────────────────────────────
    if (step.action === 'ask') {
      const p = normQ(step);
      if (!p) {
        pn.type = 'update';
        pn.status = 'completed';
        pn.name = isUrdu ? 'Aage barh raha hoon' : 'Continuing';
        run.hint = 'The question was empty. Continue or finish.';
        continue;
      }

      run.status = 'waiting_user';
      run.pending = p;
      if (convId) saveWaitingRun(convId, run);

      pn.status = 'completed';
      pn.name = isUrdu ? 'Aap se poochh raha hoon' : 'Question for user';
      pn.content = p.questions.map(x => x.question).join('  /  ');
      if (onStepUpdate) onStepUpdate([...traceSteps]);

      return {
        needsClarification: true,
        clarification: p,
        hasCode: Boolean(finalArtifact)
      };
    }

    // ── ACTION: THINK ───────────────────────────────────────────
    if (step.action === 'think') {
      if (step.result) {
        nb.facts.push({ ask: step.serves || '', text: String(step.result).slice(0, 1500) });
      }
      const a = step.artifact;
      if (a && a.content) {
        const id = 'r' + (++nb.counters.r);
        nb.artifacts.push({
          id,
          title: a.title || 'Draft',
          kind: 'text',
          note: (a.title || 'draft') + ' (' + String(a.content).length + ' chars)',
          content: String(a.content),
          deliver: a.deliver !== false
        });
        pn.type = 'artifact';
        pn.name = a.title || (isUrdu ? 'Document tayyar' : 'Document ready');
        pn.title = a.title || 'Document Draft';
        pn.content = String(a.content);
        pn.status = 'completed';
      } else {
        // Pure internal think without an artifact; remove pn from traceSteps so zero filler node is shown
        const pIdx = traceSteps.findIndex(s => s.id === pn.id);
        if (pIdx !== -1) traceSteps.splice(pIdx, 1);
      }
      if (onStepUpdate) onStepUpdate([...traceSteps]);
    }

    // ── ACTION: SEARCH ──────────────────────────────────────────
    else if (step.action === 'search') {
      const q = String(step.query || '').trim();
      if (!tavilyKey || !q) {
        nb.facts.push({
          ask: step.serves || '',
          text: 'Web search is not available; rely on general knowledge and say what could not be verified.'
        });
        pn.status = 'error';
        pn.content = isUrdu ? 'Search key set nahi hai, apne ilm se jawab de raha hoon' : 'Search key not set, relying on internal knowledge';
      } else {
        try {
          const data = await tavilySearch(q, signal);
          const mappedResults = (data.results || []).slice(0, 5).map(r => {
            const n = ++nb.counters.s;
            let domain = '';
            try { domain = new URL(r.url).hostname.replace(/^www\./, ''); } catch { }
            nb.sources.push({ n, title: r.title || domain, url: r.url });
            return {
              n,
              title: r.title || domain,
              url: r.url,
              domain: domain,
              snippet: (r.content || '').slice(0, 220),
              favicon: domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32` : null
            };
          });
          const compact = await compactSearch(q, data.answer, mappedResults, signal);
          nb.facts.push({ ask: step.serves || '', text: 'Search "' + q + '": ' + compact });
          if (step.serves) {
            const matchedAsk = nb.asks.find(x => x.id === step.serves);
            if (matchedAsk) matchedAsk.status = 'done';
          }
          pn.status = 'completed';
          pn.type = 'search';
          pn.results = mappedResults;
          pn.content = compact ? `${compact}\n\n*Verified ${mappedResults.length} sources.*` : `"${q}" — ${mappedResults.length} sources found`;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          nb.facts.push({ ask: step.serves || '', text: 'Web search failed (' + e.message + '). Say what could not be verified.' });
          pn.status = 'error';
          pn.content = 'Search error: ' + e.message;
        }
      }
      if (onStepUpdate) onStepUpdate([...traceSteps]);
    }

    // ── ACTION: FILE READ (ReAct Acting) ────────────────────────
    else if (step.action === 'file_read') {
      const targetPath = String(step.path || '').trim();
      const offset = Number(step.offset) || 0;
      const reader = run.workspaceReader || (run.workspace?.files ? createWorkspaceReader(run.workspace.files) : null);

      if (!reader) {
        nb.facts.push({
          ask: step.serves || '',
          text: `[Observation: Workspace files not available to read "${targetPath}"]`
        });
        pn.status = 'error';
        pn.content = isUrdu ? 'Workspace files dastiyab nahi hain' : 'Workspace files not available';
      } else {
        const readResult = reader.readFile(targetPath, offset, 2500);
        if (readResult.error) {
          nb.facts.push({
            ask: step.serves || '',
            text: `[Observation error]: ${readResult.error}`
          });
          pn.status = 'error';
          pn.content = readResult.error;
        } else {
          nb.facts.push({
            ask: step.serves || '',
            text: `[Observation: File "${readResult.path}" (chars ${offset}-${offset + readResult.length} of ${readResult.totalChars})]:\n${readResult.content}`
          });
          pn.status = 'completed';
          pn.type = 'file_read';
          pn.path = readResult.path;
          pn.content = readResult.content;
          pn.totalChars = readResult.totalChars;
          pn.hasMore = readResult.hasMore;
          pn.name = isUrdu ? `File parh li: ${readResult.path}` : `Read file: ${readResult.path}`;
          if (step.serves) {
            const matchedAsk = nb.asks.find(x => x.id === step.serves);
            if (matchedAsk) matchedAsk.status = 'done';
          }
        }
      }
      if (onStepUpdate) onStepUpdate([...traceSteps]);
    }

    // ── ACTION: FILE SEARCH (ReAct Acting) ──────────────────────
    else if (step.action === 'file_search') {
      const q = String(step.query || '').trim();
      const reader = run.workspaceReader || (run.workspace?.files ? createWorkspaceReader(run.workspace.files) : null);

      if (!reader || !q) {
        nb.facts.push({
          ask: step.serves || '',
          text: `[Observation: Could not search files for "${q}"]`
        });
        pn.status = 'error';
        pn.content = isUrdu ? 'Files mein search nahi ho saka' : 'File search unavailable';
      } else {
        // Hybrid RAG Search over indexed workspace files
        const ragMatches = ragManager.retrieve(q, run.convId || 'default', { topK: 5 });
        let matchText = '';
        const matches = [];

        if (ragMatches.length > 0) {
          matchText = ragMatches.map(m => `[Source: ${m.filePath} (Lines ${m.lineStart}-${m.lineEnd}, ${m.relevancePercent || 90}% match)]:\n${m.content.slice(0, 350)}`).join('\n\n');
          ragMatches.forEach(m => {
            matches.push({ path: m.filePath, lineNumber: m.lineStart, match: m.heading || m.content.slice(0, 100) });
          });
        } else {
          const rawMatches = reader.searchText(q, 8);
          matchText = rawMatches.length > 0
            ? rawMatches.map(m => `• ${m.path}:${m.lineNumber} -> ${m.match}`).join('\n')
            : `No matches found for "${q}"`;
          matches.push(...rawMatches);
        }

        nb.facts.push({
          ask: step.serves || '',
          text: `[Observation: Codebase search for "${q}"]:\n${matchText}`
        });
        pn.status = 'completed';
        pn.type = 'file_search';
        pn.query = q;
        pn.matches = matches;
        pn.content = matchText;
        pn.name = isUrdu ? `RAG Search: "${q}" (${matches.length})` : `RAG: "${q}" (${matches.length} matches)`;
      }
      if (onStepUpdate) onStepUpdate([...traceSteps]);
    }

    // ── ACTION: CODE ────────────────────────────────────────────
    else if (step.action === 'code') {
      const spec = String(step.spec || '').trim();
      if (!spec) {
        run.hint = 'The code spec was empty.';
        const pIdx = traceSteps.findIndex(s => s.id === pn.id);
        if (pIdx !== -1) traceSteps.splice(pIdx, 1);
        continue;
      }

      const isWeb = isWebsiteOrWebUiRequest(spec) || isWebsiteOrWebUiRequest(run.userText);
      const memoryContext = (run.relevantMemories && run.relevantMemories.length > 0)
        ? formatMemoriesForPrompt(run.relevantMemories)
        : '';
      const out = await writeCode(spec, signal, memoryContext, isWeb);
      const id = 'c' + (++nb.counters.c);
      const detectedL = isWeb ? 'html' : (detectProgrammingLanguageDynamically(spec, out.content) || 'html');

      const art = {
        id,
        title: step.title || (isWeb ? 'Interactive Website (HTML/CSS/JS)' : 'Code Artifact'),
        kind: 'code',
        language: detectedL,
        note: out.note,
        content: cleanCode(out.content),
        deliver: true
      };

      nb.artifacts.push(art);
      finalArtifact = art;

      pn.status = 'completed';
      pn.type = 'code';
      pn.code = art.content;
      pn.language = art.language;
      pn.title = art.title;
      pn.content = out.note + ' (' + art.content.split('\n').length + ' lines)';

      // Update Code Canvas in localStorage for interactive inspection
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('devnexes_canvas_code', art.content);
          localStorage.setItem('devnexes_canvas_language', art.language);
        }
      } catch { }

      if (onStepUpdate) onStepUpdate([...traceSteps]);
    }
  }

  // Final fallback delivery if turns exhausted
  const forced = await forceFinal(run, signal);
  return deliver({ run, text: forced, traceSteps, finalArtifact, onStepUpdate, onChunk });
}

/**
 * Get Step JSON with Error Recovery
 */
async function getStep(run, tavilyAvailable, signal) {
  const nbJson = nbForModel(run, tavilyAvailable);
  const msgs = [
    { role: 'system', content: STEP_SYS },
    { role: 'user', content: nbJson }
  ];

  let raw = '';
  try {
    raw = await callBrainJson({
      messages: msgs,
      maxTokens: 7000,
      temperature: 0.3,
      effort: EFFORT.step,
      signal
    });
  } catch (err) {
    console.warn('[GetStep] Failed to call brain JSON:', err.message);
    return null;
  }

  let j = parseJSON(raw);
  if (!j) {
    msgs.push({ role: 'assistant', content: raw || '(empty)' });
    msgs.push({ role: 'user', content: 'That was not valid JSON. Reply again with ONLY the JSON object.' });
    try {
      raw = await callBrainJson({ messages: msgs, maxTokens: 7000, temperature: 0.3, signal });
      j = parseJSON(raw);
    } catch { }
  }

  if (!j) return null;
  const ok = ['think', 'search', 'file_read', 'file_search', 'code', 'ask', 'finish'];
  if (!ok.includes(j.action)) {
    if (j.final) j.action = 'finish';
    else return null;
  }
  return j;
}

/**
 * DELIVER: Stitches Artifacts {{id}}, appends sources, cleans trace steps, and renders final answer
 */
function deliver({ run, text, followups = [], traceSteps = [], finalArtifact = null, onStepUpdate, onChunk }) {
  const stitched = stitch(text, run.nb);

  // Clean trace steps: only keep real tool nodes (code, search, file operations, cmd, image, ask, artifact)
  const cleanTraceSteps = traceSteps.filter(s => {
    if (s.type === 'response') return true;
    if (s.type === 'understand' || s.type === 'plan' || s.type === 'update' || s.type === 'write') return false;
    if (s.type === 'think' && !s.content && !s.artifact) return false;
    return true;
  });

  const respNode = cleanTraceSteps.find(s => s.type === 'response') || { type: 'response', content: '' };
  respNode.content = stitched;

  if (onStepUpdate) onStepUpdate([...cleanTraceSteps]);
  if (onChunk) onChunk(stitched, stitched);

  // Auto-learn user corrections & technical rules in the background
  try {
    const { key: gKey } = getAvailableGroqKey();
    analyzeAndLearnFromTurn({
      userPrompt: run.userText,
      assistantResponse: stitched,
      conversationId: run.convId || null,
      groqApiKey: gKey
    });
  } catch {}

  return {
    hasCode: Boolean(finalArtifact),
    isSubstantialCode: Boolean(finalArtifact && finalArtifact.content && finalArtifact.content.split('\n').length > 15),
    artifact: finalArtifact,
    followups,
    retrievedMemories: run.relevantMemories || [],
    ragSources: run.ragSources || []
  };
}
