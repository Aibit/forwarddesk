import { loadConfig, configProblems } from './config.js';
import { Store } from './store.js';
import { createProvider } from './provider.js';
import { Inbox } from './service.js';
import { createApp } from './app.js';
import { AccountsDb } from './accounts/db.js';
import { Accounts } from './accounts/service.js';
import { createMailer } from './accounts/mailer.js';

const cfg = loadConfig();
const store = new Store(cfg.dbPath);
const inbox = new Inbox(cfg, store, createProvider(cfg));
const adb = cfg.accounts ? new AccountsDb(cfg.fdDbPath) : null;
const accounts = adb ? new Accounts(adb, createMailer(cfg.mailAdapter), { appUrl: cfg.appUrl, sessionDays: cfg.sessionDays, adminEmails: cfg.adminEmails }) : null;
if (adb) setInterval(() => adb.purgeExpired(Date.now()), 6 * 3600_000).unref();
const server = createApp(cfg, inbox, accounts);
server.listen(cfg.port, () => {
  console.log(`ForwardDesk service on :${cfg.port} (WhatsApp provider: ${cfg.provider}; accounts: ${accounts ? `on, mail: ${accounts.mailer.name}` : 'off'})`);
  for (const p of configProblems(cfg)) console.warn(`  config: ${p}`);
});
const stop = () => { server.close(); store.close(); adb?.close(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
