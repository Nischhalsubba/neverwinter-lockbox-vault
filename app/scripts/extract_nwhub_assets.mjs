import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const SOURCE_URL = 'https://nw-hub.com/packs';
const RAW_OUTPUT = path.join(ROOT, 'data', 'nwhub-assets.json');
const MAP_OUTPUT = path.join(ROOT, 'data', 'nwhub-media.js');

const lockboxes = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'lockboxes.json'), 'utf8'));

const normalize = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[’]/g, "'")
  .replace(/^\[(.+)]\s*-\s*Account unlock$/i, '$1')
  .replace(/\s+\((?:Epic|Rare)\)$/i, '')
  .replace(/\s*\(CONSOLE ONLY\)\s*$/i, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const slugify = (value = '') => normalize(value).replaceAll(' ', '-');
const cleanName = (value = '') => String(value)
  .replace(/^\[(.+)]\s*-\s*Account unlock$/i, '$1')
  .replace(/\s+\((?:Epic|Rare)\)$/i, '')
  .replace(/[’]/g, "'")
  .trim();

const safeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-dev-shm-usage', '--no-sandbox'],
});

const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
});
const page = await context.newPage();
const networkImages = new Map();

page.on('response', async (response) => {
  const url = safeHttpUrl(response.url());
  if (!url) return;
  const headers = response.headers();
  const contentType = headers['content-type'] || '';
  if (contentType.startsWith('image/') || /\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?|$)/i.test(url)) {
    networkImages.set(url, {
      url,
      source: 'network',
      contentType,
      status: response.status(),
    });
  }
});

const scrollToEnd = async () => {
  let stable = 0;
  let previousHeight = 0;
  for (let attempt = 0; attempt < 36 && stable < 4; attempt += 1) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate((target) => window.scrollTo({ top: target, behavior: 'instant' }), height);
    await page.waitForTimeout(500);
    if (height === previousHeight) stable += 1;
    else stable = 0;
    previousHeight = height;
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
};

