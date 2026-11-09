/**
 * Devnexes AI — Multi-Provider Prioritized Real-Time Search Engine
 * 
 * Priority 1 (Dual Parallel Retrieval):
 *   - Tavily Search API (Deep AI Web Grounding & Fact Verification)
 *   - SearXNG Multi-Engine (Independent Privacy Meta-Search across Google, Bing, Reddit, Wiki)
 * Priority 2: Brave Search API (Independent Privacy Index)
 * Priority 3: DuckDuckGo & Wikipedia (Free, Open-Source, Zero-Key Fallback)
 * 
 * Both Tavily and SearXNG run simultaneously, aggregate their findings dynamically,
 * deduplicate sources, and forward the combined real-time knowledge to Groq for factual synthesis.
 */

export function getSearchKeys() {
  let tavilyKey = '';
  let braveKey = '';
  let searxngUrl = '';

  try {
    tavilyKey = localStorage.getItem('devnexes_tavily_key') || '';
    braveKey = localStorage.getItem('devnexes_brave_key') || '';
    searxngUrl = localStorage.getItem('devnexes_searxng_url') || '';
  } catch { }

  if (!tavilyKey) {
    tavilyKey = import.meta?.env?.VITE_TAVILY_API_KEY || import.meta?.env?.TAVILY_API_KEY || '';
  }
  if (!braveKey) {
    braveKey = import.meta?.env?.VITE_BRAVE_API_KEY || import.meta?.env?.BRAVE_API_KEY || '';
  }
  if (!searxngUrl) {
    searxngUrl = import.meta?.env?.VITE_SEARXNG_URL || import.meta?.env?.SEARXNG_URL || '';
  }

  return {
    tavilyKey: tavilyKey.trim(),
    braveKey: braveKey.trim(),
    searxngUrl: searxngUrl.trim()
  };
}

export function saveSearchKeys({ tavilyKey, braveKey, searxngUrl }) {
  try {
    if (typeof tavilyKey === 'string') {
      if (tavilyKey.trim()) localStorage.setItem('devnexes_tavily_key', tavilyKey.trim());
      else localStorage.removeItem('devnexes_tavily_key');
    }
    if (typeof braveKey === 'string') {
      if (braveKey.trim()) localStorage.setItem('devnexes_brave_key', braveKey.trim());
      else localStorage.removeItem('devnexes_brave_key');
    }
    if (typeof searxngUrl === 'string') {
      if (searxngUrl.trim()) localStorage.setItem('devnexes_searxng_url', searxngUrl.trim());
      else localStorage.removeItem('devnexes_searxng_url');
    }
  } catch { }
}

export function getSearchProvidersStatus() {
  const { tavilyKey, braveKey, searxngUrl } = getSearchKeys();
  return [
    {
      id: 'tavily',
      name: 'Tavily Search API',
      priority: 1,
      configured: Boolean(tavilyKey),
      maskedKey: tavilyKey ? `${tavilyKey.slice(0, 5)}...${tavilyKey.slice(-4)}` : 'Not configured'
    },
    {
      id: 'searxng',
      name: 'SearXNG Multi-Engine',
      priority: 1,
      configured: true,
      maskedKey: searxngUrl ? searxngUrl : 'Auto-balanced Public Instances'
    },
    {
      id: 'brave',
      name: 'Brave Search API',
      priority: 2,
      configured: Boolean(braveKey),
      maskedKey: braveKey ? `${braveKey.slice(0, 5)}...${braveKey.slice(-4)}` : 'Not configured'
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo + Wikipedia',
      priority: 3,
      configured: true,
      maskedKey: 'Open-Source Fallback'
    }
  ];
}

/**
 * ── PRIORITY 1A: Tavily Search ───────────────────────────────────
 */
