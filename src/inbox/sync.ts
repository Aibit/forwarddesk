// Sends client/agent phone numbers and job IDs to the WhatsApp service so it can auto-link conversations.
import { getStore } from '../clients/store';
import { agentsDb } from '../agents/db';
import { getJobs } from '../jobs/store';
import { waNumberOf } from '../whatsapp/phone';
import type { DirEntry, InboxBackend } from './backend';

export function directory(): { entries: DirEntry[]; jobs: string[] } {
  const entries: DirEntry[] = [];
  for (const c of getStore().clients) {
    const phones = [c.phone, c.whatsapp, c.clearanceAgent?.phone, c.clearanceAgent?.whatsapp, c.bandarAbbas?.phone, c.bandarAbbas?.whatsapp].filter((x): x is string => !!x && !!x.trim());
    if (phones.length) entries.push({ kind: 'client', id: c.id, name: c.name, contact: c.contactName || undefined, phones });
  }
  for (const a of agentsDb.get().list) {
    if (a.archived) continue;
    const phones = [a.phone, waNumberOf(a), ...(a.contacts ?? []).flatMap((x) => [x.phone, x.whatsapp])].filter((x): x is string => !!x && !!x.trim());
    if (phones.length) entries.push({ kind: 'agent', id: a.id, name: a.name, phones: [...new Set(phones)] });
  }
  return { entries, jobs: getJobs().map((j) => j.id) };
}

let last = '';
export async function syncDirectory(b: InboxBackend) {
  if (b.kind !== 'server') return;
  const d = directory();
  const sig = JSON.stringify(d);
  if (sig === last) return;
  await b.syncDirectory(d.entries, d.jobs);
  last = sig;
}
