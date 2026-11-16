import { Router } from 'express';
import { readActions } from '../log/actionLog.js';

export const device = Router();

// Lets the app check "am I still paired and is the PC reachable?"
device.get('/whoami', (req, res) => {
  res.json({ device: req.device });
});

// Action log for the in-app log screen (security rule 5).
device.get('/actions', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    res.json({ actions: await readActions(limit) });
  } catch (err) {
    next(err);
  }
});
