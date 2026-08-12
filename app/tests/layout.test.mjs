import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app-v2.js', import.meta.url), 'utf8');
const covers = await readFile(new URL('../covers.js', import.meta.url), 'utf8');
const polish = await readFile(new URL('../theme/06-polish.css', import.meta.url), 'utf8');

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

test('refreshed runtime guarantees vector cover and reward fallbacks', () => {
  assert.match(covers, /return null;/);
  assert.match(app, /vaultIcon/);
  assert.match(app, /vault-icon/);
  assert.match(app, /rewardIcon/);
  assert.match(app, /Local category icon/);
});

test('premium layer covers responsive, focus, and reduced-motion states', () => {
  for (const selector of ['.topbar', '.filter-panel', '.lockbox-card', '.vault-icon', '.detail-dialog']) {
    assert.ok(polish.includes(selector), `Expected polish selector ${selector}`);
  }
  assert.match(polish, /focus-visible/);
  assert.match(polish, /@media\(max-width:900px\)/);
  assert.match(polish, /@media\(max-width:620px\)/);
  assert.match(polish, /prefers-reduced-motion/);
});
