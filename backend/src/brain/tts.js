// Text-to-speech with Gemini's TTS model (free tier). Returns WAV audio, or null if it fails,
// in which case the phone speaks with Android's own voice instead.
//
// Google renames TTS models often, so if the configured model is "not found" we ask Google which
// TTS models this API key can use, try them in a sensible order, and remember the one that works.
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

const PREFERRED = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
const isNotFound = (err) => err?.status === 404 || /not found|NOT_FOUND/i.test(err?.message ?? '');

export async function listTtsModels(ai) {
  const names = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      const name = String(m?.name ?? '').replace(/^models\//, '');
      if (/tts/i.test(name)) names.push(name);
    }
  } catch {
    // listing not available: fall back to the built-in list
  }
  return names;
}

export function createTts({ client, model = config.models.tts, voice = config.ttsVoice } = {}) {
  let ai = client;
  let working = null; // model that worked last time
  let discovered = false;
  const dead = new Set(); // names Google said don't exist
  let offUntil = 0; // after a full failure, don't retry TTS for a while (keeps replies fast)
  const OFF_MS = 30 * 60_000;

  async function call(m, text) {
    const it = await ai.interactions.create({
      model: m,
      input: text,
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice }] },
      store: false, // don't keep Praveen's replies on Google's side
    });
    return it?.output_audio?.data ?? null;
  }

  return {
    get model() { return working; },

    /** @returns {Promise<{mimeType: string, data: string} | null>} base64 WAV */
    async speak(text) {
      if (!text || !text.trim()) return null;
      if (!ai) {
        if (!config.geminiApiKey) return null;
        ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      }
      if (Date.now() < offUntil) return null;
      const input = text.slice(0, 1500);
      let candidates = [...new Set([working, model, ...PREFERRED].filter((m) => m && !dead.has(m)))];
      for (let round = 0; round < 2; round++) {
        for (const m of candidates) {
          try {
            const data = await call(m, input);
            if (!data) return null;
            if (working !== m) console.log(`[tts] using model ${m}`);
            working = m;
            return { mimeType: 'audio/wav', data };
          } catch (err) {
            if (!isNotFound(err)) {
              console.error('[tts]', err?.status ?? '', String(err?.message ?? err).slice(0, 200));
              return null; // quota or other error: phone falls back to Android voice
            }
            dead.add(m);
          }
        }
        // Every known name was "not found": ask Google what exists (only once per run).
        if (discovered) break;
        discovered = true;
        const listed = await listTtsModels(ai);
        candidates = listed.filter((m) => !candidates.includes(m) && !dead.has(m));
        if (!candidates.length) break;
        console.log(`[tts] trying models your key offers: ${candidates.join(', ')}`);
      }
      offUntil = Date.now() + OFF_MS;
      console.error('[tts] no working TTS model found; phone will use its own voice (will retry in 30 min)');
      return null;
    },
  };
}
