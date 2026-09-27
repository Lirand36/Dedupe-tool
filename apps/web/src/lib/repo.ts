import "server-only";
import { randomUUID } from "node:crypto";
import type { RawRecord } from "@dedupe/cli/csv";
import type {
  Evidence,
  FieldValue,
  GoldenRecord,
  RunConfig,
  RunResult,
  RunStats,
  SourceRecord,
} from "@dedupe/core";
import { getDb } from "./db";
import type { Decision, Overrides, Tier } from "./insights";

const INSERT_CHUNK = 2000;

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}

const json = (value: unknown) => JSON.stringify(value);

export interface DatasetSummary {
  readonly id: string;
  readonly name: string;
  readonly entity: "person" | "company";
  readonly fieldColumns: readonly string[];
  readonly recordCount: number;
  readonly createdAt: Date;
}

type DatasetRow = {
  id: string;
  name: string;
  entity: "person" | "company";
  field_columns: string[];
  record_count: number;
  created_at: Date;
};

const toDataset = (r: DatasetRow): DatasetSummary => ({
  id: r.id,
  name: r.name,
  entity: r.entity,
  fieldColumns: r.field_columns,
  recordCount: r.record_count,
  createdAt: new Date(r.created_at),
});

export async function createDataset(input: {
  name: string;
  entity: "person" | "company";
  fieldColumns: readonly string[];
  rows: readonly RawRecord[];
  config: RunConfig;
}): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.query(
    "INSERT INTO datasets (id, name, entity, field_columns, record_count) VALUES ($1, $2, $3, $4::jsonb, $5)",
    [id, input.name, input.entity, json(input.fieldColumns), input.rows.length],
  );
  for (const chunk of chunks(input.rows, INSERT_CHUNK)) {
    await db.query(
      `INSERT INTO dataset_records (dataset_id, id, created_at, updated_at, cells)
       SELECT $1, r->>'id', r->>'createdAt', r->>'updatedAt', r->'cells' FROM jsonb_array_elements($2::jsonb) r`,
      [id, json(chunk)],
    );
  }
  await db.query("INSERT INTO configs (dataset_id, config) VALUES ($1, $2::jsonb)", [
    id,
    json(input.config),
  ]);
  return id;
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const db = await getDb();
  return (await db.query<DatasetRow>("SELECT * FROM datasets ORDER BY created_at DESC")).map(
    toDataset,
  );
}

export async function getDataset(id: string): Promise<DatasetSummary | null> {
  const db = await getDb();
  const [row] = await db.query<DatasetRow>("SELECT * FROM datasets WHERE id = $1", [id]);
  return row ? toDataset(row) : null;
}

export async function deleteDataset(id: string): Promise<void> {
  await (await getDb()).query("DELETE FROM datasets WHERE id = $1", [id]);
}

export async function getRecords(datasetId: string): Promise<RawRecord[]> {
  const rows = await (await getDb()).query<{
    id: string;
    created_at: string;
    updated_at: string;
    cells: Record<string, string>;
  }>(
    "SELECT id, created_at, updated_at, cells FROM dataset_records WHERE dataset_id = $1 ORDER BY id",
    [datasetId],
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cells: r.cells,
  }));
}

export async function getConfig(datasetId: string): Promise<RunConfig | null> {
  const [row] = await (await getDb()).query<{ config: RunConfig }>(
    "SELECT config FROM configs WHERE dataset_id = $1",
    [datasetId],
  );
  return row?.config ?? null;
}

export async function saveConfig(datasetId: string, config: RunConfig): Promise<void> {
  await (await getDb()).query(
    `INSERT INTO configs (dataset_id, config) VALUES ($1, $2::jsonb)
     ON CONFLICT (dataset_id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
    [datasetId, json(config)],
  );
}

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
    "INSERT INTO runs (id, dataset_id, stats, config) VALUES ($1, $2, $3::jsonb, $4::jsonb)",
    [id, datasetId, json(result.stats), json(config)],
  );
  for (const chunk of chunks(result.identities, INSERT_CHUNK)) {
    await db.query(
      `INSERT INTO identities (run_id, id, tier, confidence, keep_record_id, remove_record_ids, source_ids, golden, evidence)
       SELECT $1, i->>'id', i->>'tier', (i->>'confidence')::real, i->>'keepRecordId',
              i->'removeRecordIds', i->'sourceIds', i->'golden', i->'evidence'
       FROM jsonb_array_elements($2::jsonb) i`,
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
      : "UPDATE identities SET overrides = overrides || jsonb_build_object($3::text, $4::jsonb) WHERE run_id = $1 AND id = $2";
  await db.query(sql, value === null ? [runId, id, field] : [runId, id, field, json(value)]);
}

export interface ExampleRow {
  readonly id: string;
  readonly name: string;
  readonly records: readonly SourceRecord[];
  readonly expected: Readonly<Record<string, FieldValue>>;
  readonly createdAt: Date;
}

export async function createExample(
  datasetId: string,
  example: { name: string; records: readonly SourceRecord[]; expected: Record<string, FieldValue> },
): Promise<void> {
  await (await getDb()).query(
    "INSERT INTO examples (id, dataset_id, name, records, expected) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)",
    [randomUUID(), datasetId, example.name, json(example.records), json(example.expected)],
  );
}

export async function listExamples(datasetId: string): Promise<ExampleRow[]> {
  const rows = await (await getDb()).query<{
    id: string;
    name: string;
    records: SourceRecord[];
    expected: Record<string, FieldValue>;
    created_at: Date;
  }>("SELECT * FROM examples WHERE dataset_id = $1 ORDER BY created_at DESC", [datasetId]);
  return rows.map((r) => ({ ...r, createdAt: new Date(r.created_at) }));
}

export async function deleteExample(id: string): Promise<void> {
  await (await getDb()).query("DELETE FROM examples WHERE id = $1", [id]);
}

/** Keeps Inbox decisions when a re-run produces the exact same duplicate group. */
export async function carryOverDecisions(fromRunId: string, toRunId: string): Promise<void> {
  await (await getDb()).query(
    `UPDATE identities n SET decision = o.decision, overrides = o.overrides, decided_at = o.decided_at
     FROM identities o
     WHERE n.run_id = $2 AND o.run_id = $1 AND n.source_ids = o.source_ids`,
    [fromRunId, toRunId],
  );
}
