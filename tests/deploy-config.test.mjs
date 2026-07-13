import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Cloudflare deploys the built SPA from dist', () => {
  const config = JSON.parse(readFileSync(new URL('wrangler.jsonc', root), 'utf8'));
  assert.equal(config.name, 'neverwinter-lockbox-vault');
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, 'single-page-application');
});

test('Vite exposes a plugins array for Wrangler compatibility', () => {
  const config = readFileSync(new URL('vite.config.js', root), 'utf8');
  assert.match(config, /plugins:\s*\[\s*\]/);
});
