import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app-v2.js', import.meta.url), 'utf8');
const covers = await readFile(new URL('../covers.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../redesign.css', import.meta.url), 'utf8');
const media = await readFile(new URL('../media.js', import.meta.url), 'utf8');

test('application shell exposes the active archive workspace controls', () => {
  for (const id of ['catalog', 'search-input', 'year-filter', 'sort-filter', 'results', 'grid-view', 'list-view', 'detail-dialog']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /src="\.\/app-v2\.js"/);
});

test('catalog runtime can boot when served directly or through Vite', () => {
  assert.doesNotMatch(app, /import\s+base\s+from\s+["']\.\/data\/lockboxes\.json["']/);
  assert.match(app, /new URL\(['"]\.\/data\/lockboxes\.json['"], import\.meta\.url\)/);
  assert.match(app, /fetch\(dataUrl/);
  assert.match(app, /import\(['"]\.\/media\.js['"]\)/);
  assert.match(app, /import\(['"]\.\/covers\.js['"]\)/);
});

test('synced local media is preferred while fallbacks remain available', () => {
  assert.match(media, /local-media\.js/);
  assert.match(covers, /local-media\.js/);
  assert.match(app, /vaultIcon/);
  assert.match(app, /rewardIcon/);
  assert.match(covers, /isLocal: true/);
});

test('catalog-first stylesheet covers desktop, tablet, mobile, focus, and reduced motion', () => {
  for (const selector of ['.topbar', '.archive-intro', '.catalog-layout', '.filter-panel', '.lockbox-card', '.detail-dialog']) {
    assert.ok(css.includes(selector), `Expected catalog selector ${selector}`);
  }
  assert.doesNotMatch(html, /class="hero"/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media \(max-width: 1250px\)/);
  assert.match(css, /@media \(max-width: 920px\)/);
  assert.match(css, /@media \(max-width: 660px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
