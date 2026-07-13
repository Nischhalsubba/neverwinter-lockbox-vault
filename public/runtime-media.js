const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const CACHE_KEY = 'lockbox-runtime-media-v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const media = new Map();
let lockboxes = [];
let staticResolver = null;
let hydrationStarted = false;

const clean = (value = '') => {
  const match = String(value).match(/^\[(.+)]\s*-\s*Account unlock$/i);
  return (match ? match[1] : String(value))
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/[’]/g, "'")
    .trim();
};

const key = (type, name) => `${type}:${clean(name).toLowerCase()}`;

const safeUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

try {
  const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  if (stored && Date.now() - stored.savedAt < CACHE_TTL) {
    Object.entries(stored.items || {}).forEach(([itemKey, item]) => {
      if (item?.url && safeUrl(item.url)) media.set(itemKey, item);
    });
  }
} catch {
  // Local storage is optional.
}

const save = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      items: Object.fromEntries(media),
    }));
  } catch {
    // Local storage is optional.
  }
};

const fetchWikiMedia = async (requests, batchSize = 20) => {
  let updated = 0;
  const unique = [...new Map(requests.map((request) => [request.key, request])).values()];

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
      pithumbsize: '960',
      inprop: 'url',
      origin: '*',
      titles: batch.map((request) => request.title).join('|'),
    });

    try {
      const response = await fetch(`${WIKI_API}?${params}`, { headers: { accept: 'application/json' } });
      if (!response.ok) continue;
      const query = (await response.json())?.query || {};
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
        media.set(request.key, {
          url: imageUrl,
          sourceUrl: page.fullurl || `https://neverwinter.fandom.com/wiki/${encodeURIComponent(String(page.title || '').replaceAll(' ', '_'))}`,
          provider: 'Neverwinter Wiki / Fandom',
        });
        updated += 1;
      }
    } catch {
      // A failed remote batch leaves the existing fallback intact.
    }
  }

  if (updated) save();
  return updated;
};

const rewardTypeMap = () => {
  const result = new Map();
  const groups = {
    companions: 'companion',
    artifacts: 'artifact',
    mounts: 'mount',
    races: 'race',
  };
  lockboxes.forEach((entry) => Object.entries(groups).forEach(([group, type]) => {
    (entry?.rewards?.[group] || []).forEach((item) => result.set(clean(item).toLowerCase(), type));
  }));
  return result;
};

const applyImages = () => {
  document.querySelectorAll('.lockbox-card').forEach((card) => {
    const title = card.querySelector('h3')?.textContent?.trim();
    const entry = lockboxes.find((item) => item.name === title);
    const image = card.querySelector('[data-cover-image], .card-media img');
    const item = entry && media.get(key('lockbox', entry.name));
    if (image && item?.url && image.src !== item.url) {
      image.src = item.url;
      image.alt = `${entry.name} cover image`;
      image.referrerPolicy = 'no-referrer';
      const badge = card.querySelector('.image-status');
      if (badge) {
        badge.textContent = 'Community thumbnail';
        badge.classList.add('source-found');
      }
    }
  });

  const types = rewardTypeMap();
  document.querySelectorAll('.reward-row, .reward-item').forEach((row) => {
    const textNode = row.querySelector('.reward-item-copy > span, span:last-child');
    const name = clean(textNode?.textContent || '');
    const type = types.get(name.toLowerCase());
    if (!type || !name) return;

    const existing = staticResolver?.(type, name) || media.get(key(type, name));
    if (!existing?.url) return;

    let wrapper = row.querySelector('.reward-media');
    if (!wrapper) return;
    let image = wrapper.querySelector('img');
    if (!image) {
      image = document.createElement('img');
      image.width = 64;
      image.height = 64;
      image.loading = 'lazy';
      image.alt = '';
      image.dataset.mediaImage = '';
      wrapper.prepend(image);
    }
    image.src = existing.url;
    image.referrerPolicy = 'no-referrer';
    wrapper.classList.remove('reward-media-fallback-only', 'media-failed');
  });
};

const hydrate = async () => {
  if (hydrationStarted) return;
  hydrationStarted = true;

  try {
    [lockboxes, { resolveRewardMedia: staticResolver }] = await Promise.all([
      fetch('./data/lockboxes.json', { cache: 'no-store' }).then((response) => response.json()),
      import('./media.js'),
    ]);
  } catch {
    hydrationStarted = false;
    return;
  }

  const requests = [];
  lockboxes.forEach((entry) => {
    if (!media.has(key('lockbox', entry.name))) {
      requests.push({ key: key('lockbox', entry.name), title: entry.name.replace(/\s*\(CONSOLE ONLY\)\s*$/i, '') });
    }
    const groups = { companions: 'companion', artifacts: 'artifact', mounts: 'mount', races: 'race' };
    Object.entries(groups).forEach(([group, type]) => {
      (entry?.rewards?.[group] || []).forEach((item) => {
        const itemKey = key(type, item);
        if (!staticResolver(type, item) && !media.has(itemKey)) {
          requests.push({ key: itemKey, title: clean(item) });
        }
      });
    });
  });

  applyImages();
  await fetchWikiMedia(requests);
  applyImages();

  new MutationObserver(() => applyImages()).observe(document.body, { childList: true, subtree: true });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrate, { once: true });
} else {
  hydrate();
}
