import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { health } from './routes/health.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // Tailscale Serve forwards from localhost
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60_000, limit: config.rateLimitPerMin, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use(express.json({ limit: '100kb' }));

  app.use(health);
  // Step 1.2: pairing + auth middleware go here; every route below it needs a device token.

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
