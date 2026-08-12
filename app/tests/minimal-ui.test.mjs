/*
 * Guards the current Lockbox Vault interaction hierarchy, visual tokens, and
 * responsive behavior without depending on superseded prototype markup.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const covers = await readFile(new URL('../covers.js', import.meta.url), 'utf8');
const foundation = await readFile(new URL('../theme/01-foundation.css', import.meta.url), 'utf8');
const responsive = await readFile(new URL('../theme/05-responsive.css', import.meta.url), 'utf8');

test('archive hierarchy keeps navigation, discovery controls, results, and detail view', () => {
  for (const marker of [
    'class="topbar"',
    'class="hero"',
    'class="filter-panel"',
    'class="results-grid"',
    'class="detail-dialog"',
  ]) {
    assert.match(html, new RegExp(marker));
  }
});

test('design system exposes the maintained editorial archive tokens', () => {
  for (const token of ['--ink:', '--muted:', '--paper:', '--white:', '--violet:', '--lime:', '--coral:']) {
    assert.ok(foundation.includes(token), `Expected design token ${token}`);
  }
});

test('view controls use SVG icons and accessible labels', () => {
  assert.match(html, /id="grid-view"[\s\S]*?<svg/);
  assert.match(html, /id="list-view"[\s\S]*?<svg/);
  assert.match(html, /aria-label="Clear search"/);
  assert.match(html, /aria-label="Close details"/);
});

test('unverified cover images are omitted rather than rendered from placeholder paths', () => {
  assert.match(covers, /return null;/);
  assert.doesNotMatch(covers, /Generated community placeholder/);
  assert.match(app, /card-visual-empty/);
});

test('responsive checkpoints cover desktop compression, tablet, mobile, and reduced motion', () => {
  assert.match(responsive, /@media\(max-width:1250px\)/);
  assert.match(responsive, /@media\(max-width:900px\)/);
  assert.match(responsive, /@media\(max-width:620px\)/);
  assert.match(responsive, /prefers-reduced-motion/);
});