async function searchWithTavily(query, tavilyKey, signal) {
  // 1. Try serverless endpoint first (if running on Vercel)
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: signal || AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results.map(r => ({ ...r, source: 'tavily' }));
      }
    }
  } catch {
    // If /api/search unavailable (e.g. local dev), proceed to direct Tavily call
  }

  // 2. Direct client-side Tavily API call
  if (!tavilyKey) return null;

  try {
    const upstream = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
        max_results: 6
      }),
      signal: signal || AbortSignal.timeout(8000)
    });

    if (!upstream.ok) {
      throw new Error(`Tavily returned HTTP ${upstream.status}`);
    }

    const data = await upstream.json();
    const results = [];

    if (data.answer && typeof data.answer === 'string') {
      results.push({
        title: 'Verified Ground Truth (Tavily AI Fact Check)',
        snippet: data.answer,
        url: 'https://tavily.com',
        domain: 'tavily.com',
        favicon: 'https://www.google.com/s2/favicons?domain=tavily.com&sz=32',
        source: 'tavily'
      });
    }

    const items = (data.results || []).flatMap(item => {
      try {
        const url = new URL(item.url);
        return [{
          title: String(item.title || url.hostname).slice(0, 180),
          snippet: String(item.content || '').slice(0, 500),
          url: url.toString(),
          domain: url.hostname.replace(/^www\./, ''),
          favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=32`,
          source: 'tavily'
        }];
      } catch {
        return [];
      }
    });

    results.push(...items);
    return results.length > 0 ? results : null;
  } catch (err) {
    console.warn('[Search] Tavily search error:', err.message);
    return null;
  }
}

/**
 * ── PRIORITY 1B: SearXNG Multi-Engine Search ─────────────────────
 */
const SEARXNG_PUBLIC_INSTANCES = [
  'https://searxng.site',
  'https://searx.rhscz.eu',
  'https://searx.si',
  'https://sx.catgirl.cloud'
];

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseSearxngHtml(html) {
  const results = [];
  const articleRegex = /<article\b[^>]*class=["'][^"']*result[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articleRegex.exec(html)) !== null && results.length < 8) {
    const block = match[1];
    const linkMatch = /<h[34]\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!linkMatch) continue;

    const href = linkMatch[1];
    const rawTitle = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, '').trim());

    const contentMatch = /<p\b[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/p>/i.exec(block);
    const snippet = contentMatch
      ? decodeHtmlEntities(contentMatch[1].replace(/<[^>]+>/g, '').trim())
      : '';

    if (href && rawTitle) {
      try {
        const u = new URL(href);
        if (u.hostname.includes('searx') || u.protocol.startsWith('javascript')) continue;
        results.push({
          title: rawTitle.slice(0, 180),
          snippet: snippet.slice(0, 500),
          url: u.toString(),
          domain: u.hostname.replace(/^www\./, ''),
          favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=32`,
          source: 'searxng'
        });
      } catch { }
    }
  }

  return results;
}

