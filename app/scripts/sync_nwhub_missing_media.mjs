import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import latestLockboxes from '../data/latest-lockboxes.js';
import localMedia from '../data/local-media.js';
import nwhubMedia from '../data/nwhub-media.js';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const publicRoot = join(appRoot, 'public');
const lockboxRoot = join(publicRoot, 'assets', 'lockboxes');
const rewardRoot = join(publicRoot, 'assets', 'rewards');
const localMediaPath = join(appRoot, 'data', 'local-media.js');
const reportPath = join(appRoot, 'data', 'media-sync-report.json');
const SOURCE_URL = nwhubMedia.source || 'https://nw-hub.com/packs';

const baseLockboxes = JSON.parse(await readFile(join(appRoot, 'data', 'lockboxes.json'), 'utf8'));
const entries = [...baseLockboxes, ...latestLockboxes];

const cleanRewardName = (value = '') => {
  const text = String(value);
  const accountMatch = text.match(/^\[(.+)]\s*-\s*Account unlock$/i);
  return (accountMatch?.[1] || text)
    .replace(/^\s*(?:companion|artifact|mount|race)\s*:\s*/i, '')
    .replace(/\s+\((?:Epic|Rare)\)$/i, '')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeMediaKey = (value = '') => cleanRewardName(value)
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const slugify = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const clone = (value) => JSON.parse(JSON.stringify(value));
const merged = clone(localMedia || {});
merged.items ||= {};
for (const type of ['lockbox', 'companion', 'mount', 'artifact', 'race']) merged.items[type] ||= {};

const fetchImage = async (url) => {
  if (!/^https:\/\//i.test(String(url || ''))) throw new Error('NW Hub media URL is not HTTPS');
  const response = await fetch(url, {
    headers: {
      accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5',
      referer: SOURCE_URL,
      'user-agent': 'Mozilla/5.0 NeverwinterLockboxVault/1.0',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`image request returned ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`unexpected content type ${contentType || 'unknown'}`);
  return Buffer.from(await response.arrayBuffer());
};

const normalizeImage = async (buffer, outputPath, size) => {
  const image = sharp(buffer, { animated: false }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width < 24 || height < 24) throw new Error(`image is too small (${width}x${height})`);

  await mkdir(dirname(outputPath), { recursive: true });
  await image
    .trim({ threshold: 5 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .webp({ quality: 90, effort: 5 })
    .toFile(outputPath);
};

const additions = [];

for (const entry of entries) {
  if (merged.items.lockbox[entry.slug]?.url) continue;
  const remote = nwhubMedia?.items?.lockbox?.[entry.slug];
  if (!remote?.url) continue;

  try {
    const outputPath = join(lockboxRoot, `${entry.slug}.webp`);
    await normalizeImage(await fetchImage(remote.url), outputPath, 512);
    merged.items.lockbox[entry.slug] = {
      name: entry.name,
      url: `/assets/lockboxes/${entry.slug}.webp`,
      sourceUrl: remote.sourceUrl || SOURCE_URL,
      provider: 'NW Hub',
      matchedTitle: remote.name || entry.name,
      matchScore: remote.matchScore,
      matchContext: remote.matchContext,
    };
    additions.push({ type: 'lockbox', key: entry.slug, name: entry.name, remoteUrl: remote.url });
    console.log(`NW Hub lockbox: ${entry.name}`);
  } catch (error) {
    console.warn(`NW Hub lockbox failed: ${entry.name}: ${error.message}`);
  }
}

const rewards = new Map();
for (const entry of entries) {
  for (const [type, plural] of [
    ['companion', 'companions'],
    ['mount', 'mounts'],
    ['artifact', 'artifacts'],
    ['race', 'races'],
  ]) {
    for (const rawName of entry.rewards?.[plural] || []) {
      const name = cleanRewardName(rawName);
      if (!name) continue;
      const key = normalizeMediaKey(name);
      rewards.set(`${type}:${key}`, { type, name, key });
    }
  }
}

for (const { type, name, key } of rewards.values()) {
  if (merged.items[type]?.[key]?.url) continue;
  const remote = nwhubMedia?.items?.[type]?.[key];
  if (!remote?.url) continue;

  try {
    const outputPath = join(rewardRoot, type, `${slugify(name)}.webp`);
    await normalizeImage(await fetchImage(remote.url), outputPath, 256);
    merged.items[type][key] = {
      name,
      url: `/assets/rewards/${type}/${slugify(name)}.webp`,
      sourceUrl: remote.sourceUrl || SOURCE_URL,
      provider: 'NW Hub',
      matchedTitle: remote.name || name,
      matchScore: remote.matchScore,
      matchContext: remote.matchContext,
    };
    additions.push({ type, key, name, remoteUrl: remote.url });
    console.log(`NW Hub ${type}: ${name}`);
  } catch (error) {
    console.warn(`NW Hub ${type} failed: ${name}: ${error.message}`);
  }
}

const generatedAt = new Date().toISOString();
const lockboxesResolved = entries.filter((entry) => merged.items.lockbox[entry.slug]?.url).length;
const rewardsResolved = [...rewards.values()].filter(({ type, key }) => merged.items[type]?.[key]?.url).length;
const unresolved = (entries.length - lockboxesResolved) + (rewards.size - rewardsResolved);

merged.generatedAt = generatedAt;
merged.stats = {
  lockboxesResolved,
  rewardsResolved,
  unresolved,
  nwhubAdded: additions.length,
  nwhubLockboxesAdded: additions.filter((item) => item.type === 'lockbox').length,
  nwhubRewardsAdded: additions.filter((item) => item.type !== 'lockbox').length,
};

const report = {
  generatedAt,
  nwhubSource: SOURCE_URL,
  nwhubAdditions: additions,
  lockboxes: { resolved: [], unresolved: [] },
  rewards: { resolved: [], unresolved: [] },
};

for (const entry of entries) {
  const media = merged.items.lockbox[entry.slug];
  if (media?.url) report.lockboxes.resolved.push({ slug: entry.slug, name: entry.name, ...media });
  else report.lockboxes.unresolved.push({ resolved: false, slug: entry.slug, name: entry.name });
}

for (const { type, name, key } of rewards.values()) {
  const media = merged.items[type]?.[key];
  if (media?.url) report.rewards.resolved.push({ type, name, ...media });
  else report.rewards.unresolved.push({ resolved: false, type, name });
}

await writeFile(localMediaPath, `export default ${JSON.stringify(merged, null, 2)};\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log('NW Hub missing-media sync complete');
console.log(JSON.stringify(merged.stats, null, 2));
