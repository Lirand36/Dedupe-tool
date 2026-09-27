import "server-only";
import { databaseUrl } from "./env";
import { MIGRATIONS } from "./migrations";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

const LOCAL_DATA_DIR = ".data/pglite";

async function connectPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 5, onnotice: () => {} });
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as T[],
  };
}

/** Embedded Postgres for local development: no install, same SQL as production. */
async function connectPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(LOCAL_DATA_DIR, { recursive: true });
  const pg = await PGlite.create(LOCAL_DATA_DIR);
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await pg.query<T>(text, params as unknown[])).rows,
  };
}

async function migrate(db: Db): Promise<void> {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Set(
    (await db.query<{ version: number }>("SELECT version FROM schema_migrations")).map(
      (r) => r.version,
    ),
  );
  for (const [index, statements] of MIGRATIONS.entries()) {
    const version = index + 1;
    if (applied.has(version)) continue;
    for (const statement of statements) await db.query(statement);
    await db.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
  }
}

const globalForDb = globalThis as unknown as { dedupeDb?: Promise<Db> | undefined };

/** One shared, migrated connection per server process (survives dev hot reloads). */
export function getDb(): Promise<Db> {
  if (!globalForDb.dedupeDb) {
    const url = databaseUrl();
    if (!url && process.env.NODE_ENV === "production") {
      // The embedded database writes to local disk, which hosting platforms wipe on every deploy.
      return Promise.reject(new Error("DATABASE_URL must be set in production"));
    }
    globalForDb.dedupeDb = (url ? connectPostgres(url) : connectPglite()).then(async (db) => {
      await migrate(db);
      return db;
    });
    globalForDb.dedupeDb.catch(() => {
      globalForDb.dedupeDb = undefined;
    });
  }
  return globalForDb.dedupeDb;
}
