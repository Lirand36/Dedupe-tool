import "server-only";
import { randomUUID } from "node:crypto";
import type { FieldValue, RunConfig, SourceRecord } from "@dedupe/core";
import { getDb } from "./db";
import type { MergeSchedule } from "./groups";
import { json } from "./repoUtil";

/** An object (e.g. Salesforce Contacts) owns its rules; CRM data and imports into it share them. */
export interface ObjectRow {
  readonly objectType: string;
  readonly config: RunConfig;
  /** Every field seen on this object so far (standard and custom). */
  readonly fields: readonly string[];
  readonly schedule: MergeSchedule | null;
  readonly updatedAt: Date;
}

type ObjectDbRow = {
  object_type: string;
  config: RunConfig;
  fields: string[];
  schedule: MergeSchedule | null;
  updated_at: Date;
};
const toObject = (r: ObjectDbRow): ObjectRow => ({
  objectType: r.object_type,
  config: r.config,
  fields: r.fields,
  schedule: r.schedule,
  updatedAt: new Date(r.updated_at),
});

export async function getObject(objectType: string): Promise<ObjectRow | null> {
  const [row] = await (await getDb()).query<ObjectDbRow>(
    "SELECT * FROM objects WHERE object_type = $1",
    [objectType],
  );
  return row ? toObject(row) : null;
}

export async function listObjects(): Promise<ObjectRow[]> {
  return (
    await (await getDb()).query<ObjectDbRow>("SELECT * FROM objects ORDER BY object_type")
  ).map(toObject);
}

export async function saveObject(
  objectType: string,
  config: RunConfig,
  fields: readonly string[],
): Promise<void> {
  await (await getDb()).query(
    `INSERT INTO objects (object_type, config, fields) VALUES ($1, $2::text::jsonb, $3::text::jsonb)
     ON CONFLICT (object_type) DO UPDATE SET config = EXCLUDED.config, fields = EXCLUDED.fields, updated_at = now()`,
    [objectType, json(config), json(fields)],
  );
}

/** The rules that apply to a dataset: those of the object it belongs to. */
export async function getConfig(datasetId: string): Promise<RunConfig | null> {
  const [row] = await (await getDb()).query<{ config: RunConfig }>(
    "SELECT o.config FROM objects o JOIN datasets d ON d.object_type = o.object_type WHERE d.id = $1",
    [datasetId],
  );
  return row?.config ?? null;
}

export interface ExampleRow {
  readonly id: string;
  readonly name: string;
  readonly records: readonly SourceRecord[];
  readonly expected: Readonly<Record<string, FieldValue>>;
  readonly createdAt: Date;
}

export async function createExample(
  objectType: string,
  example: { name: string; records: readonly SourceRecord[]; expected: Record<string, FieldValue> },
): Promise<void> {
  await (await getDb()).query(
    "INSERT INTO examples (id, object_type, name, records, expected) VALUES ($1, $2, $3, $4::text::jsonb, $5::text::jsonb)",
    [randomUUID(), objectType, example.name, json(example.records), json(example.expected)],
  );
}

export async function listExamples(objectType: string): Promise<ExampleRow[]> {
  const rows = await (await getDb()).query<{
    id: string;
    name: string;
    records: SourceRecord[];
    expected: Record<string, FieldValue>;
    created_at: Date;
  }>("SELECT * FROM examples WHERE object_type = $1 ORDER BY created_at DESC", [objectType]);
  return rows.map((r) => ({ ...r, createdAt: new Date(r.created_at) }));
}

export async function deleteExample(id: string): Promise<void> {
  await (await getDb()).query("DELETE FROM examples WHERE id = $1", [id]);
}

export type EventKind = "upload" | "run" | "rules" | "decision" | "example" | "export";

export interface EventRow {
  readonly id: string;
  readonly kind: EventKind;
  readonly summary: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

/** Appends to an object's history. `datasetId` is set when the event concerns one CRM export or import. */
export async function logEvent(
  target: { objectType: string; datasetId?: string | null },
  kind: EventKind,
  summary: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await (await getDb()).query(
    `INSERT INTO events (id, object_type, dataset_id, kind, summary, detail)
     VALUES ($1, $2, $3, $4, $5, $6::text::jsonb)`,
    [randomUUID(), target.objectType, target.datasetId ?? null, kind, summary, json(detail)],
  );
}

export async function listEvents(objectType: string, limit = 200): Promise<EventRow[]> {
  const rows = await (await getDb()).query<{
    id: string;
    kind: EventKind;
    summary: string;
    detail: Record<string, unknown>;
    created_at: Date;
  }>("SELECT * FROM events WHERE object_type = $1 ORDER BY created_at DESC LIMIT $2", [
    objectType,
    limit,
  ]);
  return rows.map((r) => ({ ...r, createdAt: new Date(r.created_at) }));
}

export async function countEvents(objectType: string): Promise<Record<EventKind, number>> {
  const rows = await (await getDb()).query<{ kind: EventKind; n: string | number }>(
    "SELECT kind, count(*) AS n FROM events WHERE object_type = $1 GROUP BY kind",
    [objectType],
  );
  const counts = { upload: 0, run: 0, rules: 0, decision: 0, example: 0, export: 0 };
  return { ...counts, ...Object.fromEntries(rows.map((r) => [r.kind, Number(r.n)])) };
}

export async function saveSchedule(objectType: string, schedule: MergeSchedule): Promise<void> {
  await (await getDb()).query(
    "UPDATE objects SET schedule = $2::text::jsonb WHERE object_type = $1",
    [objectType, json(schedule)],
  );
}
