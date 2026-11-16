import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTts } from '../src/brain/tts.js';

test('TTS calls the Interactions API with audio/wav, store:false, chosen voice', async () => {
  let seen;
  const client = { interactions: { async create(p) { seen = p; return { output_audio: { data: 'UklGRg==' } }; } } };
  const tts = createTts({ client, model: 'tts-model', voice: 'Charon' });
  const out = await tts.speak('வணக்கம் Praveen');
  assert.deepEqual(out, { mimeType: 'audio/wav', data: 'UklGRg==' });
  assert.equal(seen.model, 'tts-model');
  assert.equal(seen.store, false);
  assert.equal(seen.response_format.mime_type, 'audio/wav');
  assert.equal(seen.generation_config.speech_config[0].voice, 'Charon');
});

test('TTS failure returns null (phone falls back to Android voice)', async () => {
  const client = { interactions: { async create() { throw Object.assign(new Error('quota'), { status: 429 }); } } };
  assert.equal(await createTts({ client }).speak('hi'), null);
  assert.equal(await createTts({ client }).speak('  '), null);
});

test('TTS: unknown model name → tries others, then models your key lists, and remembers', async () => {
  const tried = [];
  const client = {
    interactions: { async create(p) { tried.push(p.model); if (p.model !== 'gemini-9-tts') throw Object.assign(new Error('not found'), { status: 404 }); return { output_audio: { data: 'UklGRg==' } }; } },
    models: { async list() { return (async function* () { yield { name: 'models/gemini-9-tts' }; yield { name: 'models/gemini-9-flash' }; })(); } },
  };
  const tts = createTts({ client, model: 'bad-tts' });
  assert.deepEqual(await tts.speak('hi'), { mimeType: 'audio/wav', data: 'UklGRg==' });
  assert.equal(tts.model, 'gemini-9-tts');
  const n = tried.length;
  await tts.speak('again');
  assert.equal(tried.length, n + 1, 'second time goes straight to the working model');
});

test('TTS: after finding no working model, stays off (fast) instead of retrying every reply', async () => {
  let calls = 0;
  const client = {
    interactions: { async create() { calls++; throw Object.assign(new Error('not found'), { status: 404 }); } },
    models: { async list() { return (async function* () {})(); } },
  };
  const tts = createTts({ client, model: 'x-tts' });
  assert.equal(await tts.speak('hi'), null);
  const n = calls;
  assert.equal(await tts.speak('again'), null);
  assert.equal(calls, n, 'no more calls while switched off');
});
