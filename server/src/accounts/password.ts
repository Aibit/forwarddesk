// Password hashing: Argon2id from node:crypto (Node >= 24.7, no native add-on).
// Parameters follow the OWASP minimum (19 MiB memory, 2 passes, 1 lane). Stored as a PHC string.
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

export interface Argon2Params { m: number; t: number; p: number }
export const DEFAULT_PARAMS: Argon2Params = { m: 19456, t: 2, p: 1 };

function derive(pw: string, salt: Buffer, prm: Argon2Params): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', { message: Buffer.from(pw.normalize('NFKC'), 'utf8'), nonce: salt, parallelism: prm.p, tagLength: 32, memory: prm.m, passes: prm.t }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k))));
  });
}
const b64 = (b: Buffer) => b.toString('base64').replace(/=+$/, '');

export async function hashPassword(pw: string, prm: Argon2Params = DEFAULT_PARAMS): Promise<string> {
  const salt = randomBytes(16);
  const k = await derive(pw, salt, prm);
  return `$argon2id$v=19$m=${prm.m},t=${prm.t},p=${prm.p}$${b64(salt)}$${b64(k)}`;
}

export async function verifyPassword(pw: string, phc: string): Promise<boolean> {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(phc);
  if (!m) return false;
  const want = Buffer.from(m[5], 'base64');
  const got = await derive(pw, Buffer.from(m[4], 'base64'), { m: Number(m[1]), t: Number(m[2]), p: Number(m[3]) });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** True when a stored hash uses weaker parameters than today's defaults (re-hash after the next sign-in). */
export function needsRehash(phc: string, prm: Argon2Params = DEFAULT_PARAMS): boolean {
  const m = /m=(\d+),t=(\d+),p=(\d+)/.exec(phc);
  return !m || Number(m[1]) < prm.m || Number(m[2]) < prm.t;
}
