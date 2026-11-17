import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('activation removes only stale Lockbox Vault caches', async () => {
  const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const deleted = [];
  const cacheKeys = [
    'lockbox-vault-v14',
    'lockbox-vault-v15',
    'unrelated-app-v1',
    'other-app-assets',
  ];

  const context = {
    self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
    },
    caches: {
      keys: async () => cacheKeys,
      delete: async (key) => {
        deleted.push(key);
        return true;
      },
    },
  };

  runInNewContext(script, context);
  let completion;
  handlers.get('activate')({
    waitUntil(promise) { completion = promise; },
  });
  await completion;
  assert.deepEqual(deleted, ['lockbox-vault-v14']);
});

test('offline scripts do not receive the HTML navigation fallback', async () => {
  const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const requestedCacheKeys = [];
  const document = { body: 'HTML navigation fallback' };
  const context = {
    self: {
      location: { origin: 'https://example.test' },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined },
    },
    caches: {
      match: async (key) => {
        requestedCacheKeys.push(key);
        return key === '/' ? document : undefined;
      },
      open: async () => ({ put: async () => undefined }),
    },
    fetch: async () => { throw new Error('offline'); },
  };
  runInNewContext(script, context);
  const dispatch = async (request) => {
    let result;
    handlers.get('fetch')({
      request,
      respondWith(promise) { result = promise; },
    });
    return await result;
  };
  const scriptRequest = { method: 'GET', mode: 'no-cors', destination: 'script' };
  const offlineScript = await dispatch(scriptRequest);
  assert.equal(offlineScript, undefined);
  assert.ok(!requestedCacheKeys.includes('/'), 'Script request must not receive index HTML');
  const navigation = await dispatch({ method: 'GET', mode: 'navigate', destination: 'document' });
  assert.equal(navigation, document, 'Navigation retains its offline fallback');
});

test('healthy network responses survive storage/quota failures', async () => {
  const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const networkResponse = { ok: true, type: 'basic', clone() { return this; } };

  for (const failingOperation of ['open', 'put']) {
    const handlers = new Map();
    const context = {
      self: {
        location: { origin: 'https://example.test' },
        addEventListener: (name, handler) => handlers.set(name, handler),
        skipWaiting: () => undefined,
        clients: { claim: async () => undefined },
      },
      caches: {
        open: async () => {
          if (failingOperation === 'open') throw new Error('Quota exceeded');
          return { put: async () => { throw new Error('Quota exceeded'); } };
        },
        match: async () => undefined,
      },
      fetch: async () => networkResponse,
    };
    runInNewContext(script, context);
    let response;
    handlers.get('fetch')({
      request: { method: 'GET', mode: 'navigate', destination: 'document' },
      respondWith(promise) { response = promise; },
    });
    assert.equal(await response, networkResponse, `network response lost after ${failingOperation} failure`);
  }
});
