import "server-only";
import { randomUUID } from "node:crypto";
import type { RawRecord } from "@dedupe/cli/csv";
import type { ColumnMap } from "@dedupe/core";
import { getDb } from "./db";
import { chunks, INSERT_CHUNK, json } from "./repoUtil";

/** A CRM snapshot is the current data of an object; an import is a file on its way into it. */
export type DatasetKind = "crm" | "import";
export type DatasetStatus = "mapping" | "ready";

export interface DatasetSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: DatasetKind;
  readonly status: DatasetStatus;
  readonly entity: "person" | "company";
  readonly objectType: string;
  /** Columns of the uploaded file, before mapping. */
  readonly headers: readonly string[];
  readonly columnMap: ColumnMap | null;
  /** Object fields after mapping. */
  readonly fieldColumns: readonly string[];
  readonly recordCount: number;
  readonly createdAt: Date;
}

type DatasetRow = {
  id: string;
  name: string;
  kind: DatasetKind;
  status: DatasetStatus;
  entity: "person" | "company";
  object_type: string;
  headers: string[];
  column_map: ColumnMap | null;
  field_columns: string[];
  record_count: number;
  created_at: Date;
};

const toDataset = (r: DatasetRow): DatasetSummary => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  status: r.status,
  entity: r.entity,
  objectType: r.object_type,
  headers: r.headers,
  columnMap: r.column_map,
  fieldColumns: r.field_columns,
  recordCount: r.record_count,
  createdAt: new Date(r.created_at),
});

async function insertRecords(datasetId: string, rows: readonly RawRecord[]): Promise<void> {
  const db = await getDb();
  for (const chunk of chunks(rows, INSERT_CHUNK)) {
    await db.query(
      `INSERT INTO dataset_records (dataset_id, id, created_at, updated_at, cells)
       SELECT $1, r->>'id', r->>'createdAt', r->>'updatedAt', r->'cells' FROM jsonb_array_elements($2::text::jsonb) r`,
      [datasetId, json(chunk)],
    );
  }
}

/** Stores an uploaded file as-is (original headers). It becomes usable once its columns are mapped. */
export async function createUpload(input: {
  name: string;
  kind: DatasetKind;
  entity: "person" | "company";
  objectType: string;
  headers: readonly string[];
  rows: readonly RawRecord[];
}): Promise<string> {
  const id = randomUUID();
  await (await getDb()).query(
    `INSERT INTO datasets (id, name, kind, status, entity, object_type, headers, field_columns, record_count)
     VALUES ($1, $2, $3, 'mapping', $4, $5, $6::text::jsonb, $6::text::jsonb, $7)`,
    [
      id,
      input.name,
      input.kind,
      input.entity,
      input.objectType,
      json(input.headers),
      input.rows.length,
    ],
  );
  await insertRecords(id, input.rows);
  return id;
}

/** Replaces the raw rows with mapped records and marks the dataset ready. */
export async function applyMapping(
  datasetId: string,
  columnMap: ColumnMap,
  fieldColumns: readonly string[],
  rows: readonly RawRecord[],
): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM dataset_records WHERE dataset_id = $1", [datasetId]);
  await insertRecords(datasetId, rows);
  await db.query(
    `UPDATE datasets SET status = 'ready', column_map = $2::text::jsonb, field_columns = $3::text::jsonb, record_count = $4
     WHERE id = $1`,
    [datasetId, json(columnMap), json(fieldColumns), rows.length],
  );
}

export async function listDatasets(kind?: DatasetKind): Promise<DatasetSummary[]> {
  const db = await getDb();
  const rows = kind
    ? await db.query<DatasetRow>(
        "SELECT * FROM datasets WHERE kind = $1 ORDER BY created_at DESC",
        [kind],
      )
    : await db.query<DatasetRow>("SELECT * FROM datasets ORDER BY created_at DESC");
  return rows.map(toDataset);
}

export async function getDataset(id: string): Promise<DatasetSummary | null> {
  const [row] = await (await getDb()).query<DatasetRow>("SELECT * FROM datasets WHERE id = $1", [
    id,
  ]);
  return row ? toDataset(row) : null;
}

/** The object's current CRM data: the newest ready snapshot. */
export async function crmSnapshot(objectType: string): Promise<DatasetSummary | null> {
  const [row] = await (await getDb()).query<DatasetRow>(
    `SELECT * FROM datasets WHERE kind = 'crm' AND status = 'ready' AND object_type = $1
     ORDER BY created_at DESC LIMIT 1`,
    [objectType],
  );
  return row ? toDataset(row) : null;
}

/** A new CRM export replaces the old one, so an object never has two versions of the truth. */
export async function deleteOtherSnapshots(objectType: string, keepId: string): Promise<void> {
  await (await getDb()).query(
    "DELETE FROM datasets WHERE kind = 'crm' AND object_type = $1 AND id <> $2",
    [objectType, keepId],
  );
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

const MAX_SAMPLE_VALUES = 50;

/** Distinct non-empty values per column, used to build channels and stage rankings from real data. */
export async function sampleValues(datasetId: string): Promise<Record<string, string[]>> {
  const rows = await (await getDb()).query<{ key: string; vals: string[] }>(
    `SELECT e.key, (array_agg(DISTINCT e.value))[1:${MAX_SAMPLE_VALUES}] AS vals
     FROM dataset_records r, jsonb_each_text(r.cells) e
     WHERE r.dataset_id = $1 AND e.value <> ''
     GROUP BY e.key`,
    [datasetId],
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.vals]));
}

/** Records whose id or any cell contains the query (case-insensitive). */
export async function searchRecords(
  datasetId: string,
  query: string,
  limit = 20,
): Promise<RawRecord[]> {
  const rows = await (await getDb()).query<{
    id: string;
    created_at: string;
    updated_at: string;
    cells: Record<string, string>;
  }>(
    `SELECT id, created_at, updated_at, cells FROM dataset_records
     WHERE dataset_id = $1 AND (id ILIKE $2 OR cells::text ILIKE $2)
     ORDER BY id LIMIT $3`,
    [datasetId, `%${query.replace(/[%_\\]/g, "\\$&")}%`, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cells: r.cells,
  }));
}

export async function getRecordsByIds(
  datasetId: string,
  ids: readonly string[],
): Promise<RawRecord[]> {
  const rows = await (await getDb()).query<{
    id: string;
    created_at: string;
    updated_at: string;
    cells: Record<string, string>;
  }>(
    "SELECT id, created_at, updated_at, cells FROM dataset_records WHERE dataset_id = $1 AND id = ANY($2::text[])",
    [datasetId, ids],
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cells: r.cells,
  }));
}
