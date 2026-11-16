import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'jarvis-test-'));
const { createApp } = await import('../src/app.js');

async function withServer(fn) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('GET /health returns ok', () => withServer(async (base) => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
}));

test('unknown route without token is 401 (hides which routes exist), no x-powered-by', () => withServer(async (base) => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('x-powered-by'), null);
}));

test('security headers are set', () => withServer(async (base) => {
  const res = await fetch(`${base}/health`);
  assert.ok(res.headers.get('x-content-type-options'));
  assert.ok(res.headers.get('ratelimit') || res.headers.get('ratelimit-policy'));
}));
