import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
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
const USER_AGENT = 'NeverwinterLockboxVault/1.0 (community reference media sync)';
const INVALID_IMAGE_PARTS = [
  'site-community-image',
  'community-header-background',
  'wordmark',
  'favicon',
];

const baseLockboxes = JSON.parse(await readFile(join(appRoot, 'data', 'lockboxes.json'), 'utf8'));
const entries = [...baseLockboxes, ...latestLockboxes];

const pause = (ms = 90) => new Promise((resolve) => setTimeout(resolve, ms));

const slugify = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const titleForLockbox = (entry) => String(entry?.name || '')
  .replace(/\s*\(CONSOLE ONLY\)\s*$/i, '')
  .trim();

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
    sourceUrl: page.fullurl || `https://neverwinter.fandom.com/wiki/${encodeURIComponent(String(page.title).replaceAll(' ', '_'))}`,
    provider: 'Neverwinter Wiki',
    matchedTitle: page.title,
  };
};

const searchWiki = async (title) => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'search',
    srsearch: title,
    srlimit: '4',
    srnamespace: '0',
    origin: '*',
  });

  const response = await fetchWithTimeout(`${WIKI_API}?${params}`, { accept: 'application/json' });
  if (!response.ok) return null;
  const payload = await response.json();
  const candidates = payload?.query?.search || [];
  const target = normalizeMediaKey(title);

  candidates.sort((a, b) => {
    const aKey = normalizeMediaKey(a.title);
    const bKey = normalizeMediaKey(b.title);
    return Number(bKey === target) - Number(aKey === target);
  });

  for (const candidate of candidates) {
    const media = await queryWikiPage(candidate.title);
    if (media) return media;
    await pause(40);
  }
  return null;
};

const resolveWikiMedia = async (title) => {
  try {
    const exact = await queryWikiPage(title);
    if (exact) return exact;
    await pause(60);
    return await searchWiki(title);
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
      if (isUsefulImageUrl(url)) return { url, sourceUrl: pageUrl, provider };
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
  if (width < 48 || height < 48) throw new Error(`image is too small (${width}x${height})`);

  const ratio = width / height;
  const squareLike = ratio > 0.78 && ratio < 1.28;
  let pipeline = source;

  if (kind === 'reward') {
    pipeline = pipeline
      .trim({ threshold: 8 })
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      });
  } else if (squareLike) {
    pipeline = pipeline
      .trim({ threshold: 6 })
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
  let media = await resolveWikiMedia(title);
  await pause();

  if (!media && entry.imageDiscovery?.pageUrl) {
    media = await resolvePageImage(entry.imageDiscovery.pageUrl, entry.imageDiscovery.provider || 'Official Neverwinter');
  }
  if (!media && entry.sourceUrl) {
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
  let media = resolveRewardMedia(type, rawName);
  if (!media?.url?.startsWith('https://')) media = null;

  if (!media) {
    media = await resolveWikiMedia(name);
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

  const key = normalizeMediaKey(name);
  result.items[type][key] = {
    name,
    url: `/assets/rewards/${type}/${fileSlug}.webp`,
    sourceUrl: media.sourceUrl,
    provider: media.provider,
    matchedTitle: media.matchedTitle || media.canonicalName || name,
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
