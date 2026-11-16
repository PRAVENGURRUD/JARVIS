// Small JSON-file store for pairing codes and paired devices.
// Only SHA-256 HASHES of codes/tokens are saved — never the real values —
// so even if someone copies this file, they can't log in with it.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const devicesFile = () => path.join(config.dataDir, 'devices.json');
const pairingFile = () => path.join(config.dataDir, 'pairing.json');

export const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
export const newSecret = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, file); // write-then-rename so a crash never leaves half a file
}

export const getDevices = () => readJson(devicesFile(), []);
export const saveDevices = (list) => writeJson(devicesFile(), list);
export const getPairing = () => readJson(pairingFile(), null);
export const savePairing = (p) => writeJson(pairingFile(), p);
