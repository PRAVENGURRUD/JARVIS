import { createApp } from './app.js';
import { config } from './config.js';
import { logAction } from './log/actionLog.js';

const app = createApp();

app.listen(config.port, config.host, async () => {
  console.log(`JARVIS backend listening on http://${config.host}:${config.port}`);
  await logAction('server_started', { port: config.port });
});
