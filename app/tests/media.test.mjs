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

test('resolves known companion artwork from a verified source', () => {
  const media = resolveRewardMedia('companion', '[Bobby the Barbarian] - Account unlock');
  assert.equal(media.canonicalName, 'Bobby the Barbarian');
  assert.ok(media.url);
  assert.ok(media.provider);
});

test('resolves known mount aliases and rarity labels', () => {
  const alder = resolveRewardMedia('mount', '[Twice-Pale Alder Mount] - Account unlock');
  const whirlwind = resolveRewardMedia('mount', 'Whirlwind (Epic)');

  assert.match(alder.canonicalName, /^Twice-Pale Alder(?: Mount)?$/);
  assert.equal(whirlwind.canonicalName, 'Whirlwind');
  assert.ok(alder.url);
  assert.ok(whirlwind.url);
});

test('fills historical pack labels with NW Hub category artwork', () => {
  const companion = resolveRewardMedia('companion', 'Wasteland Epic Companion Pack');
  const mount = resolveRewardMedia('mount', 'Stardock Legendary Mount Pack');
  const artifact = resolveRewardMedia('artifact', 'Glorious Resurgence Epic Artifacts Pack');

  assert.match(companion.url, /^https:\/\/nw-hub\.com\/assets\/choice-packs\//);
  assert.match(mount.url, /^https:\/\/nw-hub\.com\/assets\/choice-packs\//);
  assert.match(artifact.url, /^https:\/\/nw-hub\.com\/assets\/choice-packs\//);
  assert.match(companion.provider, /NW Hub/);
});

test('resolves the remaining visible individual rewards from curated sources', () => {
  for (const [type, name] of [
    ['mount', "Hag's Hexing Cauldron"],
    ['mount', 'Cactus the Hedgehog'],
    ['companion', 'Sardina the Tressym'],
  ]) {
    const media = resolveRewardMedia(type, name);
    assert.ok(media?.url, `${name} should have artwork`);
    assert.match(media.url, /^https:\/\//);
    assert.ok(media.provider);
  }
});

test('returns null instead of inventing an unverified image path', () => {
  assert.equal(resolveRewardMedia('artifact', 'Definitely Unknown Artifact'), null);
});

test('all declared source registries use HTTPS', () => {
  for (const source of Object.values(MEDIA_SOURCES)) {
    assert.match(source.url, /^https:\/\//);
  }
});
