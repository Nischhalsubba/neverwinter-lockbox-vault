import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  filterLockboxes,
  normalizeSearchText,
  sortLockboxes,
} from '../catalog.js';

const lockboxes = JSON.parse(
  await readFile(new URL('../data/lockboxes.json', import.meta.url), 'utf8'),
);

test('normalizes case and accents for forgiving search', () => {
  assert.equal(normalizeSearchText('ÉBON'), 'ebon');
});

test('finds a lockbox by reward name', () => {
  const results = filterLockboxes(lockboxes, { query: 'Snowtusk' });
  assert.deepEqual(results.map(({ name }) => name), ['Encroaching Frost Lockbox']);
});

test('supports multiple search tokens across a record', () => {
  const results = filterLockboxes(lockboxes, { query: 'account dragon' });
  assert.ok(results.length > 0);
  assert.ok(results.every(({ hasAccountUnlock }) => hasAccountUnlock));
});

test('filters by reward category and release year', () => {
  const results = filterLockboxes(lockboxes, {
    category: 'artifact',
    year: '2024',
    sort: 'oldest',
  });

  assert.deepEqual(results.map(({ name }) => name), [
    'Starlight Armaments Lockbox',
    'Doomspace Lockbox',
    'Foxfire Lockbox',
    'Psionic Lockbox',
  ]);
});

test('sorts names in both directions without mutating source data', () => {
  const sample = lockboxes.slice(0, 3);
  const original = sample.map(({ name }) => name);
  const descending = sortLockboxes(sample, 'za').map(({ name }) => name);

  assert.deepEqual(sample.map(({ name }) => name), original);
  assert.deepEqual(descending, [...original].sort((a, b) => b.localeCompare(a)));
});

test('multiple undated releases keep their original order after dated releases', () => {
  const sample = [
    { name: 'Undated A' },
    { name: 'Latest', releaseDate: '2026-10-01' },
    { name: 'Undated B' },
    { name: 'Earlier', releaseDate: '2026-01-01' },
  ];
  assert.deepEqual(sortLockboxes(sample, 'newest').map(x => x.name), ['Latest', 'Earlier', 'Undated A', 'Undated B']);
  assert.deepEqual(sortLockboxes(sample, 'oldest').map(x => x.name), ['Earlier', 'Latest', 'Undated A', 'Undated B']);
});

test('incomplete catalog dates do not crash sorting or outrank dated releases', () => {
  const sample = [
    { name: 'Missing release' },
    { name: 'Recent', releaseDate: '2026-10-01' },
    { name: 'Older', releaseDate: '2026-01-01' },
  ];
  assert.deepEqual(sortLockboxes(sample,'newest').map(x=>x.name), ['Recent','Older','Missing release']);
  assert.deepEqual(sortLockboxes(sample,'oldest').map(x=>x.name), ['Older','Recent','Missing release']);
  assert.deepEqual(sample.map(x=>x.name), ['Missing release','Recent','Older']);
});

test('invalid release date strings sort after verified calendar dates', () => {
  const sample = [
    { name: 'Not dated', releaseDate: 'TBD' },
    { name: 'Impossible day', releaseDate: '2026-02-31' },
    { name: 'Dated', releaseDate: '2026-04-01' },
    { name: 'No date' },
  ];
  for (const direction of ['newest', 'oldest']) {
    const result = sortLockboxes(sample, direction).map(({ name }) => name);
    assert.equal(result[0], 'Dated');
    assert.deepEqual(new Set(result.slice(1)), new Set(['Not dated', 'Impossible day', 'No date']));
  }
});
