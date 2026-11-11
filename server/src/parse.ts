// Parse a WhatsApp Cloud API webhook body (Meta and 360dialog deliver the same structure).
export type InType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contacts' | 'button' | 'interactive' | 'reaction' | 'unsupported';

export interface InboundMessage {
  wamid: string;
  from: string;           // wa_id (E.164 digits)
  profileName: string | null;
  ts: number;             // ms
  type: InType;
  text: string | null;    // body, caption, button text, etc.
  media: { id: string; mime: string | null; filename: string | null; sha256: string | null; url: string | null } | null;
  replyTo: string | null;
  phoneNumberId: string | null;
}
export type StatusName = 'sent' | 'delivered' | 'read' | 'failed';
export interface StatusUpdate {
  wamid: string;
  status: StatusName;
  ts: number;
  recipient: string;
  error: { code: number; title: string; detail: string | null } | null;
}

const MEDIA: InType[] = ['image', 'document', 'audio', 'video', 'sticker'];
const KNOWN: InType[] = ['text', 'image', 'document', 'audio', 'video', 'sticker', 'location', 'contacts', 'button', 'interactive', 'reaction'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function parseWebhook(body: Any): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  if (!body || typeof body !== 'object') return { messages, statuses };
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const ch of Array.isArray(entry?.changes) ? entry.changes : []) {
      const v = ch?.value;
      if (!v || (ch.field && ch.field !== 'messages')) continue;
      const names = new Map<string, string>();
      for (const c of Array.isArray(v.contacts) ? v.contacts : []) if (c?.wa_id) names.set(String(c.wa_id), c?.profile?.name ?? null);
      const pnid = v?.metadata?.phone_number_id ? String(v.metadata.phone_number_id) : null;
      for (const m of Array.isArray(v.messages) ? v.messages : []) {
        if (!m?.id || !m?.from) continue;
        const type: InType = KNOWN.includes(m.type) ? m.type : 'unsupported';
        let text: string | null = null;
        let media: InboundMessage['media'] = null;
        if (type === 'text') text = m.text?.body ?? '';
        else if (MEDIA.includes(type)) {
          const o = m[type] ?? {};
          media = { id: String(o.id ?? ''), mime: o.mime_type ?? null, filename: o.filename ?? null, sha256: o.sha256 ?? null, url: o.url ?? null };
          text = o.caption ?? null;
        } else if (type === 'button') text = m.button?.text ?? null;
        else if (type === 'interactive') text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
        else if (type === 'location') text = [m.location?.name, m.location?.address, m.location ? `${m.location.latitude},${m.location.longitude}` : null].filter(Boolean).join(' · ');
        else if (type === 'reaction') text = m.reaction?.emoji ?? null;
        else if (type === 'contacts') text = (m.contacts ?? []).map((c: Any) => c?.name?.formatted_name).filter(Boolean).join(', ') || null;
        messages.push({
          wamid: String(m.id), from: String(m.from), profileName: names.get(String(m.from)) ?? null,
          ts: Number(m.timestamp) * 1000 || Date.now(), type, text, media, replyTo: m.context?.id ?? null, phoneNumberId: pnid,
        });
      }
      for (const s of Array.isArray(v.statuses) ? v.statuses : []) {
        if (!s?.id || !['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue;
        const e = Array.isArray(s.errors) && s.errors[0] ? s.errors[0] : null;
        statuses.push({
          wamid: String(s.id), status: s.status, ts: Number(s.timestamp) * 1000 || Date.now(), recipient: String(s.recipient_id ?? ''),
          error: e ? { code: Number(e.code), title: String(e.title ?? e.message ?? 'error'), detail: e.error_data?.details ?? null } : null,
        });
      }
    }
  }
  return { messages, statuses };
}

const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };
/** Statuses can arrive out of order; never move backwards (read → delivered). Failed always wins. */
export function nextStatus(cur: string, incoming: StatusName): string {
  if (incoming === 'failed') return 'failed';
  if (cur === 'failed') return cur;
  return (RANK[incoming] ?? 0) > (RANK[cur] ?? 0) ? incoming : cur;
}
