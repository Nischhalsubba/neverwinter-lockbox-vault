import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import latestLockboxes from '../data/latest-lockboxes.js';

const ROOT = process.cwd();
const SOURCE_URL = 'https://nw-hub.com/packs';
const RAW_OUTPUT = path.join(ROOT, 'data', 'nwhub-assets.json');
const MAP_OUTPUT = path.join(ROOT, 'data', 'nwhub-media.js');

const baseLockboxes = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'lockboxes.json'), 'utf8'));
const lockboxes = [...baseLockboxes, ...latestLockboxes];

const cleanName = (value = '') => String(value)
  .replace(/^\[(.+)]\s*-\s*Account unlock$/i, '$1')
  .replace(/\s+\((?:Epic|Rare)\)$/i, '')
  .replace(/\s*\(CONSOLE ONLY\)\s*$/i, '')
  .replace(/[’]/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const normalize = (value = '') => cleanName(value)
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const targets = [];
for (const entry of lockboxes) {
  targets.push({ type: 'lockbox', key: entry.slug, name: cleanName(entry.name) });
  for (const [type, plural] of [
    ['companion', 'companions'],
    ['mount', 'mounts'],
    ['artifact', 'artifacts'],
    ['race', 'races'],
  ]) {
    for (const rawName of entry.rewards?.[plural] || []) {
      const name = cleanName(rawName);
      if (name) targets.push({ type, key: normalize(name), name });
    }
  }
}
const uniqueTargets = [...new Map(targets.map((target) => [`${target.type}:${target.key}`, target])).values()];

const safeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
});
const page = await context.newPage();
const networkImages = new Map();

page.on('response', (response) => {
  const url = safeHttpUrl(response.url());
  if (!url) return;
  const contentType = response.headers()['content-type'] || '';
  if (!contentType.startsWith('image/') && !/\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?|$)/i.test(url)) return;
  networkImages.set(url, { url, kind: 'network', viewLabel: 'network', contentType, status: response.status() });
});

const scrollToEnd = async () => {
  let previousHeight = 0;
  let stable = 0;
  for (let attempt = 0; attempt < 18 && stable < 3; attempt += 1) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate((target) => window.scrollTo(0, target), height);
    await page.waitForTimeout(300);
    stable = height === previousHeight ? stable + 1 : 0;
    previousHeight = height;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
};

