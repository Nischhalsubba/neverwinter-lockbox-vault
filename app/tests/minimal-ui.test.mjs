import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app-v2.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../redesign.css', import.meta.url), 'utf8');
const localMedia = await readFile(new URL('../data/local-media.js', import.meta.url), 'utf8');

test('catalog is built around search, tabs, filters, results, and details', () => {
  for (const marker of [
    'class="topbar"',
    'class="hub-toolbar"',
    'class="category-tabs"',
    'class="pack-grid"',
    'class="detail-dialog"',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /class="filter-panel"|id="grid-view"|id="list-view"/);
});

test('design tokens remain restrained and readable', () => {
  for (const token of ['--bg:', '--surface:', '--border:', '--text:', '--muted:', '--accent:']) {
    assert.ok(css.includes(token), `Expected design token ${token}`);
  }
  assert.doesNotMatch(css, /hero-glow|backdrop-filter|filter:\s*blur/i);
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
  assert.match(localMedia, /["']?items["']?\s*:/);
  assert.match(localMedia, /["']?lockbox["']?\s*:/);
});

test('responsive checkpoints cover tablet, phone, small phone, and reduced motion', () => {
  assert.match(css, /@media \(max-width: 859px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
