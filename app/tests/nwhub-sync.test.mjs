import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const extractor = await readFile(new URL('../scripts/extract_nwhub_catalog.mjs', import.meta.url), 'utf8');
const sync = await readFile(new URL('../scripts/sync_nwhub_missing_media.mjs', import.meta.url), 'utf8');

test('NW Hub extraction covers the base and latest lockbox catalog', () => {
  assert.match(extractor, /latestLockboxes/);
  assert.match(extractor, /https:\/\/nw-hub\.com\/packs/);
  assert.match(extractor, /lockboxes\?\|companions\?\|mounts\?\|artifacts\?/);
  assert.match(extractor, /candidatesMatched/);
});

test('NW Hub sync only fills missing local media and stores local WebP paths', () => {
  assert.match(sync, /localMedia/);
  assert.match(sync, /nwhubMedia/);
  assert.match(sync, /if \(merged\.items\.lockbox\[entry\.slug\]\?\.url\) continue/);
  assert.match(sync, /if \(merged\.items\[type\]\?\.\[key\]\?\.url\) continue/);
  assert.match(sync, /provider: 'NW Hub'/);
  assert.match(sync, /\.webp/);
});
