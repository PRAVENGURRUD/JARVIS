import express, { Router } from 'express';
import { logAction } from '../log/actionLog.js';
import { BrainError } from '../brain/gemini.js';
import { wavLevel } from '../brain/audioLevel.js';

// What JARVIS says when the brain can't answer (spoken by the phone).
const FALLBACK = {
  quota_exceeded: "Sorry Praveen, my free brain quota is over for now. It resets around 1:30 pm.",
  not_configured: 'My Gemini key is not set on the PC yet.',
  model_error: 'Something went wrong in my brain. Please try again.',
};

const AUDIO_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/mp3', 'audio/mpeg']);
const MAX_AUDIO_B64 = 4 * 1024 * 1024; // ~3 MB of audio ≈ 90 s of 16 kHz WAV

function validHistory(history) {
  if (!Array.isArray(history) || history.length > 20) return null;
  for (const h of history) {
    if (!h || !['user', 'jarvis'].includes(h.role) || typeof h.text !== 'string' || h.text.length > 2000) return null;
  }
  return history.map((h) => ({ role: h.role, text: h.text }));
}

function validateText(body) {
  const { text, history = [], speak = false } = body ?? {};
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return null;
  const h = validHistory(history);
  if (!h) return null;
  return { text: text.trim(), history: h, speak: speak === true };
}

function validateVoice(body) {
  const { audio, history = [], speak = true } = body ?? {};
  if (!audio || typeof audio.data !== 'string' || typeof audio.mimeType !== 'string') return null;
  if (!AUDIO_TYPES.has(audio.mimeType) || audio.data.length < 100 || audio.data.length > MAX_AUDIO_B64) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(audio.data)) return null;
  const h = validHistory(history);
  if (!h) return null;
  return { audio: { mimeType: audio.mimeType === 'audio/x-wav' ? 'audio/wav' : audio.mimeType, data: audio.data }, history: h, speak: speak === true };
}

// A slow voice model must not make the phone give up: after `ms`, reply without audio.
function withTimeout(promise, ms) {
  let t;
  return Promise.race([promise, new Promise((r) => { t = setTimeout(() => r(null), ms); })]).finally(() => clearTimeout(t));
}

export function chatRoutes(brain, tts) {
  const r = Router();

  async function answer(req, res, input, kind) {
    // Voice: measure loudness (numbers only, never the sound) to spot silent or broken recordings.
    const level = input.audio && input.audio.mimeType === 'audio/wav' ? wavLevel(input.audio.data) : null;
    if (level && level.peak !== null && level.peak < 1) {
      await logAction('voice_chat_silent', { deviceId: req.device.id, ...level });
      const msg = "I couldn't hear anything, Praveen. Check that JARVIS has microphone permission and speak a little closer.";
      return res.json({ reply: { display: msg, speech: msg, lang: 'en' }, heard: '', model: null });
    }
    const t0 = Date.now();
    try {
      const reply = await brain.chat(input);
      const brainMs = Date.now() - t0;
      const audio = input.speak && tts ? await withTimeout(tts.speak(reply.speech), 20000) : null;
      // Log WHAT happened, never WHAT was said (privacy).
      await logAction(kind, {
        deviceId: req.device.id, model: reply.model, lang: reply.lang,
        ...(input.text ? { inChars: input.text.length } : { audioKB: Math.round((input.audio.data.length * 3) / 4 / 1024), level }),
        spoken: Boolean(audio),
        ms: { brain: brainMs, total: Date.now() - t0 },
      });
      res.json({
        reply: { display: reply.display, speech: reply.speech, lang: reply.lang },
        ...(input.audio ? { heard: reply.heard } : {}),
        ...(audio ? { audio } : {}),
        model: reply.model,
      });
    } catch (err) {
      if (err instanceof BrainError) {
        await logAction(`${kind}_failed`, { deviceId: req.device.id, reason: err.code, status: err.status ?? null });
        if (err.code === 'model_error') console.error('[brain]', err.status ?? '', String(err.message).slice(0, 300));
        const status = err.code === 'quota_exceeded' ? 429 : 503;
        const msg = FALLBACK[err.code];
        return res.status(status).json({ error: err.code, reply: { display: msg, speech: msg, lang: 'en' } });
      }
      throw err;
    }
  }

  r.post('/chat', async (req, res, next) => {
    const input = validateText(req.body);
    if (!input) return res.status(400).json({ error: 'bad_request' });
    answer(req, res, input, 'chat').catch(next);
  });

  r.post('/chat/voice', express.json({ limit: '5mb' }), async (req, res, next) => {
    const input = validateVoice(req.body);
    if (!input) return res.status(400).json({ error: 'bad_request' });
    answer(req, res, input, 'voice_chat').catch(next);
  });

  return r;
}
