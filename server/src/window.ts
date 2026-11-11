// WhatsApp customer-service window: free-form messages are allowed for 24 h after the customer's last message.
// Outside it, only approved templates can be sent (Meta error 131047 otherwise).
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WindowState { open: boolean; closesAt: number | null; msLeft: number }

export function windowState(lastInboundAt: number | null | undefined, now = Date.now()): WindowState {
  if (!lastInboundAt) return { open: false, closesAt: null, msLeft: 0 };
  const closesAt = lastInboundAt + WINDOW_MS;
  const msLeft = Math.max(0, closesAt - now);
  return { open: msLeft > 0, closesAt, msLeft };
}

export type SendKind = 'text' | 'document' | 'template';
export type SendDecision = { ok: true; kind: SendKind; reason?: 'window_closed_fallback' } | { ok: false; error: 'window_closed'; detail: string };

/**
 * Decide what can be sent. Inside the window: what staff asked for.
 * Outside: a template (asked for, or as fallback); text/document alone are refused.
 */
export function decideSend(req: { text?: boolean; document?: boolean; template?: boolean; fallbackTemplate?: boolean }, w: WindowState): SendDecision {
  if (req.template) return { ok: true, kind: 'template' };
  if (w.open) return { ok: true, kind: req.document ? 'document' : 'text' };
  if (req.fallbackTemplate) return { ok: true, kind: 'template', reason: 'window_closed_fallback' };
  return { ok: false, error: 'window_closed', detail: 'The 24-hour window is closed. Send an approved template; free text and documents are allowed again after the customer replies.' };
}
