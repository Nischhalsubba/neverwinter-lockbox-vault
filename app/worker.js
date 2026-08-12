const NW_HUB_PACKS_URL = 'https://nw-hub.com/packs';
const MAX_SCRIPT_FILES = 16;
const MAX_SCRIPT_BYTES = 1_500_000;
const IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i;

const decodeHtml = (value = '') => String(value)
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('\\/', '/');

const absoluteUrl = (value, base = NW_HUB_PACKS_URL) => {
  try {
    const url = new URL(decodeHtml(value), base);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

const imageLike = (value) => IMAGE_EXTENSIONS.test(String(value || ''));

const attributesFromTag = (tag) => {
  const attributes = {};
  const pattern = /([:@a-zA-Z0-9_-]+)\s*=\s*(["'])(.*?)\2/gs;
  for (const [, name, , value] of tag.matchAll(pattern)) attributes[name.toLowerCase()] = decodeHtml(value.trim());
  return attributes;
};

const titleFromUrl = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
      .replace(/\.(?:avif|gif|jpe?g|png|svg|webp)$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b(?:icon|image|thumbnail|thumb|inventory)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
};

const addCandidate = (map, { title = '', url, sourceUrl = NW_HUB_PACKS_URL, type = null } = {}) => {
  const resolved = absoluteUrl(url, sourceUrl);
  if (!resolved || !imageLike(resolved)) return;
  const cleanedTitle = decodeHtml(title).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || titleFromUrl(resolved);
  const key = `${cleanedTitle.toLowerCase()}|${resolved}`;
  if (!map.has(key)) map.set(key, { title: cleanedTitle, url: resolved, sourceUrl, provider: 'NW Hub', type });
};

export const extractCandidatesFromText = (text, sourceUrl = NW_HUB_PACKS_URL) => {
  const candidates = new Map();
  const body = String(text || '');

  for (const tag of body.match(/<img\b[^>]*>/gis) || []) {
    const attrs = attributesFromTag(tag);
    let src = attrs.src || attrs['data-src'] || attrs['data-lazy-src'] || attrs['data-original'];
    if (!src && attrs.srcset) src = attrs.srcset.split(',')[0]?.trim().split(/\s+/)[0];
    const title = attrs.alt || attrs.title || attrs['aria-label'] || attrs['data-name'] || attrs['data-title'];
    addCandidate(candidates, { title, url: src, sourceUrl });
  }

  const nameThenImage = /"(?:name|title|displayName|label|alt)"\s*:\s*"([^"\\]{2,180})"[\s\S]{0,900}?"(?:image|imageUrl|icon|thumbnail|thumb|src|url)"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+|\/[^"\\]+\.(?:avif|gif|jpe?g|png|svg|webp)[^"\\]*)"/gi;
  for (const [, title, url] of body.matchAll(nameThenImage)) addCandidate(candidates, { title, url, sourceUrl });

  const imageThenName = /"(?:image|imageUrl|icon|thumbnail|thumb|src|url)"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+|\/[^"\\]+\.(?:avif|gif|jpe?g|png|svg|webp)[^"\\]*)"[\s\S]{0,900}?"(?:name|title|displayName|label|alt)"\s*:\s*"([^"\\]{2,180})"/gi;
  for (const [, url, title] of body.matchAll(imageThenName)) addCandidate(candidates, { title, url, sourceUrl });

  const bareImages = /(?:https?:\\?\/\\?\/|\/)[^"'\s)]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^"'\s)]*)?/gi;
  for (const match of body.match(bareImages) || []) addCandidate(candidates, { url: match, sourceUrl });

  return [...candidates.values()];
};

const scriptUrlsFromHtml = (html, baseUrl) => {
  const urls = [];
  for (const tag of String(html).match(/<script\b[^>]*\bsrc\s*=\s*(["']).*?\1[^>]*>/gis) || []) {
    const attrs = attributesFromTag(tag);
    const url = absoluteUrl(attrs.src, baseUrl);
    if (url && new URL(url).origin === new URL(baseUrl).origin) urls.push(url);
  }
  return [...new Set(urls)].slice(0, MAX_SCRIPT_FILES);
};

export const fetchNwHubCandidates = async (fetchImpl = fetch) => {
  const response = await fetchImpl(NW_HUB_PACKS_URL, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (compatible; NeverwinterLockboxVault/1.0)',
    },
  });
  if (!response.ok) throw new Error(`NW Hub returned ${response.status}`);
  const html = await response.text();
  const htmlCandidates = extractCandidatesFromText(html, NW_HUB_PACKS_URL);
  const all = new Map(htmlCandidates.map((item) => [`${item.title}|${item.url}`, item]));

  const scripts = scriptUrlsFromHtml(html, NW_HUB_PACKS_URL);
  const results = await Promise.allSettled(scripts.map(async (url) => {
    const scriptResponse = await fetchImpl(url, { headers: { accept: 'text/javascript,*/*;q=0.8' } });
    if (!scriptResponse.ok) return [];
    const contentLength = Number(scriptResponse.headers.get('content-length') || 0);
    if (contentLength > MAX_SCRIPT_BYTES) return [];
    const text = (await scriptResponse.text()).slice(0, MAX_SCRIPT_BYTES);
    return extractCandidatesFromText(text, url);
  }));

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) all.set(`${item.title}|${item.url}`, item);
  }

  return {
    source: NW_HUB_PACKS_URL,
    generatedAt: new Date().toISOString(),
    stats: { htmlCandidates: htmlCandidates.length, scriptsScanned: scripts.length, candidates: all.size },
    candidates: [...all.values()],
  };
};

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600', ...headers },
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/nwhub-assets') {
      const cache = caches.default;
      const cacheKey = new Request(`${url.origin}/api/nwhub-assets`, request);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const payload = await fetchNwHubCandidates(fetch);
        const response = json(payload);
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json({ source: NW_HUB_PACKS_URL, generatedAt: new Date().toISOString(), stats: { candidates: 0 }, candidates: [], error: String(error?.message || error) }, 502, { 'cache-control': 'no-store' });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
