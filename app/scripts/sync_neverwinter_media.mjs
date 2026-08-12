import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import latestLockboxes from '../data/latest-lockboxes.js';
import {
  cleanRewardName,
  normalizeMediaKey,
  resolveRewardMedia,
} from '../media.js';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const publicRoot = join(appRoot, 'public');
const assetsRoot = join(publicRoot, 'assets');
const lockboxRoot = join(assetsRoot, 'lockboxes');
const rewardRoot = join(assetsRoot, 'rewards');
const localMediaPath = join(appRoot, 'data', 'local-media.js');
const reportPath = join(appRoot, 'data', 'media-sync-report.json');
const force = process.argv.includes('--force');

const WIKI_API = 'https://neverwinter.fandom.com/api.php';
const WIKI_ROOT = 'https://neverwinter.fandom.com/wiki/';
const USER_AGENT = 'NeverwinterLockboxVault/1.0 (community reference media sync)';
const INVALID_IMAGE_PARTS = [
  'site-community-image',
  'community-header-background',
  'wordmark',
  'favicon',
  'achievement',
  'banner',
  'background',
];
const GENERIC_WORDS = new Set([
  'the', 'of', 'and', 'a', 'an', 'icon', 'inventory', 'item', 'items', 'image',
  'legendary', 'epic', 'rare', 'mythic', 'celestial', 'account', 'unlock',
]);

const CURATED_MEDIA = {
  lockbox: {
    'encroaching-frost-lockbox': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/0cf31c2a9f5630947b145c880942cf2b5c15556a.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Encroaching Frost Lockbox',
    },
    'buried-treasure-lockbox': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/04dd6188f6780cec8c38f93cfbc2ac1371299f62.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Buried Treasure Lockbox / Ollie the Octie',
    },
  },
  mount: {
    'snowtusk': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/510e63fa1426729787d6aa5b94b1eefa2b9ebb65.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Snowtusk',
    },
    'ollie the octie': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/04dd6188f6780cec8c38f93cfbc2ac1371299f62.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Ollie the Octie',
    },
  },
  companion: {
    'sir waddlelot': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/d5cca260252483ddc015ed957da4f39eedf00c98.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Sir Waddlelot',
    },
  },
  artifact: {
    'combat enchantments choice pack': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/8613e28a901eaca19aadd9bf31849289f8949ee6.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Combat Enchantments Choice Pack',
    },
    'shifting shards': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/8613e28a901eaca19aadd9bf31849289f8949ee6.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Shifting Shards',
    },
    'fluid aurora': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/8613e28a901eaca19aadd9bf31849289f8949ee6.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Fluid Aurora',
    },
    'shattered resolve': {
      url: 'https://clan.fastly.steamstatic.com/images/4459454/8613e28a901eaca19aadd9bf31849289f8949ee6.png',
      sourceUrl: 'https://steamcommunity.com/app/109600/announcements/',
      provider: 'Official Neverwinter / Steam',
      matchedTitle: 'Shattered Resolve',
    },
  },
};

const baseLockboxes = JSON.parse(await readFile(join(appRoot, 'data', 'lockboxes.json'), 'utf8'));
const entries = [...baseLockboxes, ...latestLockboxes];

const pause = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));

const slugify = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const titleForLockbox = (entry) => String(entry?.name || '')
  .replace(/\s*\(CONSOLE ONLY\)\s*$/i, '')
  .trim();

const cleanComparable = (value = '') => normalizeMediaKey(String(value)
  .replace(/\.[a-z0-9]{2,5}$/i, '')
  .replace(/^(file|icon|inventory|item)[_\s:-]+/i, '')
  .replace(/[_-]+/g, ' '));

const semanticTokens = (value = '') => cleanComparable(value)
  .split(' ')
  .filter((token) => token.length > 1 && !GENERIC_WORDS.has(token));