const collectDomAssets = (viewLabel) => page.evaluate((label) => {
  const textOf = (node) => String(node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
  const absolute = (value) => {
    try { return new URL(value, window.location.href).href; } catch { return null; }
  };

  const nearby = (element) => {
    const ancestors = [];
    let current = element.parentElement;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      const text = textOf(current);
      const imageCount = current.querySelectorAll?.('img,source')?.length || 0;
      if (text && text.length <= 800) ancestors.push({ depth, text, imageCount });
    }
    const nearest = ancestors.find((item) => item.imageCount <= 1 && item.text.length <= 240)
      || ancestors.find((item) => item.text.length <= 240)
      || ancestors[0]
      || null;
    return {
      nearestText: nearest?.text || '',
      parentText: textOf(element.parentElement).slice(0, 420),
      siblingText: [textOf(element.previousElementSibling), textOf(element.nextElementSibling)].filter(Boolean).join(' | ').slice(0, 320),
      ancestors,
    };
  };

  const output = [];
  const push = (element, rawUrl, kind) => {
    const url = absolute(rawUrl);
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    const rect = element.getBoundingClientRect();
    output.push({
      url,
      kind,
      viewLabel: label,
      alt: element.getAttribute?.('alt') || '',
      title: element.getAttribute?.('title') || '',
      ariaLabel: element.getAttribute?.('aria-label') || '',
      width: Math.round(rect.width || element.naturalWidth || 0),
      height: Math.round(rect.height || element.naturalHeight || 0),
      naturalWidth: element.naturalWidth || 0,
      naturalHeight: element.naturalHeight || 0,
      ...nearby(element),
    });
  };

  document.querySelectorAll('img').forEach((image) => push(image, image.currentSrc || image.src, 'img'));
  document.querySelectorAll('source[srcset]').forEach((source) => {
    const url = String(source.srcset).split(',')[0]?.trim().split(/\s+/)[0];
    push(source, url, 'source');
  });
  document.querySelectorAll('*').forEach((element) => {
    const background = getComputedStyle(element).backgroundImage;
    if (!background || background === 'none') return;
    for (const match of background.matchAll(/url\(["']?(.*?)["']?\)/g)) push(element, match[1], 'background');
  });
  return output;
}, viewLabel);

const assets = [];
const capture = async (label) => {
  await scrollToEnd();
  assets.push(...await collectDomAssets(label));
};

const words = (value) => normalize(value)
  .split(' ')
  .filter((word) => word.length > 2 && !['the', 'and', 'pack', 'account', 'unlock'].includes(word));

const filenameText = (url) => {
  try { return normalize(decodeURIComponent(new URL(url).pathname.split('/').pop() || '')); }
  catch { return ''; }
};

const scoreAsset = (target, asset) => {
  const targetText = normalize(target.name);
  const fields = [
    normalize(asset.alt),
    normalize(asset.title),
    normalize(asset.ariaLabel),
    normalize(asset.nearestText),
    normalize(asset.siblingText),
  ].filter(Boolean);
  const filename = filenameText(asset.url);
  const targetWords = words(target.name);
  let score = 0;
  let direct = false;

  for (const field of fields.slice(0, 3)) {
    if (field === targetText) { score = Math.max(score, 330); direct = true; }
    else if (field.includes(targetText) || targetText.includes(field)) { score = Math.max(score, 260); direct = true; }
  }

  if (filename === targetText) { score = Math.max(score, 315); direct = true; }
  if (targetWords.length && targetWords.every((word) => filename.includes(word))) {
    score = Math.max(score, targetWords.length > 1 ? 250 : 190);
    direct = true;
  }

  const nearest = normalize(asset.nearestText);
  const sibling = normalize(asset.siblingText);
  const parent = normalize(asset.parentText);
  if (nearest === targetText) score = Math.max(score, 295);
  else if (nearest.includes(targetText) && targetText.length >= 5) score = Math.max(score, nearest.length <= 180 ? 245 : 190);
  if (sibling === targetText) score = Math.max(score, 275);
  else if (sibling.includes(targetText) && targetText.length >= 5) score = Math.max(score, 225);
  if (parent.includes(targetText) && targetText.length >= 5) score = Math.max(score, parent.length <= 180 ? 205 : 165);

  const combined = `${fields.join(' ')} ${filename}`;
  if (targetWords.length > 1 && targetWords.every((word) => combined.includes(word))) score = Math.max(score, 195);

  const width = asset.width || asset.naturalWidth || 0;
  const height = asset.height || asset.naturalHeight || 0;
  const ratio = width && height ? width / height : 1;
  if (ratio >= 0.72 && ratio <= 1.38) score += 25;
  if (ratio > 2 || ratio < 0.5) score -= 70;
  if (width >= 32 && height >= 32 && width <= 360 && height <= 360) score += 15;
  if (normalize(asset.viewLabel).includes(target.type)) score += 18;
  if (target.type === 'lockbox' && filename.includes('lockbox')) score += 20;
  if (/logo|favicon|avatar|brand|wordmark|header|background/i.test(asset.url)) score -= 130;
  if (!direct && score < 185) score -= 35;
  return score;
};

try {
  await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 35_000 }).catch(() => {});

  for (const label of ['Accept', 'Accept all', 'Allow all', 'I agree']) {
    const consent = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
    if (await consent.count()) {
      await consent.first().click({ timeout: 2_000 }).catch(() => {});
      break;
    }
  }

  await capture('all');

  const visited = [];
  for (const label of ['Packs', 'Lockboxes', 'Companions', 'Mounts', 'Artifacts', 'Races', 'Items', 'Enchantments', 'Rewards', 'Special']) {
    const exact = new RegExp(`^\\s*${label}\\s*$`, 'i');
    const control = page.locator('button, [role="tab"], a').filter({ hasText: exact });
    if (!await control.count()) continue;
    visited.push(label.toLowerCase());
    await control.first().click({ timeout: 2_500 }).catch(() => {});
    await page.waitForTimeout(500);
    await capture(label.toLowerCase());
  }

  const deduped = new Map();
  for (const asset of [...assets, ...networkImages.values()]) {
    const url = safeHttpUrl(asset.url);
    if (!url) continue;
    const key = [url, asset.nearestText || '', asset.siblingText || '', asset.viewLabel || ''].join('|');
    if (!deduped.has(key)) deduped.set(key, { ...asset, url });
  }
  const discovered = [...deduped.values()];

  const items = { lockbox: {}, companion: {}, mount: {}, artifact: {}, race: {} };
  const matches = [];
  for (const target of uniqueTargets) {
    let best = null;
    for (const asset of discovered) {
      const score = scoreAsset(target, asset);
      if (score < 180 || (best && score <= best.score)) continue;
      best = { asset, score };
    }
    if (!best) continue;
    items[target.type][target.key] = {
      name: target.name,
      url: best.asset.url,
      sourceUrl: SOURCE_URL,
      provider: 'NW Hub',
      matchScore: best.score,
      matchContext: best.asset.nearestText || best.asset.siblingText || best.asset.parentText || '',
      rightsNote: 'Image discovered on NW Hub; Neverwinter artwork rights remain with the respective rights holder.',
    };
    matches.push({ target, score: best.score, url: best.asset.url, context: items[target.type][target.key].matchContext });
  }

  const stats = {
    assetsDiscovered: discovered.length,
    targetsSearched: uniqueTargets.length,
    candidatesMatched: matches.length,
    lockboxesMatched: Object.keys(items.lockbox).length,
    rewardsMatched: matches.filter((match) => match.target.type !== 'lockbox').length,
  };
  const capturedAt = new Date().toISOString();

  await fs.writeFile(RAW_OUTPUT, `${JSON.stringify({
    source: SOURCE_URL,
    pageTitle: await page.title(),
    capturedAt,
    controlsVisited: visited,
    stats,
    matches,
    assets: discovered,
  }, null, 2)}\n`);
  await fs.writeFile(MAP_OUTPUT, `export default ${JSON.stringify({ source: SOURCE_URL, generatedAt: capturedAt, stats, items }, null, 2)};\n`);

  console.log(`NW Hub extraction complete: ${stats.assetsDiscovered} assets, ${stats.candidatesMatched}/${stats.targetsSearched} matched.`);
} finally {
  await browser.close();
}
