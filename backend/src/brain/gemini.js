// Talks to the Gemini API (free tier) using Google's official SDK.
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { PERSONA, REPLY_SCHEMA } from './persona.js';
import { pickTier } from './router.js';

export class BrainError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code; // 'not_configured' | 'quota_exceeded' | 'model_error'
    this.status = status; // HTTP status from Google, if any (safe to log: no content)
  }
}

function toContents(history, text, audio) {
  const turns = history.map((h) => ({ role: h.role === 'jarvis' ? 'model' : 'user', parts: [{ text: h.text }] }));
  const parts = audio
    ? [{ inlineData: { mimeType: audio.mimeType, data: audio.data } }, { text: '(Voice message from Praveen.)' }]
    : [{ text }];
  return [...turns, { role: 'user', parts }];
}

function parseReply(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Model ignored the JSON format: still say something sensible.
    return { display: String(raw).slice(0, 2000), speech: String(raw).slice(0, 2000), lang: 'en' };
  }
  const display = String(data.display ?? '').slice(0, 2000);
  const speech = String(data.speech ?? display).slice(0, 2000);
  const lang = ['en', 'ta', 'tanglish'].includes(data.lang) ? data.lang : 'en';
  const heard = typeof data.heard === 'string' ? data.heard.slice(0, 2000) : '';
  return { display, speech, lang, heard };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isQuota = (err) => err?.status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(err?.message ?? '');

/** Creates the brain. `client` can be swapped for a fake in tests. */
export function createBrain({ client, models = config.models, retryDelayMs = 800 } = {}) {
  let ai = client;
  const noThinkingCfg = new Set(); // models that rejected the thinking setting

  async function ask(model, contents) {
    if (!ai) {
      if (!config.geminiApiKey) throw new BrainError('not_configured', 'GEMINI_API_KEY missing in backend/.env');
      ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
    const cfg = {
      systemInstruction: PERSONA,
      responseMimeType: 'application/json',
      responseJsonSchema: REPLY_SCHEMA,
      maxOutputTokens: 800,
    };
    // Short spoken replies don't need deep thinking; LOW makes answers much faster.
    if (!noThinkingCfg.has(model)) cfg.thinkingConfig = { thinkingLevel: 'LOW' };
    try {
      const res = await ai.models.generateContent({ model, contents, config: cfg });
      return parseReply(res.text);
    } catch (err) {
      if (cfg.thinkingConfig && err?.status === 400 && /think/i.test(err?.message ?? '')) {
        noThinkingCfg.add(model); // this model doesn't accept it: ask again without
        delete cfg.thinkingConfig;
        const res = await ai.models.generateContent({ model, contents, config: cfg });
        return parseReply(res.text);
      }
      throw err;
    }
  }

  return {
    async chat({ text = '', audio = null, history = [] }) {
      // Voice: always the strong model first — understanding mixed Tamil-English speech is the hard part.
      const tier = audio ? 'strong' : pickTier(text);
      const order = tier === 'strong' ? [models.strong, models.small] : [models.small, models.strong];
      const contents = toContents(history, text, audio);
      // Try: first model, the same model once more after a short pause (brief Google hiccups),
      // then the other model. Quota errors skip straight to the other model.
      const attempts = [order[0], order[0], order[1]];
      let lastErr;
      let allQuota = true;
      for (let i = 0; i < attempts.length; i++) {
        const model = attempts[i];
        if (i === 1 && (lastErr && isQuota(lastErr))) continue; // no point retrying an exhausted model
        try {
          return { ...(await ask(model, contents)), model, tier };
        } catch (err) {
          if (err instanceof BrainError) throw err;
          lastErr = err;
          if (!isQuota(err)) allQuota = false;
          if (i === 0 && !isQuota(err)) await sleep(retryDelayMs);
        }
      }
      if (allQuota) throw new BrainError('quota_exceeded', 'Free Gemini quota used up for now');
      throw new BrainError('model_error', lastErr?.message ?? 'unknown model error', lastErr?.status);
    },
  };
}