const similarity = (target, candidate) => {
  const targetKey = cleanComparable(target);
  const candidateKey = cleanComparable(candidate);
  if (!targetKey || !candidateKey) return 0;
  if (targetKey === candidateKey) return 1;

  const targetTokens = semanticTokens(target);
  const candidateTokens = new Set(semanticTokens(candidate));
  if (!targetTokens.length) return 0;
  const shared = targetTokens.filter((token) => candidateTokens.has(token)).length;
  const coverage = shared / targetTokens.length;

  if (candidateKey.includes(targetKey) || targetKey.includes(candidateKey)) {
    return Math.max(coverage, 0.88);
  }
  return coverage;
};

const fileExists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const fetchWithTimeout = async (url, options = {}) => fetch(url, {
  ...options,
  headers: {
    'user-agent': USER_AGENT,
    accept: options.accept || '*/*',
    ...(options.headers || {}),
  },
  signal: AbortSignal.timeout(25000),
});

const isUsefulImageUrl = (value) => {
  if (!/^https:\/\//i.test(String(value || ''))) return false;
  const lower = value.toLowerCase();
  return !INVALID_IMAGE_PARTS.some((part) => lower.includes(part));
};

const wikiPageUrl = (title) => `${WIKI_ROOT}${encodeURIComponent(String(title).replaceAll(' ', '_'))}`;

const queryWikiPage = async (title) => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'pageimages|info',
    piprop: 'thumbnail|original',
    pithumbsize: '900',
    inprop: 'url',
    origin: '*',
    titles: title,
  });

  const response = await fetchWithTimeout(`${WIKI_API}?${params}`, { accept: 'application/json' });
  if (!response.ok) return null;
  const payload = await response.json();
  const page = payload?.query?.pages?.[0];
  if (!page || page.missing) return null;
  const url = page.thumbnail?.source || page.original?.source;
  if (!isUsefulImageUrl(url)) return null;

  return {
    url,
    sourceUrl: page.fullurl || wikiPageUrl(page.title || title),
    provider: 'Neverwinter Wiki',
    matchedTitle: page.title || title,
    match: 'pageimage',
  };
};

const queryWikiFileInfo = async (filename, title) => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '900',
    origin: '*',
    titles: `File:${filename}`,
  });
  const response = await fetchWithTimeout(`${WIKI_API}?${params}`, { accept: 'application/json' });
  if (!response.ok) return null;
  const payload = await response.json();
  const page = payload?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  const url = info?.thumburl || info?.url;
  if (!isUsefulImageUrl(url) || (info?.mime && !String(info.mime).startsWith('image/'))) return null;
  return {
    url,
    sourceUrl: wikiPageUrl(title),
    provider: 'Neverwinter Wiki',
    matchedTitle: title,
    matchedFile: filename,
    match: 'page-file',
  };
};

const queryWikiPageFiles = async (title, kind = 'reward') => {
  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'images',
    origin: '*',
    page: title,
  });

  const response = await fetchWithTimeout(`${WIKI_API}?${params}`, { accept: 'application/json' });
  if (!response.ok) return null;
  const payload = await response.json();
  const files = payload?.parse?.images || [];
  if (!files.length) return null;

  const targetTokens = semanticTokens(title);
  const scored = files
    .map((filename) => {
      const lower = filename.toLowerCase();
      if (INVALID_IMAGE_PARTS.some((part) => lower.includes(part))) return { filename, score: -1 };
      const fileKey = cleanComparable(filename);
      const score = similarity(title, filename)
        + (kind === 'lockbox' && fileKey.includes('lockbox') ? 0.24 : 0)
        + (targetTokens.every((token) => fileKey.includes(token)) ? 0.12 : 0);
      return { filename, score };
    })
    .filter(({ score }) => score >= (kind === 'lockbox' ? 0.72 : 0.78))
    .sort((a, b) => b.score - a.score);

  for (const candidate of scored.slice(0, 3)) {
    const media = await queryWikiFileInfo(candidate.filename, payload.parse?.title || title);
    if (media) return media;
    await pause(35);
  }
  return null;
};

