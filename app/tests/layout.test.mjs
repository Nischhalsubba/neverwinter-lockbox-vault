import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../archive.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../redesign.css', import.meta.url), 'utf8');
const artwork = await readFile(new URL('../artwork.js', import.meta.url), 'utf8');

test('application shell exposes the archive controls', () => {
  for (const id of ['catalog', 'search-input', 'year-filter', 'sort-filter', 'results', 'detail-dialog']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /class="category-tabs"/);
  assert.match(html, /src="\.\/archive\.js"/);
  assert.doesNotMatch(html, /spacious\.css|app-v2\.js/);
});

test('catalog runtime loads data and artwork from project modules', () => {
  assert.match(app, /new URL\(['"]\.\/data\/lockboxes\.json['"], import\.meta\.url\)/);
  assert.match(app, /fetch\(dataUrl/);
  assert.match(app, /from ['"]\.\/artwork\.js['"]/);
  assert.doesNotMatch(app, /import\(['"]\.\/media\.js['"]\)|import\(['"]\.\/covers\.js['"]\)/);
});

test('artwork resolver prefers project-hosted media', () => {
  assert.match(artwork, /local-media\.js/);
  assert.match(artwork, /\/assets\/packs\/companion-choice\.webp/);
  assert.match(artwork, /resolveCoverMedia/);
  assert.doesNotMatch(artwork, /nwhub-media\.js/);
});

test('stylesheet uses vertical archive cards with generous gutters', () => {
  for (const selector of ['.topbar', '.archive-toolbar', '.category-tabs', '.pack-card', '.pack-card-art', '.detail-dialog']) {
    assert.ok(css.includes(selector), `Expected archive selector ${selector}`);
  }
  assert.match(css, /\.pack-grid[\s\S]*minmax\(300px, 1fr\)[\s\S]*gap: 24px/);
  assert.match(css, /\.pack-card[\s\S]*flex-direction: column/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
