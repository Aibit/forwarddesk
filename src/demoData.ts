/**
 * Demo sample-data version. Bump DEMO_DATA_VERSION when the built-in sample data changes in a way that old copies
 * saved in a visitor's browser should not linger (v2: region-neutral demo, Jebel Ali home port, no researched
 * agent list). On a mismatch the saved SAMPLE data is dropped so it is re-seeded from the new defaults; settings
 * (language, theme, company details, tariffs, sign-in) are kept. Imported first in main.tsx, before any store loads.
 */
export const DEMO_DATA_VERSION = '2';
const VERSION_KEY = 'fd.demodata';
export const DEMO_DATA_KEYS = [
  'fd.clients.v1', 'fd.quotes.v1', 'fd.quoteCosts.v1',
  'fd.jobs.extra.v1', 'fd.jobs.moves.v1',
  'fd.billing.docs.v1', 'fd.billing.ledgers.v1',
  'fd.agentsdb.v1', 'fd.agentact.v1',
  'fd.portal.approvals.v1', 'fd.portal.session',
  'fd.inbox.sample.v1', 'fd.walog.v1',
];

export function migrateDemoData(): boolean {
  try {
    if (typeof localStorage === 'undefined' || localStorage.getItem(VERSION_KEY) === DEMO_DATA_VERSION) return false;
    for (const k of DEMO_DATA_KEYS) localStorage.removeItem(k);
    localStorage.setItem(VERSION_KEY, DEMO_DATA_VERSION);
    return true;
  } catch {
    return false; // private mode / storage blocked: nothing saved to clean up
  }
}
migrateDemoData();
