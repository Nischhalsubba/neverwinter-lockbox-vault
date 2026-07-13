import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MEDIA_SOURCES,
  cleanRewardName,
  resolveRewardMedia,
} from '../media.js';

test('cleans account-unlock wrappers and rarity suffixes', () => {
  assert.equal(cleanRewardName('[Uni the Unicorn] - Account unlock'), 'Uni the Unicorn');
  assert.equal(cleanRewardName('Whirlwind (Epic)'), 'Whirlwind');
  assert.equal(cleanRewardName('Bigby’s Hand'), "Bigby's Hand");
});

test('resolves ToonForge companion thumbnails with explicit mappings', () => {
  const media = resolveRewardMedia('companion', '[Bobby the Barbarian] - Account unlock');
  assert.equal(media.canonicalName, 'Bobby the Barbarian');
  assert.match(media.url, /images\/companions\/bobby\.webp$/);
  assert.equal(media.provider, 'ToonForge / Neverwinter Compendium');
});

test('resolves mount aliases and rarity labels', () => {
  const alder = resolveRewardMedia('mount', '[Twice-Pale Alder Mount] - Account unlock');
  const whirlwind = resolveRewardMedia('mount', 'Whirlwind (Epic)');

  assert.match(alder.url, /twice-pale-alder\.webp$/);
  assert.match(whirlwind.url, /whirlwind\.webp$/);
});

test('returns null instead of inventing an unverified image path', () => {
  assert.equal(resolveRewardMedia('mount', '[Snowtusk] - Account unlock'), null);
  assert.equal(resolveRewardMedia('artifact', 'Unknown Artifact'), null);
});

test('all declared source registries use HTTPS', () => {
  for (const source of Object.values(MEDIA_SOURCES)) {
    assert.match(source.url, /^https:\/\//);
  }
});
