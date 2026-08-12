import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../archive.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../redesign.css', import.meta.url), 'utf8');
const artwork = await readFile(new URL('../artwork.js', import.meta.url), 'utf8');
const localMedia = await readFile(new URL('../data/local-media.js', import.meta.url), 'utf8');

test('archive is built around search, filters, collection cards, and details', () => {
  for (const marker of [
    'class="topbar"',
    'class="archive-intro"',
    'class="archive-toolbar"',
    'class="category-tabs"',
    'class="pack-grid"',
    'class="detail-dialog"',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /class="hub-shell"|class="hub-toolbar"|id="grid-view"|id="list-view"/);
});

test('viewer-facing shell has its own identity and no external catalog branding', () => {
  assert.match(html, /Lockbox Archive/);
  assert.doesNotMatch(html, /NW Hub|nw-hub\.com/i);
  assert.doesNotMatch(app, /NW Hub|nw-hub\.com/i);
});

test('design tokens remain restrained and readable', () => {
  for (const token of ['--bg:', '--surface:', '--border:', '--text:', '--muted:', '--accent:']) {
    assert.ok(css.includes(token), `Expected design token ${token}`);
  }
  assert.doesNotMatch(css, /backdrop-filter|filter:\s*blur/i);
});

test('search and detail controls remain accessible', () => {
  assert.match(html, /role="search"/);
  assert.match(html, /aria-label="Clear search"/);
  assert.match(html, /aria-label="Close details"/);
  assert.match(app, /event\.key === '\/'/);
});

test('runtime keeps local fallbacks when artwork is unavailable', () => {
  assert.match(app, /rewardFallback/);
  assert.match(app, /vaultFallback/);
  assert.match(artwork, /local-media\.js/);
  assert.match(localMedia, /["']?lockbox["']?\s*:/);
});

test('responsive checkpoints and reduced motion are present', () => {
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
