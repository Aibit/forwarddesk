// Input validation for the accounts API. Every function returns a cleaned value or throws HttpError(400).
import { HttpError } from '../service.js';

const bad = (field: string, error = 'invalid') => new HttpError(400, { error, field });
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function email(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (s.length < 6 || s.length > 254 || !EMAIL_RE.test(s)) throw bad('email', 'invalid-email');
  return s;
}
export function password(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8) throw bad('password', 'weak-password');
  if (v.length > 200) throw bad('password', 'password-too-long');
  return v;
}
export function text(v: unknown, field: string, max: number, required = false): string {
  if (v == null || v === '') { if (required) throw bad(field, 'required'); return ''; }
  if (typeof v !== 'string') throw bad(field);
  const s = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (s.length > max) throw bad(field, 'too-long');
  if (required && !s) throw bad(field, 'required');
  return s;
}
export function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[], dflt?: T): T {
  if ((v == null || v === '') && dflt !== undefined) return dflt;
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw bad(field);
  return v as T;
}
export const LANGS = ['en', 'es', 'fa', 'ar'] as const;
export interface Profile { name: string; country: string; baseCurrency: string; ports: string[]; lang: (typeof LANGS)[number] }
export function profile(b: Record<string, unknown>): Profile {
  const cur = text(b.baseCurrency, 'baseCurrency', 3) || 'USD';
  if (!/^[A-Z]{3}$/.test(cur)) throw bad('baseCurrency');
  const ports = Array.isArray(b.ports) ? b.ports.slice(0, 12).map((p, i) => text(p, `ports[${i}]`, 60)).filter(Boolean) : [];
  return { name: text(b.name, 'name', 120, true), country: text(b.country, 'country', 80), baseCurrency: cur, ports, lang: oneOf(b.lang, 'lang', LANGS, 'en') };
}
/** Workspace document paths: 1–4 segments of [A-Za-z0-9_-], e.g. "jobs/FD-E-1042" or "quotes/q1/private/costs". */
export function docPath(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  if (s === '_org') return s;
  if (s.length > 300 || !/^[A-Za-z0-9_.-]{1,120}(\/[A-Za-z0-9_.-]{1,120}){1,3}$/.test(s) || s.split('/').some((x) => x === '.' || x === '..')) throw bad('path');
  return s;
}
export function docData(v: unknown, maxBytes = 900 * 1024): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad('data');
  if (Buffer.byteLength(JSON.stringify(v)) > maxBytes) throw new HttpError(413, { error: 'too_large', field: 'data' });
  return v as Record<string, unknown>;
}

// Waitlist (same fields and limits as the landing page's Firestore rules)
export const SHIPMENTS = ['lt10', '10-50', '50-200', '200-1000', 'gt1000'] as const;
export interface WaitlistEntry { email: string; company: string; role: string; country: string; shipments: string; note: string; source: string; page: string; lang: string }
export function waitlist(b: Record<string, unknown>): WaitlistEntry {
  if (b.consent !== true) throw bad('consent', 'consent-required');
  const allowed = new Set(['email', 'company', 'role', 'country', 'shipments', 'note', 'consent', 'source', 'page', 'lang', 'website', 'elapsedMs']);
  for (const k of Object.keys(b)) if (!allowed.has(k)) throw bad(k, 'unknown-field');
  return {
    email: email(b.email), company: text(b.company, 'company', 120), role: text(b.role, 'role', 80), country: text(b.country, 'country', 80),
    shipments: b.shipments == null || b.shipments === '' ? '' : oneOf(b.shipments, 'shipments', SHIPMENTS),
    note: text(b.note, 'note', 1000), source: b.source == null || b.source === '' ? '' : oneOf(b.source, 'source', ['hero', 'cta'] as const),
    page: text(b.page, 'page', 120), lang: text(b.lang, 'lang', 16),
  };
}
