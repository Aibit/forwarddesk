import { loadConfig, configProblems } from './config.js';
import { Store } from './store.js';
import { createProvider } from './provider.js';
import { Inbox } from './service.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const store = new Store(cfg.dbPath);
const inbox = new Inbox(cfg, store, createProvider(cfg));
const server = createApp(cfg, inbox);
server.listen(cfg.port, () => {
  console.log(`ForwardDesk WhatsApp service on :${cfg.port} (provider: ${cfg.provider})`);
  for (const p of configProblems(cfg)) console.warn(`  config: ${p}`);
});
const stop = () => { server.close(); store.close(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
