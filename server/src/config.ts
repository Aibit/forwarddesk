// All settings come from environment variables (see .env.example).
export type ProviderName = 'meta' | '360dialog' | 'mock';

export interface Config {
  port: number;
  provider: ProviderName;
  /** Meta: permanent/system-user or temporary access token. 360dialog: D360 API key. */
  token: string;
  /** Meta only: the WhatsApp phone number ID (not the phone number). */
  phoneNumberId: string;
  /** Meta: App secret (signs X-Hub-Signature-256). 360dialog: platform secret (x-360dialog-signature), optional. */
  appSecret: string;
  /** Any string you choose; Meta sends it back during the webhook handshake. */
  verifyToken: string;
  graphVersion: string;
  /** Override the provider base URL (tests point this at the mock Cloud API). */
  apiBase: string;
  /** Bearer key the ForwardDesk app uses for /api/wa/*. */
  apiKey: string;
  corsOrigins: string[];
  dbPath: string;
  mediaDir: string;
  /** Regex that finds a job reference in a message, e.g. FD-E-1042. */
  jobRefRegex: RegExp;
  /** Optional shared header token for 360dialog webhooks when no platform secret is available. */
  webhookHeaderToken: string;
  maxMediaBytes: number;
  // ── Accounts API (sign-up, sessions, workspaces, waitlist) ──
  /** Turn the accounts API on (ACCOUNTS=on). Off by default so a WhatsApp-only install is unchanged. */
  accounts: boolean;
  /** SQLite file for accounts + workspace data (separate from the WhatsApp store). */
  fdDbPath: string;
  /** Public URL of the ForwardDesk app; password-reset and invite links point here. */
  appUrl: string;
  sessionDays: number;
  adminEmails: string[];
  mailAdapter: string;
  /** Extra origins allowed to POST /api/waitlist (the landing page). */
  waitlistOrigins: string[];
  /** Behind Caddy / a load balancer: take the client IP from X-Forwarded-For (for rate limits). */
  trustProxy: boolean;
}

const str = (env: NodeJS.ProcessEnv, k: string, d = '') => (env[k] ?? d).trim();

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const provider = (str(env, 'WA_PROVIDER', 'mock') as ProviderName);
  if (!['meta', '360dialog', 'mock'].includes(provider)) throw new Error(`WA_PROVIDER must be meta, 360dialog or mock (got ${provider})`);
  const graphVersion = str(env, 'WA_GRAPH_VERSION', 'v26.0');
  const defaultBase = provider === '360dialog' ? 'https://waba-v2.360dialog.io' : `https://graph.facebook.com/${graphVersion}`;
  const c: Config = {
    port: Number(str(env, 'PORT', '8080')),
    provider,
    token: str(env, 'WA_TOKEN'),
    phoneNumberId: str(env, 'WA_PHONE_NUMBER_ID'),
    appSecret: str(env, 'WA_APP_SECRET'),
    verifyToken: str(env, 'WA_VERIFY_TOKEN'),
    graphVersion,
    apiBase: str(env, 'WA_API_BASE', defaultBase).replace(/\/$/, ''),
    apiKey: str(env, 'WA_API_KEY'),
    corsOrigins: str(env, 'WA_CORS_ORIGINS', 'https://aibit.github.io,http://localhost:5173,http://localhost:5299').split(',').map((s) => s.trim()).filter(Boolean),
    dbPath: str(env, 'WA_DB_PATH', './data/wa.sqlite'),
    mediaDir: str(env, 'WA_MEDIA_DIR', './data/media'),
    jobRefRegex: new RegExp(str(env, 'WA_JOB_REF_REGEX', '\\b[A-Z]{2,4}-[EI]-\\d{3,6}\\b'), 'i'),
    webhookHeaderToken: str(env, 'WA_WEBHOOK_HEADER_TOKEN'),
    maxMediaBytes: Number(str(env, 'WA_MAX_MEDIA_MB', '100')) * 1024 * 1024,
    accounts: /^(1|on|true|yes)$/i.test(str(env, 'ACCOUNTS', 'off')),
    fdDbPath: str(env, 'FD_DB_PATH', './data/fd.sqlite'),
    appUrl: str(env, 'APP_URL', 'https://aibit.github.io/forwarddesk/'),
    sessionDays: Math.min(90, Math.max(1, Number(str(env, 'SESSION_DAYS', '30')) || 30)),
    adminEmails: str(env, 'ADMIN_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    mailAdapter: str(env, 'MAIL_ADAPTER', 'console'),
    waitlistOrigins: str(env, 'WAITLIST_ORIGINS', 'https://aibit.github.io').split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: /^(1|on|true|yes)$/i.test(str(env, 'TRUST_PROXY', 'off')),
  };
  return c;
}

/** Problems that stop real sending/receiving. Empty list = ready. */
export function configProblems(c: Config): string[] {
  const p: string[] = [];
  if (!c.apiKey) p.push('WA_API_KEY is not set (the app cannot call /api/wa/*)');
  if (c.provider === 'mock') return p;
  if (!c.token) p.push('WA_TOKEN is not set');
  if (c.provider === 'meta' && !c.phoneNumberId) p.push('WA_PHONE_NUMBER_ID is not set');
  if (!c.verifyToken && c.provider === 'meta') p.push('WA_VERIFY_TOKEN is not set (webhook handshake will fail)');
  if (!c.appSecret && !(c.provider === '360dialog' && c.webhookHeaderToken)) p.push('WA_APP_SECRET is not set (webhook signatures cannot be checked; inbound webhooks are rejected)');
  return p;
}
