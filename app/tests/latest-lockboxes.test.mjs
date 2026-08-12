import assert from 'node:assert/strict';
import { test } from 'node:test';
import latestLockboxes from '../data/latest-lockboxes.js';

test('latest researched catalog additions include Buried Treasure Lockbox', () => {
  assert.equal(latestLockboxes.length, 1);
  const [entry] = latestLockboxes;
  assert.equal(entry.id, 72);
  assert.equal(entry.slug, 'buried-treasure-lockbox');
  assert.equal(entry.name, 'Buried Treasure Lockbox');
  assert.equal(entry.releaseDate, '2026-07-09');
  assert.deepEqual(entry.rewards.mounts, ['[Ollie the Octie] - Account unlock']);
  for (const reward of ['Combat Enchantments Choice Pack', 'Shifting Shards', 'Fluid Aurora', 'Shattered Resolve']) {
    assert.ok(entry.rewards.artifacts.includes(reward));
  }
  assert.equal(entry.hasAccountUnlock, true);
  assert.match(entry.sourceUrl, /^https:\/\//);
});
