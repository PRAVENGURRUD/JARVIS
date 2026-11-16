import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Isolated data folder for tests (must be set before config is imported).
process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'jarvis-test-'));
process.env.RATE_LIMIT_PER_MIN = '1000';
const { createApp } = await import('../src/app.js');
const { createPairingCode } = await import('../src/security/pairing.js');
const { savePairing, getPairing } = await import('../src/security/store.js');

let base;
before(async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  server.unref();
});

const post = (p, body, headers = {}) =>
  fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('protected routes refuse requests without a token', async () => {
  assert.equal((await fetch(`${base}/whoami`)).status, 401);
  const res = await fetch(`${base}/whoami`, { headers: { authorization: 'Bearer ' + 'x'.repeat(43) } });
  assert.equal(res.status, 401);
});

test('pair with no active code is refused', async () => {
  await savePairing(null);
  assert.equal((await post('/pair', { code: 'a'.repeat(32) })).status, 403);
});

test('wrong code is refused, right code pairs once, token works', async () => {
  const code = await createPairingCode();
  assert.equal((await post('/pair', { code: 'b'.repeat(32) })).status, 403);

  const ok = await post('/pair', { code, deviceName: 'S24 Plus' });
  assert.equal(ok.status, 201);
  const { token, deviceId } = await ok.json();
  assert.ok(token.length >= 40);

  // Code is single-use.
  assert.equal((await post('/pair', { code })).status, 403);

  const who = await fetch(`${base}/whoami`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(who.status, 200);
  assert.equal((await who.json()).device.id, deviceId);
});

test('expired code is refused', async () => {
  const code = await createPairingCode();
  const p = await getPairing();
  await savePairing({ ...p, expiresAt: Date.now() - 1 });
  assert.equal((await post('/pair', { code })).status, 403);
});
