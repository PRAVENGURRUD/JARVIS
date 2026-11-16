import { Router } from 'express';
import { logAction } from '../log/actionLog.js';
import { BrainError } from '../brain/gemini.js';

// What JARVIS says when the brain can't answer (spoken by the phone).
const FALLBACK = {
  quota_exceeded: {
    display: "Sorry Praveen, my free brain quota is over for now. It resets around 1:30 pm.",
    speech: "Sorry Praveen, my free brain quota is over for now. It resets around 1:30 pm.",
  },
  not_configured: {
    display: 'My Gemini key is not set on the PC yet.',
    speech: 'My Gemini key is not set on the PC yet.',
  },
  model_error: {
    display: 'Something went wrong in my brain. Please try again.',
    speech: 'Something went wrong in my brain. Please try again.',
  },
};

function validate(body) {
  const { text, history = [] } = body ?? {};
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return null;
  if (!Array.isArray(history) || history.length > 20) return null;
  for (const h of history) {
    if (!h || !['user', 'jarvis'].includes(h.role) || typeof h.text !== 'string' || h.text.length > 2000) return null;
  }
  return { text: text.trim(), history: history.map((h) => ({ role: h.role, text: h.text })) };
}

export function chatRoutes(brain) {
  const r = Router();

  r.post('/chat', async (req, res, next) => {
    const input = validate(req.body);
    if (!input) return res.status(400).json({ error: 'bad_request' });
    try {
      const reply = await brain.chat(input);
      // Log WHAT happened, never WHAT was said (privacy).
      await logAction('chat', { deviceId: req.device.id, model: reply.model, lang: reply.lang, inChars: input.text.length });
      res.json({ reply: { display: reply.display, speech: reply.speech, lang: reply.lang }, model: reply.model });
    } catch (err) {
      if (err instanceof BrainError) {
        await logAction('chat_failed', { deviceId: req.device.id, reason: err.code, status: err.status ?? null });
        if (err.code === 'model_error') console.error('[brain]', err.status ?? '', String(err.message).slice(0, 300));
        const status = err.code === 'quota_exceeded' ? 429 : 503;
        return res.status(status).json({ error: err.code, reply: { ...FALLBACK[err.code], lang: 'en' } });
      }
      next(err);
    }
  });

  return r;
}
