import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const lockboxes = JSON.parse(
  await readFile(new URL('../data/lockboxes.json', import.meta.url), 'utf8'),
);

test('database contains the complete spreadsheet snapshot', () => {
  assert.equal(lockboxes.length, 71);
  assert.equal(lockboxes[0].name, 'Nightmare Lockbox');
  assert.equal(lockboxes.at(-1).name, 'Encroaching Frost Lockbox');
});

test('every record has a unique id and slug', () => {
  const ids = new Set(lockboxes.map(({ id }) => id));
  const slugs = new Set(lockboxes.map(({ slug }) => slug));

  assert.equal(ids.size, lockboxes.length);
  assert.equal(slugs.size, lockboxes.length);
});

test('every record has a valid release date and search-safe reward arrays', () => {
  for (const lockbox of lockboxes) {
    assert.match(lockbox.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(Number.isNaN(Date.parse(lockbox.releaseDate)), false);
    assert.equal(lockbox.year, Number(lockbox.releaseDate.slice(0, 4)));

    for (const category of ['companions', 'artifacts', 'mounts', 'races']) {
      assert.ok(Array.isArray(lockbox.rewards[category]));
    }
  }
});

test('every image path resolves to a local asset', async () => {
  await Promise.all(
    lockboxes.map(({ image }) => access(new URL(`../public/${image}`, import.meta.url))),
  );
});

test('account unlock flag agrees with the reward text', () => {
  for (const lockbox of lockboxes) {
    const text = JSON.stringify(lockbox.rewards).toLowerCase();
    assert.equal(lockbox.hasAccountUnlock, text.includes('account unlock'));
  }
});


test('official artwork discovery metadata is complete when present', () => {
  for (const lockbox of lockboxes) {
    if (!lockbox.imageDiscovery) continue;
    assert.match(lockbox.imageDiscovery.pageUrl, /^https:\/\//);
    assert.ok(lockbox.imageDiscovery.provider);
    assert.ok(lockbox.imageDiscovery.rightsHolder);
    assert.equal(lockbox.imageStatus, 'generated-placeholder');
  }
});