export async function searchWithSearXNG(query, customUrl, signal) {
  const instances = [];
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    instances.push(customUrl.trim().replace(/\/+$/, ''));
  }
  instances.push(...SEARXNG_PUBLIC_INSTANCES);

  for (const instance of instances) {
    try {
      // 1. Try standard SearXNG JSON API endpoint
      try {
        const jsonUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
        const res = await fetch(jsonUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          signal: signal || AbortSignal.timeout(4500)
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.results) && data.results.length > 0) {
              const items = data.results.flatMap(item => {
                try {
                  const u = new URL(item.url);
                  return [{
                    title: String(item.title || u.hostname).slice(0, 180),
                    snippet: String(item.content || item.snippet || '').slice(0, 500),
                    url: u.toString(),
                    domain: u.hostname.replace(/^www\./, ''),
                    favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=32`,
                    source: 'searxng',
                    engine: item.engine || 'searxng'
                  }];
                } catch {
                  return [];
                }
              });
              if (items.length > 0) return items.slice(0, 8);
            }
          }
        }
      } catch {
        // If JSON disabled or timed out on this instance, continue to HTML parser
      }

      // 2. HTML Meta-Search Fallback
      const htmlUrl = `${instance}/search?q=${encodeURIComponent(query)}&categories=general`;
      const htmlRes = await fetch(htmlUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        signal: signal || AbortSignal.timeout(4500)
      });

      if (htmlRes.ok) {
        const text = await htmlRes.text();
        const parsed = parseSearxngHtml(text);
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // Try next instance in the pool
    }
  }

  return [];
}

/**
 * ── PRIORITY 2: Brave Search API ─────────────────────────────────
 */
async function searchWithBrave(query, braveKey, signal) {
  if (!braveKey) return null;

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': braveKey
      },
      signal: signal || AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      throw new Error(`Brave Search returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawResults = data.web?.results || [];
    const results = rawResults.flatMap(item => {
      try {
        const url = new URL(item.url);
        return [{
          title: String(item.title || url.hostname).slice(0, 180),
          snippet: String(item.description || '').slice(0, 500),
          url: url.toString(),
          domain: url.hostname.replace(/^www\./, ''),
          favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=32`,
          source: 'brave'
        }];
      } catch {
        return [];
      }
    });

    return results.length > 0 ? results : null;
  } catch (err) {
    console.warn('[Search] Brave search error:', err.message);
    return null;
  }
}

/**
 * ── PRIORITY 3: Open-Source DuckDuckGo + Wikipedia Fallback ──────
 */
async function searchWithDuckDuckGoAndWikipedia(query, signal) {
  const results = [];

  // DuckDuckGo Instant Answer API
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, { signal: signal || AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          snippet: data.AbstractText.slice(0, 300),
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          domain: 'duckduckgo.com',
          favicon: 'https://www.google.com/s2/favicons?domain=duckduckgo.com&sz=32',
          source: 'duckduckgo'
        });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic.Text && topic.FirstURL) {
            try {
              const url = new URL(topic.FirstURL);
              results.push({
                title: topic.Text.split(' - ')[0] || query,
                snippet: topic.Text.slice(0, 250),
                url: url.toString(),
                domain: url.hostname.replace(/^www\./, ''),
                favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=32`,
                source: 'duckduckgo'
              });
            } catch { }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Search] DuckDuckGo query error:', err.message);
  }

  // Wikipedia Search API
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5&srnamespace=0&srprop=snippet`;
    const res = await fetch(wikiUrl, { signal: signal || AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const wikiItems = data.query?.search || [];
      for (const item of wikiItems.slice(0, 4)) {
        const cleanSnippet = (item.snippet || '')
          .replace(/<[^>]*>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .trim();
        results.push({
          title: item.title,
          snippet: cleanSnippet.slice(0, 300),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          domain: 'wikipedia.org',
          favicon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32',
          source: 'wikipedia'
        });
      }
    }
  } catch (err) {
    console.warn('[Search] Wikipedia query error:', err.message);
  }

  return results;
}

/**
 * Clean & optimize queries by removing conversational English / Urdu filler
 * so search engines return exact, high-authority real-world ground truth.
 */
export function extractOptimizedSearchQuery(rawQuery) {
  if (!rawQuery) return '';
  const cleaned = rawQuery
    .replace(/^\/?(?:google|search|find)\b/i, '')
    .replace(/\b(?:search on google|search for|look up|find out about|tell me about|give me information about)\b/gi, '')
    .replace(/\b(?:google py|google pe|search karo|search karein|pury internet sy dundho|dhoondo|dhundo|pata karo|btao|batayein|koun hai|kon hai|kya hai)\b/gi, '')
    .replace(/\b(?:real tme|real time|live search|latest info|in roman english|in roman urdu|roman english ma|roman english me|roman urdu me|roman urdu ma|batao|batado|nad btao|aur batao|nad|and)\b/gi, '')
    .replace(/\b(?:website banao|portfolio banao|code likho|script banao|build a website for|create a portfolio for|strictly based on his|strictly based on her|based on his|based on her|strictly based on)\b/gi, '')
    .replace(/\b(?:ka|ki|ke|ko|se|sy|par|pe|me|mein|ma)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || rawQuery.trim();
}

/**
 * Resolves contextual search query from conversation history when user asks
 * follow-up search queries (e.g. "real time search karo", "dobara search karo", "isko dhoondo")
 */
export function resolveContextualSearchQuery(prompt, messagesHistory = []) {
  if (!prompt || typeof prompt !== 'string') return '';
  const lower = prompt.toLowerCase().trim();

  // 1. Normalize common typos and company name variations
  const normalized = prompt
    .replace(/\b(?:exes|devnexes|dev nexes)\s*(?:dgital|digital)\s*(?:solutions|solution)\b/gi, 'Devnexes Digital Solutions')
    .replace(/\bdgital\b/gi, 'digital')
    .replace(/\bsililar\b/gi, 'similar');

  const clean = extractOptimizedSearchQuery(normalized);

  // 2. Detect if current query is a generic instruction without an explicit subject/entity
  const isGenericFollowUp = (
    !clean ||
    clean.length < 4 ||
    /^(real tme|real time|search|search karo|dhundo|dhoondo|pata karo|btao|batayein|check|verify|again|dobara|details|info|karo|batao|riman english|roman english|in roman english)$/i.test(clean) ||
    (/\b(real tme|real time|dobara|again|isme|is me|iske|is ke|is company|us company|isi)\b/i.test(lower) && !/\b(devnexes|google|microsoft|apple|openai|chatgpt|amazon|meta|tesla|linkedin|software|tech|solutions)\b/i.test(clean))
  );

  // 3. Inspect recent conversation history to locate the real subject/entity
  if (isGenericFollowUp && messagesHistory && messagesHistory.length > 0) {
    for (let i = messagesHistory.length - 1; i >= 0; i--) {
      const msg = messagesHistory[i];
      if (msg.role === 'user' && msg.content) {
        const prevText = msg.content
          .replace(/\b(?:exes|devnexes|dev nexes)\s*(?:dgital|digital)\s*(?:solutions|solution)\b/gi, 'Devnexes Digital Solutions')
          .replace(/\bdgital\b/gi, 'digital');
        const prevClean = extractOptimizedSearchQuery(prevText);
        if (prevClean && prevClean.length >= 4 && !/^(hi|hello|salam|ok|haan|ji|yes|no)$/i.test(prevClean)) {
          return prevClean;
        }
      }
    }
  }

  return clean || prompt.trim();
}

/**
 * Main Dynamic Real-Time Search Pipeline:
 * Simultaneously executes Tavily Search and SearXNG Multi-Engine retrieval in parallel.
 * Aggregates, deduplicates, and formats both sets of live web findings before handing over to Groq.
 */
export async function executePrioritizedSearch(query, { signal } = {}) {
  const { tavilyKey, braveKey, searxngUrl } = getSearchKeys();
  const cleanQuery = extractOptimizedSearchQuery(query) || query;

  // ── DUAL HYBRID PARALLEL RETRIEVAL (TAVILY + SEARXNG) ──
  const [tavilyResult, searxngResult] = await Promise.allSettled([
    searchWithTavily(cleanQuery, tavilyKey, signal),
    searchWithSearXNG(cleanQuery, searxngUrl, signal)
  ]);

  const tavilyData = (tavilyResult.status === 'fulfilled' && Array.isArray(tavilyResult.value)) ? tavilyResult.value : [];
  const searxngData = (searxngResult.status === 'fulfilled' && Array.isArray(searxngResult.value)) ? searxngResult.value : [];

  if (tavilyData.length > 0 || searxngData.length > 0) {
    const combined = [];
    const seenUrls = new Set();
    const seenDomains = new Map();

    const addResult = (item) => {
      if (!item || !item.url) return;
      const normalizedUrl = item.url.replace(/\/+$/, '').toLowerCase();
      if (seenUrls.has(normalizedUrl)) return;
      seenUrls.add(normalizedUrl);

      // Avoid flooding with a single domain (max 2 per domain, except Tavily Ground Truth)
      const domainCount = seenDomains.get(item.domain) || 0;
      if (domainCount >= 2 && !item.title?.includes('Ground Truth')) return;
      seenDomains.set(item.domain, domainCount + 1);

      combined.push(item);
    };

    // 1. Tavily AI Ground Truth Answer (if available, always top priority)
    const tavilyAnswer = tavilyData.find(item => item.title?.includes('Ground Truth'));
    if (tavilyAnswer) addResult(tavilyAnswer);

    // 2. Interleave top Tavily and SearXNG findings for maximum breadth and depth
    const maxLen = Math.max(tavilyData.length, searxngData.length);
    for (let i = 0; i < maxLen; i++) {
      if (tavilyData[i] && !tavilyData[i].title?.includes('Ground Truth')) {
        addResult(tavilyData[i]);
      }
      if (searxngData[i]) {
        addResult(searxngData[i]);
      }
    }

    if (combined.length > 0) {
      return combined.slice(0, 10);
    }
  }

  // ── FALLBACK 1: Brave Search API ──
  const braveResults = await searchWithBrave(cleanQuery, braveKey, signal);
  if (braveResults && braveResults.length > 0) {
    return braveResults;
  }

  // ── FALLBACK 2: Free Open-Source DuckDuckGo + Wikipedia ──
  const openSourceResults = await searchWithDuckDuckGoAndWikipedia(cleanQuery, signal);
  return openSourceResults;
}
