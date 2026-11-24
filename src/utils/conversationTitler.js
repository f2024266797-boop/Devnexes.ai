/**
 * Smart Conversation Titler for Devnexes AI
 * Automatically synthesizes concise, accurate, user-friendly titles
 * for conversations when closing/switching chats.
 */

import { DEFAULT_GROQ_MODEL } from '../services/groqService';

export function isGenericTitle(title) {
  if (!title || typeof title !== 'string') return true;
  const t = title.trim().toLowerCase();
  if (['new chat', 'hi', 'hello', 'hey', 'salam', 'assalam', 'test', 'untitled', 'image analysis', 'visual', 'chat'].includes(t)) {
    return true;
  }
  if (/^(?:hi|hello|hey|salam|assalam|aoa)\b/i.test(t) && t.length < 20) {
    return true;
  }
  if (/^(?:ap kya|ap ka|kya kar skty|kya kr skty|what can you do|ismy kya|isme kya|yeh kya|ye kya)/i.test(t)) {
    return true;
  }
  if (t.length <= 4) {
    return true;
  }
  return false;
}

/**
 * Generates an accurate, clean, user-friendly 3-5 word title based on all messages
 */
export function generateSmartTitleLocally(messages = []) {
  if (!messages || messages.length === 0) return 'New Chat';

  const userMessages = messages.filter(m => m.role === 'user' && m.content);
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  // Collect substantive content across all messages
  const fullUserText = userMessages.map(m => m.content).join(' ').trim();
  const fullAsstText = assistantMessages.map(m => m.content || m.traceData?.steps?.find(s => s.type === 'response')?.content || '').join(' ').trim();
  const allText = (fullUserText + ' ' + fullAsstText).toLowerCase();

  // Domain Heuristic 1: Leave / Sick / Office Application
  if (/\b(leave|unwell|sick|doctor|medical|rest|furlough|supervisor|absence|certificate|chutti)\b/i.test(allText)) {
    return 'Sick Leave Application';
  }

  // Domain Heuristic 2: Model file / weights / best.pt / file inspection
  if (/\b(best\.pt|\.pt|\.pth|\.onnx|\.weights|yolo|weights file|weights)\b/i.test(allText)) {
    return 'PyTorch Model Analysis';
  }

  // Domain Heuristic 3: C++ Code / Systems Architecture
  if (/\b(c\+\+|cpp|#include|iostream|cout|cin|std::)\b/i.test(allText)) {
    return 'C++ Code Architecture';
  }

  // Domain Heuristic 4: Python / Data / Scraping
  if (/\b(python|def |pandas|numpy|pygame|fastapi|django|flask)\b/i.test(allText)) {
    return 'Python Scripting & Tools';
  }

  // Domain Heuristic 5: Devnexes AI / Capabilities / Feature Inquiry
  if (/\b(devnexes|kya kya kar skty|kya kar skte|what can you do|features|capabilities|help me)\b/i.test(allText)) {
    return 'Devnexes Capabilities';
  }

  // Domain Heuristic 6: HTML Canvas / Frontend / Web
  if (/\b(html|css|react|tailwind|canvas|website|web app|frontend)\b/i.test(allText)) {
    return 'Interactive Web Canvas';
  }

  // Domain Heuristic 7: 3D Animation / Robotics / Creative Images
  if (/\b(3d|robot|animated|animation|render|drawing|sd|stable diffusion|illustration)\b/i.test(allText)) {
    if (/\b(robot|cyborg|mech)\b/i.test(allText)) return '3D Robot Animation';
    return 'Creative Visual Asset';
  }

  // Domain Heuristic 7: Web Grounding & Real-time Search
  if (/\b(search|google|company|found|website|ceo|history)\b/i.test(allText) &&
      assistantMessages.some(m => m.traceData?.steps?.some(s => s.type === 'search'))) {
    return 'Web Research & Grounding';
  }

  // Fallback 1: Extract from substantive user question
  for (const uMsg of userMessages) {
    const raw = (uMsg.content || '').trim();
    const stripped = raw
      .replace(/^(?:hi|hello|hey|salam|assalam|aao|kese ho|how are you|test|bhai|batao|sunao)\b[!,.:\s]*/i, '')
      .replace(/^(?:can you|please|could you|i want to|mujhe|humko|kripya)\s+/i, '')
      .trim();

    if (stripped.length >= 3) {
      let clean = stripped.replace(/[?.,!;:]+$/, '').trim();
      const words = clean.split(/\s+/).slice(0, 5);
      clean = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      if (clean.length > 32) clean = clean.slice(0, 30) + '...';
      return clean;
    }
  }

  // Fallback 2: Extract from assistant's first heading
  if (assistantMessages.length > 0) {
    const asstText = assistantMessages[0].content || '';
    const headingMatch = asstText.match(/^(?:#+\s*|\*\*)([^\n*#]+)(?:\*\*|$)/m);
    if (headingMatch && headingMatch[1].trim().length > 3) {
      let h = headingMatch[1].trim().slice(0, 30);
      return h.charAt(0).toUpperCase() + h.slice(1);
    }
  }

  return 'General Inquiry';
}

/**
 * Asynchronously refines title via Groq LLM in background if API key is present
 */
export async function fetchSmartTitleFromAI(messages = [], apiKey = '') {
  if (!apiKey || !messages || messages.length === 0) return null;

  try {
    const userPrompts = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
    const asstSnippets = messages.filter(m => m.role === 'assistant').map(m => (m.content || '').slice(0, 150)).join('\n');
    const combined = `User:\n${userPrompts.slice(0, 250)}\n\nAssistant:\n${asstSnippets.slice(0, 250)}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_GROQ_MODEL || 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'system',
            content: 'Generate a short 3 to 4 word title in Title Case summarizing this conversation. Output ONLY the title with no quotes, no markdown, and no punctuation.'
          },
          {
            role: 'user',
            content: combined
          }
        ],
        max_tokens: 10,
        temperature: 0.2
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawTitle = data.choices?.[0]?.message?.content?.trim();
    if (rawTitle && rawTitle.length >= 3 && rawTitle.length <= 40) {
      return rawTitle.replace(/["'#*`]/g, '').trim();
    }
  } catch (err) {
    // Non-blocking fallback
  }
  return null;
}
