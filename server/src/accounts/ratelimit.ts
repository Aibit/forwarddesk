// Fixed-window in-memory rate limiter (one process). Keys look like "signin:ip:1.2.3.4".
// Good enough for one container; put a shared store behind the same interface if you ever run several.
export interface Rule { limit: number; windowMs: number }
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private now: () => number = Date.now) {}
  /** Counts one hit. Returns 0 when allowed, otherwise the seconds to wait. */
  hit(key: string, r: Rule): number {
    const t = this.now();
    let e = this.hits.get(key);
    if (!e || e.reset <= t) { e = { n: 0, reset: t + r.windowMs }; this.hits.set(key, e); }
    e.n++;
    if (this.hits.size > 50_000) this.sweep();
    return e.n > r.limit ? Math.ceil((e.reset - t) / 1000) : 0;
  }
  /** Peek without counting (e.g. failed-login counters checked before verifying). */
  blocked(key: string, r: Rule): number {
    const e = this.hits.get(key), t = this.now();
    return e && e.reset > t && e.n >= r.limit ? Math.ceil((e.reset - t) / 1000) : 0;
  }
  clear(key: string) { this.hits.delete(key); }
  private sweep() { const t = this.now(); for (const [k, e] of this.hits) if (e.reset <= t) this.hits.delete(k); }
}

const MIN = 60_000;
export const LIMITS = {
  signupIp: { limit: 5, windowMs: 60 * MIN },
  signinIp: { limit: 20, windowMs: 10 * MIN },
  signinFail: { limit: 5, windowMs: 15 * MIN },
  resetIp: { limit: 5, windowMs: 60 * MIN },
  resetConfirmIp: { limit: 20, windowMs: 60 * MIN },
  resetEmail: { limit: 3, windowMs: 60 * MIN },
  joinIp: { limit: 20, windowMs: 10 * MIN },
  waitlistIp: { limit: 5, windowMs: 10 * MIN },
  writeUser: { limit: 600, windowMs: MIN },
} satisfies Record<string, Rule>;
