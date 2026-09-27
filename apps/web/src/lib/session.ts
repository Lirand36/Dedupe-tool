import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function digest(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Token format: "<expiresAtMs>.<hmac>". Stateless, tamper-proof, expires on its own. */
export function createSessionToken(secret: string, now = Date.now()): string {
  const expiresAt = String(now + SESSION_TTL_MS);
  return `${expiresAt}.${signature(secret, expiresAt)}`;
}

export function verifySessionToken(
  secret: string,
  token: string | undefined,
  now = Date.now(),
): boolean {
  const [expiresAt, sig] = token?.split(".") ?? [];
  if (!expiresAt || !sig || Number(expiresAt) <= now) return false;
  return timingSafeEqual(digest(sig), digest(signature(secret, expiresAt)));
}

export function passwordMatches(expected: string, given: string): boolean {
  return timingSafeEqual(digest(expected), digest(given));
}