const searchWiki = async (title, kind = 'reward') => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'search',
    srsearch: `"${title}"`,
    srlimit: '6',
    srnamespace: '0',
    origin: '*',
  });

  const response = await fetchWithTimeout(`${WIKI_API}?${params}`, { accept: 'application/json' });
  if (!response.ok) return null;
  const payload = await response.json();
  const candidates = (payload?.query?.search || [])
    .map((candidate) => ({ ...candidate, score: similarity(title, candidate.title) }))
    .filter((candidate) => candidate.score >= 0.84 && !candidate.title.includes('/'))
    .sort((a, b) => b.score - a.score);

  for (const candidate of candidates.slice(0, 3)) {
    const pageImage = await queryWikiPage(candidate.title);
    if (pageImage) return pageImage;
    const fileImage = await queryWikiPageFiles(candidate.title, kind);
    if (fileImage) return fileImage;
    await pause(40);
  }
  return null;
};

const resolveWikiMedia = async (title, kind = 'reward') => {
  try {
    const exact = await queryWikiPage(title);
    if (exact) return exact;
    const exactFile = await queryWikiPageFiles(title, kind);
    if (exactFile) return exactFile;
    await pause(45);
    return await searchWiki(title, kind);
  } catch (error) {
    console.warn(`Wiki lookup failed for ${title}: ${error.message}`);
    return null;
  }
};

const decodeHtml = (value = '') => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

const resolvePageImage = async (pageUrl, provider = 'Official Neverwinter') => {
  if (!/^https:\/\//i.test(String(pageUrl || ''))) return null;
  try {
    const response = await fetchWithTimeout(pageUrl, { accept: 'text/html,*/*;q=0.8' });
    if (!response.ok) return null;
    const html = await response.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      const url = decodeHtml(match?.[1] || '');
      if (isUsefulImageUrl(url)) return { url, sourceUrl: pageUrl, provider, matchedTitle: pageUrl };
    }
  } catch (error) {
    console.warn(`Page image lookup failed for ${pageUrl}: ${error.message}`);
  }
  return null;
};

