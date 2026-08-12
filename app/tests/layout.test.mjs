import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app-v2.js', import.meta.url), 'utf8');
const covers = await readFile(new URL('../covers.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../redesign.css', import.meta.url), 'utf8');
const media = await readFile(new URL('../media.js', import.meta.url), 'utf8');

test('application shell exposes the simple catalog controls', () => {
  for (const id of ['catalog', 'search-input', 'year-filter', 'sort-filter', 'results', 'detail-dialog']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /class="category-tabs"/);
  assert.doesNotMatch(html, /id="grid-view"|id="list-view"/);
  assert.match(html, /src="\.\/app-v2\.js"/);
});

test('catalog runtime can boot when served directly or through Vite', () => {
  assert.doesNotMatch(app, /import\s+base\s+from\s+["']\.\/data\/lockboxes\.json["']/);
  assert.match(app, /new URL\(['"]\.\/data\/lockboxes\.json['"], import\.meta\.url\)/);
  assert.match(app, /fetch\(dataUrl/);
  assert.match(app, /import\(['"]\.\/media\.js['"]\)/);
  assert.match(app, /import\(['"]\.\/covers\.js['"]\)/);
});

test('synced local media is preferred while readable fallbacks remain available', () => {
  assert.match(media, /local-media\.js/);
  assert.match(covers, /local-media\.js/);
  assert.match(app, /vaultFallback/);
  assert.match(app, /rewardIcon/);
  assert.match(covers, /isLocal: true/);
});

test('stylesheet favors a compact icon catalog across screen sizes', () => {
  for (const selector of ['.topbar', '.hub-toolbar', '.category-tabs', '.pack-card', '.pack-icon', '.detail-dialog']) {
    assert.ok(css.includes(selector), `Expected catalog selector ${selector}`);
  }
  assert.doesNotMatch(html, /class="hero"|class="filter-panel"/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media \(max-width: 859px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
