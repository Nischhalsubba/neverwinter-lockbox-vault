import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app-v2.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../redesign.css', import.meta.url), 'utf8');
const localMedia = await readFile(new URL('../data/local-media.js', import.meta.url), 'utf8');

test('archive hierarchy prioritizes navigation, filters, results, and details', () => {
  for (const marker of [
    'class="topbar"',
    'class="archive-intro"',
    'class="filter-panel"',
    'class="results-grid"',
    'class="detail-dialog"',
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.doesNotMatch(html, /class="hero"/);
});

test('design tokens stay restrained and catalog oriented', () => {
  for (const token of ['--bg:', '--surface:', '--border:', '--text:', '--muted:', '--accent:']) {
    assert.ok(css.includes(token), `Expected design token ${token}`);
  }
  assert.doesNotMatch(css, /hero-glow|backdrop-filter|filter:\s*blur/i);
});

test('view controls and search controls remain accessible', () => {
  assert.match(html, /id="grid-view"[\s\S]*?<svg/);
  assert.match(html, /id="list-view"[\s\S]*?<svg/);
  assert.match(html, /aria-label="Clear search"/);
  assert.match(html, /aria-label="Close details"/);
});

test('runtime retains resilient fallbacks while local media can be generated', () => {
  assert.match(app, /rewardFallback/);
  assert.match(app, /vaultIcon/);
  assert.match(localMedia, /items:/);
  assert.match(localMedia, /lockbox:/);
});

test('responsive checkpoints cover desktop, tablet, mobile, and reduced motion', () => {
  assert.match(css, /@media \(max-width: 1250px\)/);
  assert.match(css, /@media \(max-width: 920px\)/);
  assert.match(css, /@media \(max-width: 660px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
