import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta signs the raw webhook body with the App secret: X-Hub-Signature-256: sha256=<hex>.
 * 360dialog (partner webhooks) signs it with the platform secret: x-360dialog-signature: <hex>.
 * Always compare in constant time over the RAW bytes (never re-serialised JSON).
 */
export function sign(raw: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

export function verifySignature(raw: Buffer | string, header: string | undefined | null, secret: string): boolean {
  if (!secret || !header) return false;
  const got = header.trim().replace(/^sha256=/i, '');
  if (!/^[0-9a-f]{64}$/i.test(got)) return false;
  const want = sign(raw, secret);
  return timingSafeEqual(Buffer.from(got.toLowerCase(), 'hex'), Buffer.from(want, 'hex'));
}
