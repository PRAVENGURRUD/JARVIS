// One-time pairing: `npm run pair` creates a code that lives 5 minutes and works once.
// The phone scans it, sends it to POST /pair, and gets back its own device token.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { logAction } from '../log/actionLog.js';
import { getDevices, getPairing, newSecret, safeEqualHex, saveDevices, savePairing, sha256 } from './store.js';

export const PAIRING_TTL_MS = 5 * 60_000;
export const MAX_DEVICES = 3;

export async function createPairingCode() {
  const code = newSecret(24);
  await savePairing({ codeHash: sha256(code), expiresAt: Date.now() + PAIRING_TTL_MS, attempts: 0 });
  await logAction('pairing_code_created');
  return code;
}

export const pairing = Router();

// Very strict limit: guessing is pointless, and this makes it slower still.
pairing.use('/pair', rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }));

pairing.post('/pair', async (req, res, next) => {
  try {
    const { code, deviceName } = req.body ?? {};
    if (typeof code !== 'string' || code.length < 20 || code.length > 100) return res.status(400).json({ error: 'bad_request' });
    const name = typeof deviceName === 'string' ? deviceName.slice(0, 40).replace(/[^\w .-]/g, '') : 'phone';

    const p = await getPairing();
    if (!p || Date.now() > p.expiresAt || p.attempts >= 5) {
      await logAction('pair_rejected', { reason: 'no_active_code' });
      return res.status(403).json({ error: 'pairing_closed' });
    }
    if (!safeEqualHex(sha256(code), p.codeHash)) {
      await savePairing({ ...p, attempts: p.attempts + 1 });
      await logAction('pair_rejected', { reason: 'wrong_code' });
      return res.status(403).json({ error: 'pairing_failed' });
    }

    await savePairing(null); // single use: burn the code immediately
    const devices = await getDevices();
    if (devices.length >= MAX_DEVICES) {
      await logAction('pair_rejected', { reason: 'too_many_devices' });
      return res.status(409).json({ error: 'too_many_devices' });
    }
    const token = newSecret(32);
    const device = { id: newSecret(8), name, tokenHash: sha256(token), pairedAt: new Date().toISOString() };
    await saveDevices([...devices, device]);
    await logAction('device_paired', { deviceId: device.id, name });

    // The token is shown exactly once, to the phone. The server keeps only its hash.
    res.status(201).json({ deviceId: device.id, token });
  } catch (err) {
    next(err);
  }
});
