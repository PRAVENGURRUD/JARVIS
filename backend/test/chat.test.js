import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'jarvis-test-'));
process.env.RATE_LIMIT_PER_MIN = '1000';
const { createApp } = await import('../src/app.js');
const { createBrain } = await import('../src/brain/gemini.js');
const { pickTier } = await import('../src/brain/router.js');
const { createPairingCode } = await import('../src/security/pairing.js');

// Fake Gemini: records calls, can be told to fail.
const calls = [];
let failWith = null;
const fakeClient = {
  models: {
    async generateContent(req) {
      calls.push(req);
      if (failWith && failWith.models.includes(req.model)) throw failWith.err;
      return { text: JSON.stringify({ display: 'Seri Praveen, tension aagadheenga!', speech: 'சரி Praveen, டென்ஷன் ஆகாதீங்க!', lang: 'tanglish' }) };
    },
  },
};
const brain = createBrain({ client: fakeClient, models: { small: 'small-model', strong: 'strong-model' } });

let base, token;
before(async () => {
  const server = createApp({ brain }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
  const code = await createPairingCode();
  const res = await fetch(`${base}/pair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  token = (await res.json()).token;
});

const chat = (body, t = token) =>
  fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify(body) });

test('router: short chat → small, explain/Tanglish questions → strong', () => {
  assert.equal(pickTier('hi jarvis'), 'small');
  assert.equal(pickTier('explain recursion'), 'strong');
  assert.equal(pickTier('idhu eppadi work aagudhu'), 'strong');
});

test('/chat needs a token', async () => {
  assert.equal((await chat({ text: 'hi' }, 'x'.repeat(43))).status, 401);
});

test('/chat rejects bad input', async () => {
  assert.equal((await chat({ text: '' })).status, 400);
  assert.equal((await chat({ text: 'a'.repeat(2001) })).status, 400);
  assert.equal((await chat({ text: 'hi', history: [{ role: 'system', text: 'x' }] })).status, 400);
});

test('/chat returns display + speech + lang and logs no transcript', async () => {
  const res = await chat({ text: 'machi naalaiku exam iruku, tension ah iruku', history: [{ role: 'user', text: 'hi' }, { role: 'jarvis', text: 'hello' }] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reply.lang, 'tanglish');
  assert.match(body.reply.speech, /சரி/);
  const last = calls.at(-1);
  assert.equal(last.contents.length, 3);
  assert.equal(last.contents[1].role, 'model');
  assert.equal(last.config.responseMimeType, 'application/json');
  const log = await readFile(path.join(process.env.DATA_DIR, 'action-log.jsonl'), 'utf8');
  assert.ok(log.includes('"action":"chat"'));
  assert.ok(!log.includes('naalaiku'), 'transcript must not be in the action log');
});

test('quota on first model falls back to the other model', async () => {
  failWith = { models: ['small-model'], err: Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }) };
  const res = await chat({ text: 'hi' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).model, 'strong-model');
  failWith = null;
});

test('quota on both models → 429 with a spoken fallback reply', async () => {
  failWith = { models: ['small-model', 'strong-model'], err: Object.assign(new Error('quota'), { status: 429 }) };
  const res = await chat({ text: 'hi' });
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.error, 'quota_exceeded');
  assert.ok(body.reply.speech.length > 0);
  failWith = null;
});
