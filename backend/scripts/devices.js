// npm run devices              → list paired phones
// npm run devices -- revoke ID  → unpair a phone (e.g. if it's lost)
import { getDevices, saveDevices } from '../src/security/store.js';
import { logAction } from '../src/log/actionLog.js';

const [cmd, id] = process.argv.slice(2);
const devices = await getDevices();

if (cmd === 'revoke') {
  const left = devices.filter((d) => d.id !== id);
  if (left.length === devices.length) {
    console.error(`No device with id ${id}`);
    process.exit(1);
  }
  await saveDevices(left);
  await logAction('device_revoked', { deviceId: id });
  console.log(`Revoked ${id}. That phone must pair again.`);
} else {
  if (!devices.length) console.log('No paired devices.');
  for (const d of devices) console.log(`${d.id}  ${d.name}  paired ${d.pairedAt}`);
}
