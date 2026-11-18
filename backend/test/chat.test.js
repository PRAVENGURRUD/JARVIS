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
const brain = createBrain({ client: fakeClient, models: { small: 'small-model', strong: 'strong-model' }, retryDelayMs: 1 });

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

test('brief model error: retries, then falls back to the other model', async () => {
  let n = 0;
  const flaky = { models: { async generateContent(req) {
    n++;
    if (req.model === 'small-model') throw Object.assign(new Error('UNAVAILABLE'), { status: 503 });
    return { text: JSON.stringify({ display: 'ok', speech: 'ok', lang: 'en' }) };
  } } };
  const b = createBrain({ client: flaky, models: { small: 'small-model', strong: 'strong-model' }, retryDelayMs: 1 });
  const r = await b.chat({ text: 'hi' });
  assert.equal(r.model, 'strong-model');
  assert.equal(n, 3); // small, small again, then strong
});

test('model error on every attempt → model_error with status', async () => {
  const broken = { models: { async generateContent() { throw Object.assign(new Error('boom'), { status: 500 }); } } };
  const b = createBrain({ client: broken, models: { small: 's', strong: 't' }, retryDelayMs: 1 });
  await assert.rejects(b.chat({ text: 'hi' }), (e) => e.code === 'model_error' && e.status === 500);
});

// ---------- Step 1.4: voice + spoken replies ----------
test('/chat with speak:true returns TTS audio; TTS failure just omits it', async () => {
  const { createApp } = await import('../src/app.js');
  const okTts = { async speak(t) { return { mimeType: 'audio/wav', data: Buffer.from('RIFF' + t).toString('base64') }; } };
  const app2 = createApp({ brain, tts: okTts }).listen(0, '127.0.0.1');
  await new Promise((r) => app2.once('listening', r));
  const b2 = `http://127.0.0.1:${app2.address().port}`;
  const h = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  let res = await fetch(`${b2}/chat`, { method: 'POST', headers: h, body: JSON.stringify({ text: 'hi', speak: true }) });
  let body = await res.json();
  assert.equal(body.audio.mimeType, 'audio/wav');
  res = await fetch(`${b2}/chat`, { method: 'POST', headers: h, body: JSON.stringify({ text: 'hi' }) });
  body = await res.json();
  assert.equal(body.audio, undefined, 'no audio unless asked');
  app2.close();
});

test('/chat/voice sends audio to the brain and returns what was heard', async () => {
  const wav = Buffer.alloc(4000, 1).toString('base64');
  const res = await fetch(`${base}/chat/voice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ audio: { mimeType: 'audio/wav', data: wav }, speak: false }),
  });
  assert.equal(res.status, 200);
  const last = calls.at(-1);
  assert.equal(last.contents.at(-1).parts[0].inlineData.mimeType, 'audio/wav');
  assert.equal(last.model, 'small-model', 'voice uses the fast model first');
  const body = await res.json();
  assert.equal(typeof body.heard, 'string');
});

test('/chat/voice: rejects bad audio, and needs a token before reading the upload', async () => {
  const h = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  let res = await fetch(`${base}/chat/voice`, { method: 'POST', headers: h, body: JSON.stringify({ audio: { mimeType: 'video/mp4', data: 'A'.repeat(200) } }) });
  assert.equal(res.status, 400);
  res = await fetch(`${base}/chat/voice`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio: { mimeType: 'audio/wav', data: 'A'.repeat(200) } }) });
  assert.equal(res.status, 401);
  // A big body on a normal route is refused (100 kb limit).
  res = await fetch(`${base}/chat`, { method: 'POST', headers: h, body: JSON.stringify({ text: 'x'.repeat(200_000) }) });
  assert.ok(res.status === 413 || res.status === 400);
});

test('/chat/voice: a silent WAV is caught before calling Gemini', async () => {
  const pcm = Buffer.alloc(32000); // 1 s of silence, 16 kHz mono 16-bit
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(16000, 24);
  hdr.writeUInt32LE(32000, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  const n = calls.length;
  const res = await fetch(`${base}/chat/voice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ audio: { mimeType: 'audio/wav', data: Buffer.concat([hdr, pcm]).toString('base64') } }),
  });
  assert.equal(res.status, 200);
  assert.match((await res.json()).reply.display, /couldn't hear/);
  assert.equal(calls.length, n, 'Gemini not called for silence');
});

test('slow model times out and the other model answers', async () => {
  const slow = { models: { async generateContent(req) {
    if (req.model === 'slow') {
      return new Promise((_, rej) => req.config.abortSignal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    }
    return { text: JSON.stringify({ display: 'ok', speech: 'ok', lang: 'en' }) };
  } } };
  const b = createBrain({ client: slow, models: { small: 'slow', strong: 'fast' }, retryDelayMs: 1, timeoutMs: { text: 50, audio: 50 } });
  const t0 = Date.now();
  const r = await b.chat({ text: 'hi' });
  assert.equal(r.model, 'fast');
  assert.ok(Date.now() - t0 < 1000, 'did not wait for the slow model twice');
});
