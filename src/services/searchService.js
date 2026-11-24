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

import { isRealApiKey, cleanDynamicSearchQuery, hasFuzzyWord } from '../utils/dynamicNLP.js';

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
    tavilyKey: isRealApiKey(tavilyKey) ? tavilyKey.trim() : '',
    braveKey: isRealApiKey(braveKey) ? braveKey.trim() : '',
    searxngUrl: (searxngUrl && !searxngUrl.includes('your_')) ? searxngUrl.trim() : ''
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
 * Clean & optimize queries dynamically by removing conversational filler,
 * greetings, and search command verbs so search engines receive exact entities.
 */
export function extractOptimizedSearchQuery(rawQuery) {
  return cleanDynamicSearchQuery(rawQuery);
}

/**
 * Resolves contextual search query from conversation history dynamically
 * when user asks short follow-up search queries without an explicit subject.
 */
export function resolveContextualSearchQuery(prompt, messagesHistory = []) {
  if (!prompt || typeof prompt !== 'string') return '';
  const clean = cleanDynamicSearchQuery(prompt);

  // If current query is short without an explicit entity, inspect recent conversation dynamically
  if (clean.length < 12 && messagesHistory && messagesHistory.length > 0) {
    for (let i = messagesHistory.length - 1; i >= 0; i--) {
      const msg = messagesHistory[i];
      if (msg.role === 'user' && msg.content) {
        const prevClean = cleanDynamicSearchQuery(msg.content);
        if (prevClean && prevClean.length >= 10) {
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
