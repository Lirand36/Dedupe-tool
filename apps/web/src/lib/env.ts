import "server-only";

const MIN_PASSWORD_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;

export interface AuthEnv {
  readonly adminPassword: string;
  readonly sessionSecret: string;
}

/** Returns the login settings, or a plain-language list of what is missing. */
export function readAuthEnv(): { ok: true; env: AuthEnv } | { ok: false; problems: string[] } {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const sessionSecret = process.env.SESSION_SECRET ?? "";
  const problems = [
    ...(adminPassword.length < MIN_PASSWORD_LENGTH
      ? [`ADMIN_PASSWORD must be set to at least ${MIN_PASSWORD_LENGTH} characters`]
      : []),
    ...(sessionSecret.length < MIN_SECRET_LENGTH
      ? [`SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`]
      : []),
  ];
  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, env: { adminPassword, sessionSecret } };
}

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}
