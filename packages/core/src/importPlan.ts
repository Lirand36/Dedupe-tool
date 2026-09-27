import type { FieldValue, GoldenRecord, SourceRecord } from "./types";
import { compareSlots } from "./values";

/** One output row: the target object's fields plus the CRM Id (empty for new records). */
export type ImportRow = Readonly<Record<string, string>>;

export interface ImportPlanInput {
  readonly importRecords: readonly SourceRecord[];
  /** Existing records of the target object; their ids are CRM ids. */
  readonly crmRecords: readonly SourceRecord[];
  readonly identities: readonly {
    readonly sourceIds: readonly string[];
    readonly golden: GoldenRecord;
    /** Auto groups not rejected, or review groups a person approved. */
    readonly ready: boolean;
  }[];
  /** Output columns, in order. */
  readonly fields: readonly string[];
}

export interface ImportPlan {
  readonly inserts: readonly ImportRow[];
  readonly updates: readonly ImportRow[];
  readonly stats: {
    readonly fileRows: number;
    readonly inserts: number;
    readonly updates: number;
    readonly mergedInFile: number;
    readonly pendingReview: number;
  };
}

function text(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  return Array.isArray(value) ? value.join("; ") : String(value);
}

const bySlot = (r: SourceRecord) => ({ value: null, at: r.createdAt, sourceId: r.id });
const oldestFirst = (a: SourceRecord, b: SourceRecord) => compareSlots(bySlot(a), bySlot(b));

/**
 * Builds one row per field: rule-driven fields take the clean value; other fields keep the base
 * record's value and fall back to the first other record that has one.
 */
function mergedRow(
  base: SourceRecord,
  others: readonly SourceRecord[],
  golden: GoldenRecord,
  fields: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => {
      if (field in golden.values) return [field, text(golden.values[field])];
      const fallback = [base, ...others]
        .map((r) => text(r.fields[field]))
        .find((v) => v.trim() !== "");
      return [field, fallback ?? ""];
    }),
  );
}

function plainRow(record: SourceRecord, fields: readonly string[]): ImportRow {
  return {
    Id: "",
    ...Object.fromEntries(fields.map((f) => [f, text(record.fields[f])])),
    _source_rows: record.id,
    _note: "",
  };
}

/**
 * Turns a deduped import into CRM-ready rows: existing people become updates of their CRM record,
 * everyone else becomes one insert per person. Groups still waiting for review are not merged.
 */
export function planImport(input: ImportPlanInput): ImportPlan {
  const fileOrder = new Map(input.importRecords.map((r, i) => [r.id, i]));
  const crmById = new Map(input.crmRecords.map((r) => [r.id, r]));
  const fileById = new Map(input.importRecords.map((r) => [r.id, r]));
  const merged = new Set<string>();
  const inserts: { order: number; row: ImportRow }[] = [];
  const updates: ImportRow[] = [];
  let pendingReview = 0;

  for (const identity of input.identities) {
    const fileMembers = identity.sourceIds
      .flatMap((id) => fileById.get(id) ?? [])
      .sort(oldestFirst);
    if (fileMembers.length === 0) continue;
    if (!identity.ready) {
      pendingReview++;
      continue;
    }
    const crmMembers = identity.sourceIds.flatMap((id) => crmById.get(id) ?? []).sort(oldestFirst);
    for (const r of fileMembers) merged.add(r.id);
    const sourceRows = fileMembers.map((r) => r.id).join("; ");
    const [target, ...otherCrm] = crmMembers;
    if (target) {
      updates.push({
        Id: target.id,
        ...mergedRow(target, [...otherCrm, ...fileMembers], identity.golden, input.fields),
        _source_rows: sourceRows,
        _note:
          otherCrm.length > 0
            ? `Also matches ${otherCrm.map((r) => r.id).join(", ")} in the CRM`
            : "",
      });
      continue;
    }
    const [base, ...rest] = fileMembers as [SourceRecord, ...SourceRecord[]];
    inserts.push({
      order: Math.min(...fileMembers.map((r) => fileOrder.get(r.id) ?? 0)),
      row: {
        Id: "",
        ...mergedRow(base, rest, identity.golden, input.fields),
        _source_rows: sourceRows,
        _note: "",
      },
    });
  }

  for (const record of input.importRecords) {
    if (!merged.has(record.id))
      inserts.push({ order: fileOrder.get(record.id) ?? 0, row: plainRow(record, input.fields) });
  }
  const sortedInserts = inserts.sort((a, b) => a.order - b.order).map((i) => i.row);
  return {
    inserts: sortedInserts,
    updates,
    stats: {
      fileRows: input.importRecords.length,
      inserts: sortedInserts.length,
      updates: updates.length,
      mergedInFile: input.importRecords.length - sortedInserts.length - updates.length,
      pendingReview,
    },
  };
}
