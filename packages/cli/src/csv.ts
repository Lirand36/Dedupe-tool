import type { FieldValue, Policy, RunResult, SourceRecord } from "@dedupe/core";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export const ID_COLUMN = "id";
export const CREATED_AT_COLUMN = "createdAt";
export const UPDATED_AT_COLUMN = "updatedAt";
export const RESERVED_COLUMNS: ReadonlySet<string> = new Set([
  ID_COLUMN,
  CREATED_AT_COLUMN,
  UPDATED_AT_COLUMN,
]);
/** Separator for multi-value cells, e.g. "Analytics; Integrations". */
export const LIST_SEPARATOR = ";";

export class CsvError extends Error {
  override readonly name = "CsvError";
}

type Row = Record<string, string>;

export function readRows(text: string): { headers: string[]; rows: Row[] } {
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Row[];
  const firstLine = parse(text, { to_line: 1, trim: true, bom: true }) as string[][];
  return { headers: firstLine[0] ?? [], rows };
}

function cellValue(raw: string, isList: boolean): FieldValue {
  if (raw === "") return null;
  if (!isList) return raw;
  return raw
    .split(LIST_SEPARATOR)
    .map((v) => v.trim())
    .filter((v) => v !== "");
}

function checkDate(value: string | undefined, column: string, line: number): string {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new CsvError(`Row ${line}: "${column}" must be a date (got "${value ?? ""}")`);
  }
  return value;
}

/** Turns CSV text into source records. Fails fast on missing columns or bad dates. */
export function recordsFromCsv(text: string, policy: Policy, system = "csv"): SourceRecord[] {
  const { headers, rows } = readRows(text);
  const missing = [...RESERVED_COLUMNS].filter((c) => !headers.includes(c));
  if (missing.length > 0) throw new CsvError(`Missing required column(s): ${missing.join(", ")}`);
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const line = index + 2;
    const id = row[ID_COLUMN] ?? "";
    if (id === "") throw new CsvError(`Row ${line}: "${ID_COLUMN}" is empty`);
    if (seen.has(id)) throw new CsvError(`Row ${line}: duplicate id "${id}"`);
    seen.add(id);
    const fields = headers
      .filter((h) => !RESERVED_COLUMNS.has(h))
      .map((h) => [h, cellValue(row[h] ?? "", policy.fields[h]?.kind === "combine")] as const);
    return {
      id,
      system,
      createdAt: checkDate(row[CREATED_AT_COLUMN], CREATED_AT_COLUMN, line),
      updatedAt: checkDate(row[UPDATED_AT_COLUMN], UPDATED_AT_COLUMN, line),
      fields: Object.fromEntries(fields),
    };
  });
}

function cellText(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  return Array.isArray(value) ? value.join(`${LIST_SEPARATOR} `) : String(value);
}

/** One row per identity: what to keep, what to remove, the clean values and why each won. */
export function identitiesToCsv(result: RunResult, policy: Policy): string {
  const fields = Object.keys(policy.fields);
  const header = [
    "identity_id",
    "tier",
    "confidence",
    "keep_record_id",
    "remove_record_ids",
    "match_reasons",
    ...fields.flatMap((f) => [f, `${f}__why`]),
  ];
  const rows = result.identities.map((identity) => [
    identity.id,
    identity.tier,
    String(identity.confidence),
    identity.keepRecordId,
    identity.removeRecordIds.join(`${LIST_SEPARATOR} `),
    [...new Set(identity.evidence.map((e) => e.reason))].join(`${LIST_SEPARATOR} `),
    ...fields.flatMap((f) => [
      cellText(identity.golden.values[f]),
      identity.golden.reasons[f]?.text ?? "",
    ]),
  ]);
  return stringify([header, ...rows]);
}
