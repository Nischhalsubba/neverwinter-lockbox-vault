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
