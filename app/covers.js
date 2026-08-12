/*
 * Resolves lockbox cover artwork from synced local media first, then verified
 * community sources. Placeholder research metadata is never rendered as art.
 */
import nwhubMedia from './data/nwhub-media.js';
import localMedia from './data/local-media.js';

const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const STORAGE_KEY = 'lockbox-cover-media-v3';
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
  const text = String(value || '').trim();
  if (text.startsWith('/') || text.startsWith('./')) return true;
  try {
    const url = new URL(text);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

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
    // Storage is optional. Cover rendering must not depend on it.
  }
};

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
    // Remote media remains usable for the current page view.
  }
};

readStoredCovers();

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
  const local = localMedia?.items?.lockbox?.[entry.slug];
  if (local?.url && isSafeImageUrl(local.url)) {
    return {
      ...local,
      pageUrl: local.sourceUrl,
      provider: local.provider || 'Synced local artwork',
      isPlaceholder: false,
      isLocal: true,
    };
  }

  const media = coverMedia.get(entry.slug);
  if (!media?.url || !isSafeImageUrl(media.url)) return null;

  return {
    ...media,
    isPlaceholder: false,
  };
};

export const hydrateCoverMedia = async (
  entries,
  { fetchImpl = globalThis.fetch, batchSize = 25, force = false } = {},
) => {
  if (!Array.isArray(entries) || typeof fetchImpl !== 'function') return 0;

  const pending = entries.filter((entry) => force || !resolveCoverMedia(entry));
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
          provider: 'Neverwinter Wiki',
          rightsNote: 'Community wiki image; game artwork rights remain with the respective publisher.',
        });
        updated += 1;
      }
    } catch {
      // Remote media failure leaves local or fallback artwork in place.
    }
  }

  if (updated) saveStoredCovers();
  return updated;
};

export const __resetCoverMediaForTests = () => {
  coverMedia.clear();
  seedNwHubCovers();
};