const collectDomAssets = async (viewLabel) => page.evaluate((label) => {
  const absolute = (value) => {
    try { return new URL(value, window.location.href).href; } catch { return null; }
  };
  const textOf = (node) => String(node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
  const contextFor = (element) => {
    const ancestors = [];
    let current = element;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const text = textOf(current);
      if (text && text.length <= 1400) {
        ancestors.push({ depth, text, imageCount: current.querySelectorAll?.('img,source')?.length || 0 });
      }
    }
    const nearest = ancestors.find((item) => item.text.length <= 300) || ancestors[0] || null;
    const previous = textOf(element.previousElementSibling);
    const next = textOf(element.nextElementSibling);
    const parent = textOf(element.parentElement);
    return {
      nearestText: nearest?.text || '',
      parentText: parent.length <= 500 ? parent : '',
      siblingText: [previous, next].filter(Boolean).join(' | ').slice(0, 500),
      ancestors,
    };
  };
  const entries = [];
  const push = (element, rawUrl, kind, extra = {}) => {
    const url = absolute(rawUrl);
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    const rect = element.getBoundingClientRect();
    entries.push({
      url,
      kind,
      viewLabel: label,
      alt: element.getAttribute?.('alt') || '',
      title: element.getAttribute?.('title') || '',
      ariaLabel: element.getAttribute?.('aria-label') || '',
      width: Math.round(rect.width || element.naturalWidth || 0),
      height: Math.round(rect.height || element.naturalHeight || 0),
      ...contextFor(element),
      ...extra,
    });
  };

  document.querySelectorAll('img').forEach((image) => {
    push(image, image.currentSrc || image.src, 'img', { srcset: image.srcset || '' });
  });
  document.querySelectorAll('source[srcset]').forEach((source) => {
    const first = String(source.srcset).split(',')[0]?.trim().split(/\s+/)[0];
    push(source, first, 'source', { srcset: source.srcset || '' });
  });
  document.querySelectorAll('*').forEach((element) => {
    const background = getComputedStyle(element).backgroundImage;
    if (!background || background === 'none') return;
    for (const match of background.matchAll(/url\(["']?(.*?)["']?\)/g)) {
      push(element, match[1], 'background');
    }
  });
  return entries;
}, viewLabel);

const allAssets = [];
const capture = async (label) => {
  await scrollToEnd();
  allAssets.push(...await collectDomAssets(label));
};

try {
  await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});

  for (const label of ['Accept', 'Accept all', 'Allow all', 'I agree']) {
    const button = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
    if (await button.count()) {
      await button.first().click({ timeout: 2_000 }).catch(() => {});
      break;
    }
  }

  await capture('initial');

  const categoryPattern = /^(all|packs?|lockboxes?|companions?|mounts?|artifacts?|races?)$/i;
  const controls = page.locator('button, [role="tab"], a');
  const controlCount = Math.min(await controls.count(), 250);
  const visitedLabels = new Set();
  for (let index = 0; index < controlCount; index += 1) {
    const control = controls.nth(index);
    const text = String(await control.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!categoryPattern.test(text) || visitedLabels.has(text.toLowerCase())) continue;
    visitedLabels.add(text.toLowerCase());
    await control.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await capture(text.toLowerCase());
  }

  const deduped = new Map();
  for (const asset of allAssets) {
    const url = safeHttpUrl(asset.url);
    if (!url) continue;
    const key = [url, asset.nearestText, asset.parentText, asset.siblingText].join('|');
    if (!deduped.has(key)) deduped.set(key, { ...asset, url });
  }
  for (const network of networkImages.values()) {
    const key = [network.url, '', '', ''].join('|');
    if (!deduped.has(key)) deduped.set(key, network);
  }

  const assets = [...deduped.values()];
  const candidateList = [];
  for (const entry of lockboxes) {
    candidateList.push({ type: 'lockbox', key: entry.slug, name: entry.name.replace(/\s*\(CONSOLE ONLY\)\s*$/i, '') });
    const groups = [
      ['companion', entry.rewards?.companions || []],
      ['artifact', entry.rewards?.artifacts || []],
      ['mount', entry.rewards?.mounts || []],
      ['race', entry.rewards?.races || []],
    ];
    for (const [type, values] of groups) {
      for (const rawName of values) {
        const name = cleanName(rawName);
        if (name) candidateList.push({ type, key: normalize(name), name });
      }
    }
  }

  const uniqueCandidates = [...new Map(candidateList.map((item) => [`${item.type}:${item.key}`, item])).values()];
  const items = { lockbox: {}, companion: {}, mount: {}, artifact: {}, race: {} };

  const scoreAsset = (candidate, asset) => {
    const target = normalize(candidate.name);
    if (!target) return 0;
    const filename = normalize(decodeURIComponent(new URL(asset.url).pathname.split('/').pop() || ''));
    const compactTarget = slugify(candidate.name);
    const alt = normalize(asset.alt);
    const title = normalize(asset.title);
    const aria = normalize(asset.ariaLabel);
    const parent = normalize(asset.parentText);
    const sibling = normalize(asset.siblingText);
    const nearest = normalize(asset.nearestText);
    const ancestorTexts = (asset.ancestors || []).map((item) => normalize(item.text));
    let score = 0;
    if (alt === target) score = Math.max(score, 240);
    if (title === target || aria === target) score = Math.max(score, 230);
    if (parent === target || sibling === target) score = Math.max(score, 220);
    if (nearest === target) score = Math.max(score, 210);
    if (parent.includes(target) && target.length >= 5) score = Math.max(score, 190);
    if (sibling.includes(target) && target.length >= 5) score = Math.max(score, 185);
    if (nearest.includes(target) && target.length >= 5) score = Math.max(score, 170);
    const ancestorDepth = ancestorTexts.findIndex((text) => text.includes(target));
    if (ancestorDepth >= 0) score = Math.max(score, 150 - Math.min(ancestorDepth, 6) * 8);
    if (filename.includes(target) || filename.includes(normalize(compactTarget))) score = Math.max(score, 165);
    const tokens = target.split(' ').filter((token) => token.length >= 3);
    if (tokens.length && tokens.every((token) => filename.includes(token))) score = Math.max(score, 145);
    if ((asset.width || 0) < 36 || (asset.height || 0) < 36) score -= 45;
    if (/logo|favicon|avatar|icon-app/i.test(asset.url)) score -= 80;
    return score;
  };

  for (const candidate of uniqueCandidates) {
    let best = null;
    for (const asset of assets) {
      const score = scoreAsset(candidate, asset);
      if (score < 110 || (best && score <= best.score)) continue;
      best = { asset, score };
    }
    if (!best) continue;
    items[candidate.type][candidate.key] = {
      name: candidate.name,
      url: best.asset.url,
      sourceUrl: SOURCE_URL,
      provider: 'NW Hub',
      matchScore: best.score,
      matchContext: best.asset.nearestText || best.asset.parentText || best.asset.siblingText || '',
      rightsNote: 'Image URL published by NW Hub; Neverwinter artwork rights remain with the respective publisher.',
    };
  }

  const candidatesMatched = Object.values(items).reduce((total, group) => total + Object.keys(group).length, 0);
  const raw = {
    source: SOURCE_URL,
    pageTitle: await page.title(),
    capturedAt: new Date().toISOString(),
    assets,
    controlsVisited: [...visitedLabels],
    stats: { assetsDiscovered: assets.length, candidatesMatched },
  };
  await fs.writeFile(RAW_OUTPUT, `${JSON.stringify(raw, null, 2)}\n`);

  const media = {
    source: SOURCE_URL,
    generatedAt: raw.capturedAt,
    stats: raw.stats,
    items,
  };
  await fs.writeFile(MAP_OUTPUT, `export default ${JSON.stringify(media, null, 2)};\n`);
  console.log(`NW Hub extraction complete: ${assets.length} assets, ${candidatesMatched} matched candidates.`);
} finally {
  await browser.close();
}
