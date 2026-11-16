import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { health } from './routes/health.js';
import { pairing } from './security/pairing.js';
import { requireDevice } from './security/auth.js';
import { device } from './routes/device.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // Tailscale Serve forwards from localhost
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60_000, limit: config.rateLimitPerMin, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use(express.json({ limit: '100kb' }));

  app.use(health);
  app.use(pairing);

  // ---- Everything below needs a paired device token ----
  app.use(requireDevice);
  app.use(device);

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  // Central error handler: never leak stack traces or internals to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[error]', err.message);
    res.status(status).json({ error: status >= 500 ? 'server_error' : err.expose ? err.message : 'bad_request' });
  });

  return app;
}
