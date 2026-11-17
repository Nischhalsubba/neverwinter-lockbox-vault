import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchNwHubCandidates } from '../worker.js';

test('NW Hub script extraction refuses oversize streams with no Content-Length', async () => {
  let scriptCancelled = false;
  let scriptReads = 0;
  const fetchImpl = async (url) => {
    if (url === 'https://nw-hub.com/packs') {
      return new Response('<script src="/assets/test-bundle.js"></script>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    const body = new ReadableStream({
      pull(controller) {
        scriptReads += 1;
        controller.enqueue(new Uint8Array(1_500_001));
      },
      cancel() { scriptCancelled = true; },
    });
    return new Response(body, { status: 200 });
  };

  const result = await fetchNwHubCandidates(fetchImpl);
  assert.equal(result.stats.scriptsScanned, 1);
  assert.deepEqual(result.candidates, []);
  assert.equal(scriptCancelled, true);
  assert.ok(scriptReads <= 2, 'Large script must not be fully consumed');
});

test('normal small NW Hub scripts remain readable without Content-Length', async () => {
  const fetchImpl = async (url) => url.endsWith('/packs')
    ? new Response('<script src="/assets/data.js"></script>', { status: 200 })
    : new Response('{"name":"Sample Reward","image":"https://cdn.example.org/sample.png"}', { status: 200 });
  const result = await fetchNwHubCandidates(fetchImpl);
  assert.equal(result.stats.scriptsScanned, 1);
  assert.ok(result.candidates.some((item) => item.url === 'https://cdn.example.org/sample.png'));
});

test('NW Hub HTML page refuses oversized streaming responses', async () => {
  let cancelled = false;
  let reads = 0;
  const fetchImpl = async () => {
    const body = new ReadableStream({
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array(2_000_001));
      },
      cancel() { cancelled = true; },
    });
    return new Response(body, { status: 200 });
  };

  await assert.rejects(fetchNwHubCandidates(fetchImpl), /exceeds maximum safe size/);
  assert.equal(cancelled, true);
  assert.ok(reads <= 2, 'Large HTML should not be fully consumed');
});
