import { Router } from 'express';

export const health = Router();

// Public on purpose: says only "alive", nothing about you or the setup.
health.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
