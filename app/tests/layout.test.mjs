/*
 * Guards the current Lockbox Vault workspace structure and media behavior.
 * Theme assertions read the split CSS modules rather than an obsolete single-file layout.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const covers = await readFile(new URL('../covers.js', import.meta.url), 'utf8');
const theme = await Promise.all([
  '01-foundation.css',
  '02-command-deck.css',
  '03-cards.css',
  '04-details.css',
  '05-responsive.css',
].map((file) => readFile(new URL(`../theme/${file}`, import.meta.url), 'utf8')));
const css = theme.join('\n');

test('application shell exposes the active archive workspace controls', () => {
  for (const id of [
    'catalog',
    'search-input',
    'year-filter',
    'sort-filter',
    'results',
    'grid-view',
    'list-view',
    'detail-dialog',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('layout includes navigation, hero, filter deck, cards, and responsive view modes', () => {
  for (const selector of [
    '.topbar',
    '.hero',
    '.catalog-layout',
    '.filter-panel',
    '.results-grid',
    '.results-grid.is-list',
    '.detail-dialog',
  ]) {
    assert.ok(css.includes(selector), `Expected theme selector ${selector}`);
  }
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:620px\)/);
});

test('runtime renders only verified cover URLs and uses a non-image empty state otherwise', () => {
  assert.match(covers, /return null;/);
  assert.match(covers, /isPlaceholder: false/);
  assert.doesNotMatch(covers, /provider: 'Generated community placeholder'/);
  assert.match(app, /card-visual-empty/);
});

test('reward thumbnails use verified mappings and batched wiki fallback', () => {
  assert.match(app, /resolveRewardMedia|resolveRewardMedia as/);
  assert.match(app, /pageimages\|info/);
  assert.match(app, /Neverwinter Wiki \/ Fandom/);
});
