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

const mediaKey = (value = '') => normalize(value);

const safeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const targetList = [];
for (const entry of lockboxes) {
  targetList.push({ type: 'lockbox', key: entry.slug, name: cleanName(entry.name) });
  for (const [type, plural] of [
    ['companion', 'companions'],
    ['mount', 'mounts'],
    ['artifact', 'artifacts'],
    ['race', 'races'],
  ]) {
    for (const rawName of entry.rewards?.[plural] || []) {
      const name = cleanName(rawName);
      if (name) targetList.push({ type, key: mediaKey(name), name });
    }
  }
}

const targets = [...new Map(targetList.map((target) => [`${target.type}:${target.key}`, target])).values()];

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

page.on('response', (response) => {
  const url = safeHttpUrl(response.url());
  if (!url) return;
  const contentType = response.headers()['content-type'] || '';
  if (!contentType.startsWith('image/') && !/\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?|$)/i.test(url)) return;
  networkImages.set(url, {
    url,
    source: 'network',
    contentType,
    status: response.status(),
    viewLabel: 'network',
  });
});

const scrollToEnd = async () => {
  let stable = 0;
  let previousHeight = 0;
  for (let attempt = 0; attempt < 40 && stable < 4; attempt += 1) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate((target) => window.scrollTo({ top: target, behavior: 'instant' }), height);
    await page.waitForTimeout(450);
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
    let current = element.parentElement;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const text = textOf(current);
      const imageCount = current.querySelectorAll?.('img,source')?.length || 0;
      if (text && text.length <= 900) ancestors.push({ depth, text, imageCount });
    }
    const nearest = ancestors.find((item) => item.imageCount <= 1 && item.text.length <= 220)
      || ancestors.find((item) => item.text.length <= 220)
      || ancestors[0]
      || null;
    const card = element.closest?.('article,li,a,button,[role="button"],[role="listitem"]');
    return {
      nearestText: nearest?.text || '',
      cardText: card ? textOf(card).slice(0, 500) : '',
      parentText: textOf(element.parentElement).slice(0, 500),
      siblingText: [textOf(element.previousElementSibling), textOf(element.nextElementSibling)].filter(Boolean).join(' | ').slice(0, 350),
      ancestors,
    };
  };

  const entries = [];
  const push = (element, rawUrl, kind) => {
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
      naturalWidth: element.naturalWidth || 0,
      naturalHeight: element.naturalHeight || 0,
      ...contextFor(element),
    });
  };

  document.querySelectorAll('img').forEach((image) => push(image, image.currentSrc || image.src, 'img'));
  document.querySelectorAll('source[srcset]').forEach((source) => {
    const first = String(source.srcset).split(',')[0]?.trim().split(/\s+/)[0];
    push(source, first, 'source');
  });
  document.querySelectorAll('*').forEach((element) => {
    const background = getComputedStyle(element).backgroundImage;
    if (!background || background === 'none') return;
    for (const match of background.matchAll(/url\(["']?(.*?)["']?\)/g)) push(element, match[1], 'background');
  });

  return entries;
}, viewLabel);

const allAssets = [];
const capture = async (label) => {
  await scrollToEnd();
  allAssets.push(...await collectDomAssets(label));
};

const typeWords = {
  lockbox: ['lockbox', 'pack'],
  companion: ['companion'],
  mount: ['mount'],
  artifact: ['artifact', 'enchantment', 'item'],
  race: ['race', 'special', 'pack'],
};

const words = (value = '') => normalize(value)
  .split(' ')
  .filter((word) => word.length > 2 && !['the', 'and', 'pack', 'account', 'unlock'].includes(word));

const filenameText = (url) => {
  try {
    return normalize(decodeURIComponent(new URL(url).pathname.split('/').pop() || ''));
  } catch {
    return '';
  }
};

const scoreAsset = (target, asset) => {
  const targetText = normalize(target.name);
  if (!targetText || !asset.url) return -1;

  const fields = {
    alt: normalize(asset.alt),
    title: normalize(asset.title),
    aria: normalize(asset.ariaLabel),
    nearest: normalize(asset.nearestText),
    card: normalize(asset.cardText),
    parent: normalize(asset.parentText),
    sibling: normalize(asset.siblingText),
    filename: filenameText(asset.url),
  };

  const targetWords = words(target.name);
  let score = 0;
  let directIdentity = false;

  for (const value of [fields.alt, fields.title, fields.aria]) {
    if (!value) continue;
    if (value === targetText) { score = Math.max(score, 320); directIdentity = true; }
    else if (value.includes(targetText) || targetText.includes(value)) { score = Math.max(score, 250); directIdentity = true; }
  }

  if (fields.filename === targetText) { score = Math.max(score, 300); directIdentity = true; }
  if (targetWords.length && targetWords.every((word) => fields.filename.includes(word))) {
    score = Math.max(score, targetWords.length > 1 ? 245 : 185);
    directIdentity = true;
  }

  if (fields.nearest === targetText) score = Math.max(score, 285);
  else if (fields.nearest.includes(targetText) && targetText.length >= 5) score = Math.max(score, 235);

  if (fields.sibling === targetText) score = Math.max(score, 260);
  else if (fields.sibling.includes(targetText) && targetText.length >= 5) score = Math.max(score, 215);

  if (fields.card === targetText) score = Math.max(score, 245);
  else if (fields.card.includes(targetText) && targetText.length >= 5) {
    score = Math.max(score, fields.card.length <= 180 ? 205 : 165);
  }

  if (fields.parent.includes(targetText) && targetText.length >= 5) {
    score = Math.max(score, fields.parent.length <= 180 ? 195 : 155);
  }

  const combined = [fields.alt, fields.title, fields.aria, fields.nearest, fields.sibling, fields.filename].join(' ');
  if (targetWords.length > 1 && targetWords.every((word) => combined.includes(word))) score = Math.max(score, 190);

  const renderedWidth = asset.width || asset.naturalWidth || 0;
  const renderedHeight = asset.height || asset.naturalHeight || 0;
  const ratio = renderedWidth && renderedHeight ? renderedWidth / renderedHeight : 1;
  if (ratio >= 0.72 && ratio <= 1.38) score += 24;
  if (ratio > 2 || ratio < 0.5) score -= 70;
  if (renderedWidth >= 32 && renderedHeight >= 32 && renderedWidth <= 320 && renderedHeight <= 320) score += 15;

  const view = normalize(asset.viewLabel);
  if ((typeWords[target.type] || []).some((word) => view.includes(word))) score += 18;
  if (target.type === 'lockbox' && /lockbox/.test(fields.filename)) score += 20;

  if (/logo|favicon|avatar|brand|wordmark|header|background/i.test(asset.url)) score -= 120;
  if (!directIdentity && score < 180) return score - 35;
  return score;
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

  await capture('all');

  const categoryPattern = /^(all|packs?|lockboxes?|companions?|mounts?|artifacts?|races?|items?|enchantments?|rewards?|special)$/i;
  const controls = page.locator('button, [role="tab"], a');
  const controlCount = Math.min(await controls.count(), 320);
  const visited = new Set();
  for (let index = 0; index < controlCount; index += 1) {
    const control = controls.nth(index);
    const text = String(await control.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!categoryPattern.test(text) || visited.has(text.toLowerCase())) continue;
    visited.add(text.toLowerCase());
    await control.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(700);
    await capture(text.toLowerCase());
  }

  const deduped = new Map();
  for (const asset of allAssets) {
    const url = safeHttpUrl(asset.url);
    if (!url) continue;
    const key = [url, asset.nearestText, asset.cardText, asset.siblingText, asset.viewLabel].join('|');
    if (!deduped.has(key)) deduped.set(key, { ...asset, url });
  }
  for (const asset of networkImages.values()) {
    if (![...deduped.values()].some((existing) => existing.url === asset.url)) deduped.set(`${asset.url}|network`, asset);
  }

  const assets = [...deduped.values()];
  const items = { lockbox: {}, companion: {}, mount: {}, artifact: {}, race: {} };
  const matches = [];

  for (const target of targets) {
    let best = null;
    for (const asset of assets) {
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
      matchContext: best.asset.nearestText || best.asset.siblingText || best.asset.cardText || '',
      rightsNote: 'Image discovered on NW Hub; Neverwinter artwork rights remain with the respective rights holder.',
    };
    matches.push({ target, score: best.score, asset: best.asset.url, context: items[target.type][target.key].matchContext });
  }

  const stats = {
    assetsDiscovered: assets.length,
    targetsSearched: targets.length,
    candidatesMatched: matches.length,
    lockboxesMatched: Object.keys(items.lockbox).length,
    rewardsMatched: matches.filter((match) => match.target.type !== 'lockbox').length,
  };
  const capturedAt = new Date().toISOString();

  await fs.writeFile(RAW_OUTPUT, `${JSON.stringify({
    source: SOURCE_URL,
    pageTitle: await page.title(),
    capturedAt,
    controlsVisited: [...visited],
    stats,
    matches,
    assets,
  }, null, 2)}\n`);

  await fs.writeFile(MAP_OUTPUT, `export default ${JSON.stringify({
    source: SOURCE_URL,
    generatedAt: capturedAt,
    stats,
    items,
  }, null, 2)};\n`);

  console.log(`NW Hub extraction complete: ${stats.assetsDiscovered} assets, ${stats.candidatesMatched}/${stats.targetsSearched} matched.`);
} finally {
  await browser.close();
}
