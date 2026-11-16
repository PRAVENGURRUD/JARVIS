// Reads settings from backend/.env. Secrets live ONLY there (never in git, never in the APK).
import 'dotenv/config';
import { fileURLToPath } from 'node:url';

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be a number`);
  return n;
}

export const config = Object.freeze({
  // Bind to localhost only. Tailscale Serve exposes it to your own devices over HTTPS.
  host: process.env.HOST || '127.0.0.1',
  port: int('PORT', 3000),
  dataDir: process.env.DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url)),
  rateLimitPerMin: int('RATE_LIMIT_PER_MIN', 60),
  // Your Tailscale HTTPS address, put inside the pairing QR (e.g. https://my-pc.tailXXXX.ts.net)
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  // Used from step 1.3 onward:
  geminiApiKey: process.env.GEMINI_API_KEY || '',
});
