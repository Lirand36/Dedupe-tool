import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readAuthEnv } from "./env";
import { createSessionToken, SESSION_TTL_MS, verifySessionToken } from "./session";

export { passwordMatches } from "./session";

export const SESSION_COOKIE = "dedupe_session";

export async function hasSession(): Promise<boolean> {
  const auth = readAuthEnv();
  if (!auth.ok) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(auth.env.sessionSecret, token);
}

/** Call at the top of every protected page, action and route. */
export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect("/login");
}

export async function startSession(sessionSecret: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
