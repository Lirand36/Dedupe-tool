export interface RateLimiter {
  /** Returns true when the attempt is allowed, and records it. */
  attempt(key: string, now?: number): boolean;
  reset(key: string): void;
}

/** In-memory fixed-window limiter. Enough for one admin on one instance. */
export function createRateLimiter(maxAttempts: number, windowMs: number): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    attempt(key, now = Date.now()) {
      const current = windows.get(key);
      const window = current && now - current.start < windowMs ? current : { start: now, count: 0 };
      const next = { start: window.start, count: window.count + 1 };
      windows.set(key, next);
      return next.count <= maxAttempts;
    },
    reset(key) {
      windows.delete(key);
    },
  };
}

/**
 * The platform proxy appends the real client address to X-Forwarded-For, so the last entry is the
 * trustworthy one. Earlier entries are whatever the client chose to send.
 */
export function clientIp(forwardedFor: string | null): string {
  const last = forwardedFor?.split(",").at(-1)?.trim();
  return last ? last : "unknown";
}
