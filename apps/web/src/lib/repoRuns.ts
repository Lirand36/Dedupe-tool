import "server-only";
import { randomUUID } from "node:crypto";
import type {
  Evidence,
  FieldValue,
  GoldenRecord,
  RunConfig,
  RunResult,
  RunStats,
} from "@dedupe/core";
import { getDb } from "./db";
import type { Decision, Overrides, Tier } from "./insights";
import { chunks, INSERT_CHUNK, json } from "./repoUtil";

export interface RunSummary {
  readonly id: string;
  readonly stats: RunStats;
  readonly config: RunConfig;
  readonly createdAt: Date;
}

type RunRow = { id: string; stats: RunStats; config: RunConfig; created_at: Date };
const toRun = (r: RunRow): RunSummary => ({ ...r, createdAt: new Date(r.created_at) });

export async function createRun(
  datasetId: string,
  config: RunConfig,
  result: RunResult,
): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.query(
    "INSERT INTO runs (id, dataset_id, stats, config) VALUES ($1, $2, $3::text::jsonb, $4::text::jsonb)",
    [id, datasetId, json(result.stats), json(config)],
  );
  for (const chunk of chunks(result.identities, INSERT_CHUNK)) {
    await db.query(
      `INSERT INTO identities (run_id, id, tier, confidence, keep_record_id, remove_record_ids, source_ids, golden, evidence)
       SELECT $1, i->>'id', i->>'tier', (i->>'confidence')::real, i->>'keepRecordId',
              i->'removeRecordIds', i->'sourceIds', i->'golden', i->'evidence'
       FROM jsonb_array_elements($2::text::jsonb) i`,
      [id, json(chunk)],
    );
  }
  return id;
}

export async function listRuns(datasetId: string): Promise<RunSummary[]> {
  const rows = await (await getDb()).query<RunRow>(
    "SELECT id, stats, config, created_at FROM runs WHERE dataset_id = $1 ORDER BY created_at DESC LIMIT 20",
    [datasetId],
  );
  return rows.map(toRun);
}

export async function latestRun(datasetId: string): Promise<RunSummary | null> {
  return (await listRuns(datasetId))[0] ?? null;
}

export interface IdentityRow {
  readonly id: string;
  readonly tier: Tier;
  readonly confidence: number;
  readonly keepRecordId: string;
  readonly removeRecordIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly golden: GoldenRecord;
  readonly evidence: readonly Evidence[];
  readonly decision: Decision;
  readonly overrides: Overrides;
  /** The record that survives the merge. Defaults to the one the engine keeps. */
  readonly masterId: string;
  readonly mergedAt: Date | null;
}

type IdentityDbRow = {
  id: string;
  tier: Tier;
  confidence: number;
  keep_record_id: string;
  remove_record_ids: string[];
  source_ids: string[];
  golden: GoldenRecord;
  evidence: Evidence[];
  decision: Decision;
  overrides: Overrides;
  master_id: string | null;
  merged_at: Date | null;
};

const toIdentity = (r: IdentityDbRow): IdentityRow => ({
  id: r.id,
  tier: r.tier,
  confidence: Number(r.confidence),
  keepRecordId: r.keep_record_id,
  removeRecordIds: r.remove_record_ids,
  sourceIds: r.source_ids,
  golden: r.golden,
  evidence: r.evidence,
  decision: r.decision,
  overrides: r.overrides,
  masterId: r.master_id ?? r.keep_record_id,
  mergedAt: r.merged_at ? new Date(r.merged_at) : null,
});

export async function listIdentities(runId: string): Promise<IdentityRow[]> {
  const rows = await (await getDb()).query<IdentityDbRow>(
    "SELECT * FROM identities WHERE run_id = $1 ORDER BY confidence ASC, id ASC",
    [runId],
  );
  return rows.map(toIdentity);
}

export async function getIdentity(runId: string, id: string): Promise<IdentityRow | null> {
  const [row] = await (await getDb()).query<IdentityDbRow>(
    "SELECT * FROM identities WHERE run_id = $1 AND id = $2",
    [runId, id],
  );
  return row ? toIdentity(row) : null;
}

export async function decideIdentity(runId: string, id: string, decision: Decision): Promise<void> {
  await (await getDb()).query(
    "UPDATE identities SET decision = $3, decided_at = now() WHERE run_id = $1 AND id = $2",
    [runId, id, decision],
  );
}

export async function setOverride(
  runId: string,
  id: string,
  field: string,
  value: FieldValue | null,
): Promise<void> {
  const db = await getDb();
  const sql =
    value === null
      ? "UPDATE identities SET overrides = overrides - $3::text WHERE run_id = $1 AND id = $2"
      : "UPDATE identities SET overrides = overrides || jsonb_build_object($3::text, $4::text::jsonb) WHERE run_id = $1 AND id = $2";
  await db.query(sql, value === null ? [runId, id, field] : [runId, id, field, json(value)]);
}

/** Keeps Inbox decisions when a re-run produces the exact same duplicate group. */
export async function carryOverDecisions(fromRunId: string, toRunId: string): Promise<void> {
  await (await getDb()).query(
    `UPDATE identities n SET decision = o.decision, overrides = o.overrides, decided_at = o.decided_at,
       master_id = o.master_id, merged_at = o.merged_at
     FROM identities o
     WHERE n.run_id = $2 AND o.run_id = $1 AND n.source_ids = o.source_ids`,
    [fromRunId, toRunId],
  );
}

/** Applies one decision to many groups of a run. Merging stamps the time it happened. */
export async function decideIdentities(
  runId: string,
  ids: readonly string[],
  decision: Decision,
): Promise<void> {
  await (await getDb()).query(
    `UPDATE identities SET decision = $3, decided_at = now(),
       merged_at = CASE WHEN $3 = 'merged' THEN now() ELSE NULL END
     WHERE run_id = $1 AND id = ANY($2::text[])`,
    [runId, ids, decision],
  );
}

export async function setMaster(runId: string, id: string, recordId: string): Promise<void> {
  await (await getDb()).query(
    "UPDATE identities SET master_id = $3 WHERE run_id = $1 AND id = $2 AND source_ids ? $3",
    [runId, id, recordId],
  );
}
