/*
 * Resolves lockbox cover artwork from verified community sources.
 * Generated placeholder metadata may remain in the catalog as research state,
 * but the runtime only returns HTTPS media that has an identified source.
 */
import nwhubMedia from './data/nwhub-media.js';

const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const STORAGE_KEY = 'lockbox-cover-media-v2';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const coverMedia = new Map();

/** Normalizes a title for matching wiki responses back to requested lockboxes. */
const normalizeTitle = (value = '') => String(value)
  .replaceAll('_', ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

/** Removes catalogue-only suffixes before a lockbox title is sent to media sources. */
const titleForEntry = (entry) => String(entry?.name || '')
  .replace(/\s*\(CONSOLE ONLY\)\s*$/i, '')
  .trim();

/** Accepts only HTTPS media URLs for browser rendering. */
const isSafeImageUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Restores recently verified cover URLs from local storage when available. */
const readStoredCovers = () => {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    if (!storage) return;

    const stored = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    if (!stored || Date.now() - stored.savedAt > CACHE_TTL_MS) return;

    for (const [slug, media] of Object.entries(stored.covers || {})) {
      if (media?.url && isSafeImageUrl(media.url)) coverMedia.set(slug, media);
    }
  } catch {
    // A stale, restricted, or blocked cache should never stop the catalogue from rendering.
  }
};

/** Persists verified cover URLs so repeat visits do not need to rediscover them. */
const saveStoredCovers = () => {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    if (!storage) return;

    storage.setItem(STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      covers: Object.fromEntries(coverMedia),
    }));
  } catch {
    // Storage can be disabled or full. Remote covers remain usable for this page view.
  }
};

readStoredCovers();

/** Seeds the in-memory cover map with verified NW Hub media extracted by maintenance tooling. */
const seedNwHubCovers = () => {
  for (const [slug, media] of Object.entries(nwhubMedia?.items?.lockbox || {})) {
    if (!media?.url || !isSafeImageUrl(media.url)) continue;
    coverMedia.set(slug, {
      ...media,
      pageUrl: media.sourceUrl || nwhubMedia.source || 'https://nw-hub.com/packs',
      provider: media.provider || 'NW Hub',
      rightsNote: media.rightsNote || 'Image URL published by NW Hub; Neverwinter artwork rights remain with the respective publisher.',
    });
  }
};

seedNwHubCovers();

/** Builds one batched Neverwinter Wiki request for unresolved lockbox covers. */
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

/** Returns verified cover media for an entry, or null when only placeholder research metadata exists. */
export const resolveCoverMedia = (entry) => {
  const media = coverMedia.get(entry.slug);
  if (!media?.url || !isSafeImageUrl(media.url)) return null;

  return {
    ...media,
    isPlaceholder: false,
  };
};

/** Discovers missing covers from the wiki and stores only verified HTTPS results. */
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
      // Remote media failure leaves the cover unrendered until a verified source is available.
    }
  }

  if (updated) saveStoredCovers();
  return updated;
};

/** Clears test state and restores the curated NW Hub seed data. */
export const __resetCoverMediaForTests = () => {
  coverMedia.clear();
  seedNwHubCovers();
};
