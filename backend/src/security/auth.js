// Gatekeeper: every route mounted after this needs "Authorization: Bearer <device token>".
import { logAction } from '../log/actionLog.js';
import { getDevices, safeEqualHex, sha256 } from './store.js';

export async function requireDevice(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const match = /^Bearer ([\w-]{20,100})$/.exec(header);
    if (!match) return deny(req, res, 'missing_token');

    const hash = sha256(match[1]);
    const device = (await getDevices()).find((d) => safeEqualHex(d.tokenHash, hash));
    if (!device) return deny(req, res, 'unknown_token');

    req.device = { id: device.id, name: device.name };
    next();
  } catch (err) {
    next(err);
  }
}

async function deny(req, res, reason) {
  await logAction('auth_rejected', { reason, path: req.path });
  res.status(401).json({ error: 'unauthorized' });
}
