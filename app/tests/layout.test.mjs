import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('application shell exposes the redesigned workspace regions', () => {
  for (const id of ['archive', 'featured', 'search-input', 'year-filter', 'sort-filter', 'results', 'detail-dialog']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('layout includes rail, featured panel, sticky command bar, and responsive view modes', () => {
  assert.match(css, /\.app-shell/);
  assert.match(css, /grid-template-columns:230px minmax\(0,1fr\)/);
  assert.match(css, /\.featured/);
  assert.match(css, /\.command-bar/);
  assert.match(css, /\.results-grid\.is-list/);
  assert.match(css, /@media\(max-width:980px\)/);
});

test('application never renders generated placeholder image paths', () => {
  assert.doesNotMatch(app, /data-cover-fallback/);
  assert.doesNotMatch(app, /Placeholder cover/);
  assert.match(app, /isPlaceholder/);
});

test('reward thumbnails use verified mappings and batched wiki fallback', () => {
  assert.match(app, /resolveRewardMedia|resolveRewardMedia as/);
  assert.match(app, /pageimages\|info/);
  assert.match(app, /Neverwinter Wiki \/ Fandom/);
});
