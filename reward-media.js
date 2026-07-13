const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const STORAGE_KEY = 'lockbox-reward-media-v2';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const mediaCache = new Map();

const cleanName = (value = '') => {
  const accountMatch = String(value).match(/^\[(.+)]\s*-\s*Account unlock$/i);
  return (accountMatch ? accountMatch[1] : String(value))
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/[’]/g, "'")
    .trim();
};

const keyFor = (type, value) => `${type}:${cleanName(value).toLowerCase()}`;

const safeUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored && Date.now() - stored.savedAt < CACHE_TTL_MS) {
      Object.entries(stored.items || {}).forEach(([key, media]) => {
        if (media?.url && safeUrl(media.url)) mediaCache.set(key, media);
      });
    }
  } catch {
    // Cached media is optional.
  }
}

const saveCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      items: Object.fromEntries(mediaCache),
    }));
  } catch {
    // Storage may be unavailable.
  }
};

export const resolveFallbackRewardMedia = (type, item) => mediaCache.get(keyFor(type, item)) || null;

export const hydrateFallbackRewardMedia = async (
  entries,
  { fetchImpl = globalThis.fetch, batchSize = 20 } = {},
) => {
  if (!Array.isArray(entries) || typeof fetchImpl !== 'function') return 0;

  const requests = [];
  const groups = {
    companions: 'companion',
    artifacts: 'artifact',
    mounts: 'mount',
    races: 'race',
  };

  for (const entry of entries) {
    for (const [group, type] of Object.entries(groups)) {
      for (const item of entry?.rewards?.[group] || []) {
        const key = keyFor(type, item);
        if (!mediaCache.has(key)) requests.push({ key, type, item, title: cleanName(item) });
      }
    }
  }

  const unique = [...new Map(requests.map((request) => [request.key, request])).values()];
  let updated = 0;

  for (let index = 0; index < unique.length; index += batchSize) {
    const batch = unique.slice(index, index + batchSize);
    const byTitle = new Map(batch.map((request) => [request.title.toLowerCase(), request]));
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      prop: 'pageimages|info',
      piprop: 'thumbnail|original',
      pithumbsize: '256',
      inprop: 'url',
      origin: '*',
      titles: batch.map((request) => request.title).join('|'),
    });

    try {
      const response = await fetchImpl(`${WIKI_API}?${params}`, {
        headers: { accept: 'application/json' },
      });
      if (!response?.ok) continue;

      const payload = await response.json();
      const query = payload?.query || {};
      const aliases = new Map();
      [...(query.normalized || []), ...(query.redirects || [])].forEach((item) => {
        aliases.set(String(item.to).toLowerCase(), String(item.from).toLowerCase());
      });

      for (const page of query.pages || []) {
        if (page.missing) continue;
        const pageTitle = String(page.title || '').toLowerCase();
        const request = byTitle.get(pageTitle) || byTitle.get(aliases.get(pageTitle));
        const imageUrl = page.thumbnail?.source || page.original?.source;
        if (!request || !imageUrl || !safeUrl(imageUrl)) continue;

        mediaCache.set(request.key, {
          url: imageUrl,
          sourceUrl: page.fullurl || `https://neverwinter.fandom.com/wiki/${encodeURIComponent(String(page.title || '').replaceAll(' ', '_'))}`,
          provider: 'Neverwinter Wiki / Fandom',
          rightsNote: 'Community wiki image; game artwork rights remain with the respective publisher.',
        });
        updated += 1;
      }
    } catch {
      // Remote lookup failure leaves the current fallback intact.
    }
  }

  if (updated) saveCache();
  return updated;
};
