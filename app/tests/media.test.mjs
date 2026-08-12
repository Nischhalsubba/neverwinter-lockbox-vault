import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cleanRewardName,
  resolveCoverMedia,
  resolveRewardMedia,
} from '../artwork.js';

test('cleans account-unlock wrappers and rarity suffixes', () => {
  assert.equal(cleanRewardName('[Uni the Unicorn] - Account unlock'), 'Uni the Unicorn');
  assert.equal(cleanRewardName('Whirlwind (Epic)'), 'Whirlwind');
  assert.equal(cleanRewardName('Bigby’s Hand'), "Bigby's Hand");
});

test('resolves known synced reward artwork from project assets', () => {
  const media = resolveRewardMedia('companion', '[Bobby the Barbarian] - Account unlock');
  assert.equal(media.canonicalName, 'Bobby the Barbarian');
  assert.match(media.url, /^\/assets\//);
});

test('resolves historical pack labels to local pack artwork', () => {
  const companion = resolveRewardMedia('companion', 'Wasteland Epic Companion Pack');
  const legendary = resolveRewardMedia('companion', 'Stardock Legendary Companion Pack');
  const mount = resolveRewardMedia('mount', 'Stardock Legendary Mount Pack');
  const artifact = resolveRewardMedia('artifact', 'Glorious Resurgence Epic Artifacts Pack');

  for (const media of [companion, legendary, mount, artifact]) {
    assert.match(media.url, /^\/assets\/packs\//);
    assert.doesNotMatch(media.url, /^https?:\/\//);
  }
});

test('resolves remaining individual and special rewards from repository assets', () => {
  for (const [type, name] of [
    ['mount', "Hag's Hexing Cauldron"],
    ['mount', 'Cactus the Hedgehog'],
    ['companion', 'Sardina the Tressym'],
    ['race', 'Sigil of the Metallic Ancestry Dragonborn'],
    ['race', 'Glorious Resurgence Legendary Pack'],
  ]) {
    const media = resolveRewardMedia(type, name);
    assert.ok(media?.url, `${name} should have artwork`);
    assert.match(media.url, /^\/assets\/rewards\/curated\//);
    assert.doesNotMatch(media.url, /^https?:\/\//);
  }
});

test('resolves lockbox covers from project-hosted artwork', () => {
  const media = resolveCoverMedia({ slug: 'nightmare-lockbox', name: 'Nightmare Lockbox' });
  assert.ok(media);
  assert.match(media.url, /^\/assets\/lockboxes\//);
  assert.equal(media.isLocal, true);
});

test('returns null instead of inventing an unverified image path', () => {
  assert.equal(resolveRewardMedia('artifact', 'Definitely Unknown Artifact'), null);
});
