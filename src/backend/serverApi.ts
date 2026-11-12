// Tiny fetch wrapper for the self-hosted ForwardDesk API (server/). Session token in localStorage.
import { API_URL } from './config';

const TOKEN = 'fd.token';
export const getToken = () => localStorage.getItem(TOKEN);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN));

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) { super(code); this.code = code; this.status = status; }
}
/** Called when the server says the session is gone (expired, signed out elsewhere, removed from the team). */
export const onUnauthenticated: { f: () => void } = { f: () => undefined };

export async function api<T = unknown>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
  if (!API_URL) throw new ApiError('backend-off', 0);
  let r: Response;
  try {
    const tok = getToken();
    r = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network', 0);
  }
  if (r.ok) return (raw ? r.blob() : r.json()) as Promise<T>;
  let code = `http-${r.status}`;
  try { const j = await r.json() as { error?: string }; if (j.error) code = j.error; } catch { /* not json */ }
  if (r.status === 401 && code === 'unauthenticated') onUnauthenticated.f();
  if (r.status === 403 && code === 'permission-denied') code = 'permission-denied';
  throw new ApiError(code, r.status);
}
