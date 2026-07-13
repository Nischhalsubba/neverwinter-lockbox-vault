const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const CACHE_KEY = 'lockbox-runtime-media-v2';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const media = new Map();
const searched = new Set();
let scheduled = false;
let running = false;

const clean = (value = '') => {
  const match = String(value).match(/^\[(.+)]\s*-\s*Account unlock$/i);
  return (match ? match[1] : String(value))
    .replace(/^(?:companion|artifact|mount|race)\s*:\s*/i, '')
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/\s+Mount$/i, '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const normalize = (value = '') => clean(value)
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const keyFor = (kind, name) => `${kind}:${normalize(name)}`;

const safeUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const isGeneratedPlaceholder = (image) => {
  const source = image?.getAttribute('src') || '';
  return !source
    || source.startsWith('data:image/svg')
    || /(?:^|\/)assets\/images\/[^/]+\.svg(?:$|\?)/i.test(source)
    || /placeholder/i.test(image?.alt || '');
};

const injectNoPlaceholderStyles = () => {
  if (document.querySelector('#no-placeholder-media-style')) return;
  const style = document.createElement('style');
  style.id = 'no-placeholder-media-style';
  style.textContent = `
    .card-media[data-media-empty="true"] { display: none !important; }
    .detail-hero > img[data-media-empty="true"] { display: none !important; }
    .reward-media[data-media-empty="true"] { display: none !important; }
    .reward-media .reward-fallback { display: none !important; }
    .image-status[data-media-empty="true"] { display: none !important; }
  `;
  document.head.append(style);
};

const loadCache = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!stored || Date.now() - stored.savedAt >= CACHE_TTL) return;
    Object.entries(stored.items || {}).forEach(([itemKey, item]) => {
      if (item?.url && safeUrl(item.url)) media.set(itemKey, item);
    });
  } catch {
    // Storage is optional.
  }
};

const saveCache = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      items: Object.fromEntries(media),
    }));
  } catch {
    // Storage is optional.
  }
};

const hideUnverifiedMedia = () => {
  document.querySelectorAll('.card-media').forEach((container) => {
    const image = container.querySelector('img');
    const badge = container.querySelector('.image-status');
    const empty = !image || isGeneratedPlaceholder(image);
    container.dataset.mediaEmpty = String(empty);
    if (image) image.dataset.mediaEmpty = String(empty);
    if (badge) badge.dataset.mediaEmpty = String(empty);
  });

  document.querySelectorAll('.detail-hero > img').forEach((image) => {
    image.dataset.mediaEmpty = String(isGeneratedPlaceholder(image));
  });

  document.querySelectorAll('.reward-media').forEach((wrapper) => {
    const image = wrapper.querySelector('img');
    const empty = !image || !safeUrl(image.getAttribute('src'));
    wrapper.dataset.mediaEmpty = String(empty);
  });
};

const lockboxRequestsFromDom = () => {
  const requests = [];

  document.querySelectorAll('.lockbox-card').forEach((card) => {
    const name = clean(card.querySelector('h3')?.textContent || '');
    if (name) requests.push({ key: keyFor('lockbox', name), kind: 'lockbox', title: name });
  });

  const dialogTitle = clean(document.querySelector('#detail-title')?.textContent || '');
  if (dialogTitle) requests.push({ key: keyFor('lockbox', dialogTitle), kind: 'lockbox', title: dialogTitle });

  return requests;
};

const rewardRequestsFromDom = () => {
  const requests = [];

  document.querySelectorAll('.reward-row').forEach((row) => {
    const name = clean(row.querySelector(':scope > span:last-child')?.textContent || '');
    if (name) requests.push({ key: keyFor('reward', name), kind: 'reward', title: name });
  });

  document.querySelectorAll('.reward-item').forEach((row) => {
    const name = clean(row.querySelector('.reward-item-copy > span')?.textContent || '');
    if (name) requests.push({ key: keyFor('reward', name), kind: 'reward', title: name });
  });

  return requests;
};

const collectRequests = () => {
  const all = [...lockboxRequestsFromDom(), ...rewardRequestsFromDom()];
  return [...new Map(all.map((request) => [request.key, request])).values()];
};

const pageImage = (page) => page?.thumbnail?.source || page?.original?.source || null;

const storeResult = (request, page) => {
  const url = pageImage(page);
  if (!url || !safeUrl(url)) return false;
  media.set(request.key, {
    url,
    sourceUrl: page.fullurl || `https://neverwinter.fandom.com/wiki/${encodeURIComponent(String(page.title || request.title).replaceAll(' ', '_'))}`,
    provider: 'Neverwinter Wiki / Fandom',
    title: page.title || request.title,
  });
  return true;
};

const fetchExactPages = async (requests, batchSize = 20) => {
  const resolved = new Set();

  for (let index = 0; index < requests.length; index += batchSize) {
    const batch = requests.slice(index, index + batchSize);
    const byTitle = new Map(batch.map((request) => [normalize(request.title), request]));
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
      titles: batch.map((request) => request.title.replace(/\s*\(CONSOLE ONLY\)\s*$/i, '')).join('|'),
    });

    try {
      const response = await fetch(`${WIKI_API}?${params}`, { cache: 'no-store', headers: { accept: 'application/json' } });
      if (!response.ok) continue;
      const query = (await response.json())?.query || {};
      const aliases = new Map();
      [...(query.normalized || []), ...(query.redirects || [])].forEach((item) => {
        aliases.set(normalize(item.to), normalize(item.from));
      });

      for (const page of query.pages || []) {
        if (page.missing) continue;
        const pageKey = normalize(page.title);
        const request = byTitle.get(pageKey) || byTitle.get(aliases.get(pageKey));
        if (request && storeResult(request, page)) resolved.add(request.key);
      }
    } catch {
      // Search fallback handles unresolved entries.
    }
  }

  return resolved;
};

