import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../spacious.css', import.meta.url), 'utf8');

test('spacious catalog layer is loaded after the base design', () => {
  assert.match(html, /redesign\.css[\s\S]*spacious\.css/);
});

test('desktop catalog cards have larger gutters and card footprint', () => {
  assert.match(css, /\.pack-grid[\s\S]*minmax\(340px, 1fr\)[\s\S]*gap: 18px/);
  assert.match(css, /\.pack-card[\s\S]*grid-template-columns: 96px[\s\S]*padding: 14px/);
});

test('mobile keeps one-column browsing with comfortable gaps', () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pack-grid[\s\S]*grid-template-columns: 1fr[\s\S]*gap: 12px/);
});