const imageBuffer = async (url) => {
  const response = await fetchWithTimeout(url, { accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5' });
  if (!response.ok) throw new Error(`image request returned ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`unexpected content type ${contentType || 'unknown'}`);
  return Buffer.from(await response.arrayBuffer());
};

const normalizeImage = async (buffer, outputPath, kind) => {
  const source = sharp(buffer, { animated: false }).rotate();
  const metadata = await source.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width < 24 || height < 24) throw new Error(`image is too small (${width}x${height})`);

  const ratio = width / height;
  const squareLike = ratio > 0.78 && ratio < 1.28;
  let pipeline = source;

  if (kind === 'reward') {
    pipeline = pipeline
      .trim({ threshold: 6 })
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      });
  } else if (squareLike) {
    pipeline = pipeline
      .trim({ threshold: 5 })
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 11, g: 13, b: 16, alpha: 1 },
        withoutEnlargement: false,
      });
  } else {
    pipeline = pipeline.resize(512, 512, {
      fit: 'cover',
      position: sharp.strategy.attention,
      withoutEnlargement: false,
    });
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await pipeline.webp({ quality: 88, effort: 5 }).toFile(outputPath);
};

const saveResolvedMedia = async ({ media, outputPath, kind }) => {
  if (!force && await fileExists(outputPath)) return true;
  try {
    const buffer = await imageBuffer(media.url);
    await normalizeImage(buffer, outputPath, kind);
    return true;
  } catch (error) {
    console.warn(`Could not save ${relative(appRoot, outputPath)} from ${media.url}: ${error.message}`);
    return false;
  }
};

await rm(lockboxRoot, { recursive: true, force: true });
await rm(rewardRoot, { recursive: true, force: true });
await mkdir(lockboxRoot, { recursive: true });
await mkdir(rewardRoot, { recursive: true });

const result = {
  generatedAt: new Date().toISOString(),
  stats: {
    lockboxesResolved: 0,
    rewardsResolved: 0,
    unresolved: 0,
  },
  items: {
    lockbox: {},
    companion: {},
    mount: {},
    artifact: {},
    race: {},
  },
};

const report = {
  generatedAt: result.generatedAt,
  lockboxes: { resolved: [], unresolved: [] },
  rewards: { resolved: [], unresolved: [] },
};

for (const entry of entries) {
  const title = titleForLockbox(entry);
  let media = CURATED_MEDIA.lockbox[entry.slug] || await resolveWikiMedia(title, 'lockbox');
  await pause();

  const discoveryPage = entry.imageDiscovery?.pageUrl;
  const discoveryIsSpecific = discoveryPage && !/\/announcements\/?$/i.test(discoveryPage);
  if (!media && discoveryIsSpecific) {
    media = await resolvePageImage(discoveryPage, entry.imageDiscovery.provider || 'Official Neverwinter');
  }
  const sourceIsSpecific = entry.sourceUrl && !/\/announcements\/?$/i.test(entry.sourceUrl);
  if (!media && sourceIsSpecific) {
    media = await resolvePageImage(entry.sourceUrl, entry.sourceLabel || 'Neverwinter source');
  }

  if (!media) {
    result.stats.unresolved += 1;
    report.lockboxes.unresolved.push({ slug: entry.slug, name: entry.name });
    console.log(`lockbox unresolved: ${entry.name}`);
    continue;
  }

  const outputPath = join(lockboxRoot, `${entry.slug}.webp`);
  const saved = await saveResolvedMedia({ media, outputPath, kind: 'lockbox' });
  if (!saved) {
    result.stats.unresolved += 1;
    report.lockboxes.unresolved.push({ slug: entry.slug, name: entry.name, sourceUrl: media.sourceUrl });
    continue;
  }

  result.items.lockbox[entry.slug] = {
    url: `/assets/lockboxes/${entry.slug}.webp`,
    sourceUrl: media.sourceUrl,
    provider: media.provider,
    matchedTitle: media.matchedTitle || title,
    matchedFile: media.matchedFile,
  };
  result.stats.lockboxesResolved += 1;
  report.lockboxes.resolved.push({ slug: entry.slug, name: entry.name, ...result.items.lockbox[entry.slug] });
  console.log(`lockbox ${result.stats.lockboxesResolved}/${entries.length}: ${entry.name}`);
}

const rewardGroups = new Map();
for (const entry of entries) {
  for (const type of ['companion', 'mount', 'artifact', 'race']) {
    const plural = `${type}s`;
    for (const rawName of entry.rewards?.[plural] || []) {
      const name = cleanRewardName(rawName);
      if (!name) continue;
      rewardGroups.set(`${type}:${normalizeMediaKey(name)}`, { type, name, rawName });
    }
  }
}

let rewardIndex = 0;
for (const { type, name, rawName } of rewardGroups.values()) {
  rewardIndex += 1;
  const key = normalizeMediaKey(name);
  let media = CURATED_MEDIA[type]?.[key] || resolveRewardMedia(type, rawName);
  if (!media?.url?.startsWith('https://')) media = CURATED_MEDIA[type]?.[key] || null;

  if (!media) {
    media = await resolveWikiMedia(name, 'reward');
    await pause();
  }

  if (!media) {
    result.stats.unresolved += 1;
    report.rewards.unresolved.push({ type, name });
    console.log(`reward unresolved: ${type} / ${name}`);
    continue;
  }

  const fileSlug = slugify(name) || `item-${rewardIndex}`;
  const outputPath = join(rewardRoot, type, `${fileSlug}.webp`);
  const saved = await saveResolvedMedia({ media, outputPath, kind: 'reward' });
  if (!saved) {
    result.stats.unresolved += 1;
    report.rewards.unresolved.push({ type, name, sourceUrl: media.sourceUrl });
    continue;
  }

  result.items[type][key] = {
    name,
    url: `/assets/rewards/${type}/${fileSlug}.webp`,
    sourceUrl: media.sourceUrl,
    provider: media.provider,
    matchedTitle: media.matchedTitle || media.canonicalName || name,
    matchedFile: media.matchedFile,
  };
  result.stats.rewardsResolved += 1;
  report.rewards.resolved.push({ type, name, ...result.items[type][key] });
  console.log(`reward ${rewardIndex}/${rewardGroups.size}: ${type} / ${name}`);
}

const moduleText = `export default ${JSON.stringify(result, null, 2)};\n`;
await writeFile(localMediaPath, moduleText);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log('\nMedia sync complete');
console.log(JSON.stringify(result.stats, null, 2));
