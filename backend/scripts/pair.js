// Run on the PC:  npm run pair
// Prints a QR code (valid 5 minutes, works once) for the JARVIS app to scan.
import qrcode from 'qrcode-terminal';
import { config } from '../src/config.js';
import { createPairingCode, PAIRING_TTL_MS } from '../src/security/pairing.js';

if (!config.publicUrl) {
  console.error('Set PUBLIC_URL in backend/.env first (your Tailscale address, e.g. https://my-pc.tailXXXX.ts.net).');
  process.exit(1);
}

const code = await createPairingCode();
const payload = JSON.stringify({ v: 1, url: config.publicUrl, code });

qrcode.generate(payload, { small: true }, (qr) => {
  console.log(qr);
  console.log(`Scan this with the JARVIS app. Valid for ${PAIRING_TTL_MS / 60000} minutes, one use only.`);
  console.log('Do not screenshot or share this QR.');
});