const scoreSearchPage = (request, page) => {
  const target = normalize(request.title);
  const candidate = normalize(page.title || '');
  if (!target || !candidate || !pageImage(page)) return -1;
  if (candidate === target) return 1000;
  if (candidate.includes(target) || target.includes(candidate)) return 700;
  const tokens = target.split(' ').filter((token) => token.length > 2);
  const overlap = tokens.filter((token) => candidate.includes(token)).length;
  return overlap * 100 - Math.abs(candidate.length - target.length);
};

const searchOne = async (request) => {
  const query = request.kind === 'lockbox'
    ? `"${request.title}" lockbox`
    : `"${request.title}"`;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '0',
    gsrlimit: '8',
    prop: 'pageimages|info',
    piprop: 'thumbnail|original',
    pithumbsize: request.kind === 'lockbox' ? '960' : '320',
    inprop: 'url',
    origin: '*',
  });

  try {
    const response = await fetch(`${WIKI_API}?${params}`, { cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) return false;
    const pages = (await response.json())?.query?.pages || [];
    const best = pages
      .map((page) => ({ page, score: scoreSearchPage(request, page) }))
      .filter(({ score }) => score >= 100)
      .sort((a, b) => b.score - a.score)[0]?.page;
    return best ? storeResult(request, best) : false;
  } catch {
    return false;
  }
};

const runWithLimit = async (items, limit, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
};

const setRealImage = (image, item, alt) => {
  if (!image || !item?.url) return;
  image.src = item.url;
  image.alt = alt;
  image.referrerPolicy = 'no-referrer';
  image.loading = 'lazy';
  image.dataset.mediaEmpty = 'false';
  image.hidden = false;
};

const applyImages = () => {
  hideUnverifiedMedia();

  document.querySelectorAll('.lockbox-card').forEach((card) => {
    const name = clean(card.querySelector('h3')?.textContent || '');
    const item = media.get(keyFor('lockbox', name));
    const container = card.querySelector('.card-media');
    const image = container?.querySelector('img');
    const badge = container?.querySelector('.image-status');
    if (!item?.url || !container || !image) return;
    setRealImage(image, item, `${name} cover image`);
    container.dataset.mediaEmpty = 'false';
    if (badge) {
      badge.textContent = `Image: ${item.provider}`;
      badge.classList.add('source-found');
      badge.dataset.mediaEmpty = 'false';
    }
  });

  const detailName = clean(document.querySelector('#detail-title')?.textContent || '');
  const detailImage = document.querySelector('.detail-hero > img');
  const detailItem = media.get(keyFor('lockbox', detailName));
  if (detailName && detailImage && detailItem?.url) {
    setRealImage(detailImage, detailItem, `${detailName} cover image`);
  }

  document.querySelectorAll('.reward-row, .reward-item').forEach((row) => {
    const textNode = row.matches('.reward-item')
      ? row.querySelector('.reward-item-copy > span')
      : row.querySelector(':scope > span:last-child');
    const name = clean(textNode?.textContent || '');
    if (!name) return;

    const wrapper = row.querySelector('.reward-media');
    const existingImage = wrapper?.querySelector('img');
    const existingUrl = existingImage?.getAttribute('src') || '';
    const item = safeUrl(existingUrl)
      ? { url: existingUrl, provider: wrapper?.title?.replace(/^Thumbnail from\s*/i, '') || 'Community source' }
      : media.get(keyFor('reward', name));

    if (!wrapper || !item?.url) return;
    let image = existingImage;
    if (!image) {
      image = document.createElement('img');
      image.width = 64;
      image.height = 64;
      image.dataset.mediaImage = '';
      wrapper.prepend(image);
    }
    setRealImage(image, item, `${name} thumbnail`);
    wrapper.dataset.mediaEmpty = 'false';
    wrapper.classList.remove('reward-media-fallback-only', 'media-failed');
    wrapper.title = `Thumbnail from ${item.provider || 'community source'}`;
  });
};

const resolveVisibleMedia = async () => {
  if (running) return;
  running = true;
  try {
    hideUnverifiedMedia();
    const requests = collectRequests().filter((request) => !media.has(request.key));
    const fresh = requests.filter((request) => !searched.has(request.key));
    fresh.forEach((request) => searched.add(request.key));

    if (fresh.length) {
      const exact = await fetchExactPages(fresh);
      const unresolved = fresh.filter((request) => !exact.has(request.key) && !media.has(request.key));
      await runWithLimit(unresolved, 4, searchOne);
      saveCache();
    }

    applyImages();
  } finally {
    running = false;
  }
};

const scheduleResolve = () => {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    resolveVisibleMedia();
  }, 80);
};

injectNoPlaceholderStyles();
loadCache();
hideUnverifiedMedia();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleResolve, { once: true });
} else {
  scheduleResolve();
}

new MutationObserver(() => {
  hideUnverifiedMedia();
  scheduleResolve();
}).observe(document.documentElement, { childList: true, subtree: true });
