import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('minimal layout keeps a compact archive hierarchy', () => {
  assert.match(html, /class="intro"/);
  assert.match(html, /class="toolbar"/);
  assert.match(html, /class="category-row"/);
  assert.match(html, /class="results-grid"/);
});

test('design system exposes restrained neutral tokens', () => {
  for (const token of ['--bg:', '--surface:', '--text:', '--muted:', '--accent:']) {
    assert.match(css, new RegExp(token.replace('-', '\\-')));
  }
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test('functional icon buttons use SVG rather than emoji glyphs', () => {
  assert.match(html, /id="clear-search"[\s\S]*?<svg/);
  assert.match(html, /id="dialog-close"[\s\S]*?<svg/);
  assert.match(app, /class="card-open"[\s\S]*?<svg/);
});

test('unresolved cover media is omitted rather than replaced', () => {
  assert.match(app, /if \(!cover\) return '';/);
  assert.doesNotMatch(app, /Artwork loading/);
  assert.doesNotMatch(app, /detail-cover-empty/);
});

test('responsive checkpoints cover tablet and mobile widths', () => {
  assert.match(css, /@media\(max-width:1024px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(max-width:440px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
