const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const STORAGE_KEY = 'lockbox-cover-media-v2';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const coverMedia = new Map();

const normalizeTitle = (value = '') => String(value)
  .replaceAll('_', ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const titleForEntry = (entry) => String(entry?.name || '')
  .replace(/\s*\(CONSOLE ONLY\)\s*$/i, '')
  .trim();

const isSafeImageUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

const readStoredCovers = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || Date.now() - stored.savedAt > CACHE_TTL_MS) return;

    for (const [slug, media] of Object.entries(stored.covers || {})) {
      if (media?.url && isSafeImageUrl(media.url)) coverMedia.set(slug, media);
    }
  } catch {
    // A stale or blocked cache should never stop the catalogue from rendering.
  }
};

const saveStoredCovers = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      covers: Object.fromEntries(coverMedia),
    }));
  } catch {
    // Storage can be disabled or full. Remote covers remain usable for this page view.
  }
};

readStoredCovers();

export const buildCoverApiUrl = (entries) => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'pageimages|info',
    piprop: 'thumbnail|original',
    pithumbsize: '960',
    inprop: 'url',
    origin: '*',
    titles: entries.map(titleForEntry).join('|'),
  });

  return `${WIKI_API}?${params}`;
};

export const resolveCoverMedia = (entry) => {
  const media = coverMedia.get(entry.slug);
  if (media?.url) {
    return {
      ...media,
      fallbackUrl: entry.image,
      isPlaceholder: false,
    };
  }

  return {
    url: entry.image,
    fallbackUrl: entry.image,
    pageUrl: entry.imageDiscovery?.pageUrl || null,
    provider: 'Generated community placeholder',
    isPlaceholder: true,
  };
};

export const hydrateCoverMedia = async (
  entries,
  { fetchImpl = globalThis.fetch, batchSize = 25, force = false } = {},
) => {
  if (!Array.isArray(entries) || typeof fetchImpl !== 'function') return 0;

  const pending = entries.filter((entry) => force || !coverMedia.has(entry.slug));
  let updated = 0;

  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = pending.slice(index, index + batchSize);
    const entryByTitle = new Map(
      batch.map((entry) => [normalizeTitle(titleForEntry(entry)), entry]),
    );

    try {
      const response = await fetchImpl(buildCoverApiUrl(batch), {
        headers: { accept: 'application/json' },
      });
      if (!response?.ok) continue;

      const payload = await response.json();
      const query = payload?.query || {};
      const targetToRequested = new Map();

      for (const item of query.normalized || []) {
        targetToRequested.set(normalizeTitle(item.to), normalizeTitle(item.from));
      }
      for (const item of query.redirects || []) {
        targetToRequested.set(normalizeTitle(item.to), normalizeTitle(item.from));
      }

      for (const page of query.pages || []) {
        if (page.missing) continue;

        const pageKey = normalizeTitle(page.title);
        const requestedKey = targetToRequested.get(pageKey) || pageKey;
        const entry = entryByTitle.get(pageKey) || entryByTitle.get(requestedKey);
        const imageUrl = page.thumbnail?.source || page.original?.source;

        if (!entry || !imageUrl || !isSafeImageUrl(imageUrl)) continue;

        coverMedia.set(entry.slug, {
          url: imageUrl,
          pageUrl: page.fullurl || `https://neverwinter.fandom.com/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
          provider: 'Neverwinter Wiki / Fandom',
          rightsNote: 'Community wiki image; game artwork rights remain with the respective publisher.',
        });
        updated += 1;
      }
    } catch {
      // A remote source failure falls back to the generated local cover for this batch.
    }
  }

  if (updated) saveStoredCovers();
  return updated;
};

export const __resetCoverMediaForTests = () => {
  coverMedia.clear();
};
