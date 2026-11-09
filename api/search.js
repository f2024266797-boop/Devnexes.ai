// Vercel serverless function supporting Tavily (Priority 1) and Brave (Priority 2).
const MAX_QUERY_LENGTH = 500;

function json(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  return response.json(body);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed' });

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body || {};
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : '';
  if (!query) return json(response, 400, { error: 'A search query is required.' });

  // ── 1. Priority 1: Tavily Search ───────────────────────────────
  if (process.env.TAVILY_API_KEY) {
    try {
      const upstream = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: 'basic',
          include_answer: true,
          include_raw_content: false,
          max_results: 8
        }),
        signal: AbortSignal.timeout(10_000)
      });

      if (upstream.ok) {
        const data = await upstream.json();
        const results = [];

        if (data.answer && typeof data.answer === 'string') {
          results.push({
            title: 'Verified Ground Truth (Tavily AI Verified Facts)',
            snippet: data.answer,
            url: 'https://tavily.com',
            domain: 'tavily.com',
            favicon: 'https://www.google.com/s2/favicons?domain=tavily.com&sz=32',
            score: 1.0,
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
              score: Number(item.score) || 0,
              source: 'tavily'
            }];
          } catch {
            return [];
          }
        });
        results.push(...items);
        if (results.length > 0) return json(response, 200, { results });
      }
    } catch (tavilyErr) {
      console.warn('[api/search] Tavily error, trying Brave fallback:', tavilyErr.message);
    }
  }

  // ── 2. Priority 2: Brave Search ────────────────────────────────
  if (process.env.BRAVE_API_KEY) {
    try {
      const upstream = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': process.env.BRAVE_API_KEY
        },
        signal: AbortSignal.timeout(10_000)
      });

      if (upstream.ok) {
        const data = await upstream.json();
        const results = (data.web?.results || []).flatMap(item => {
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
        if (results.length > 0) return json(response, 200, { results });
      }
    } catch (braveErr) {
      console.warn('[api/search] Brave error:', braveErr.message);
    }
  }

  return json(response, 503, { error: 'No search provider available or configured.' });
}
