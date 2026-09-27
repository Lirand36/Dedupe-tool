import type { RawRecord } from "@dedupe/cli/csv";
import type { FieldValue, Policy } from "@dedupe/core";
import { applyOverrides, type Overrides } from "./insights";

export interface ComparisonCell {
  readonly recordId: string;
  readonly text: string;
  readonly isWinner: boolean;
}

export interface ComparisonRow {
  readonly field: string;
  readonly tagged: boolean;
  readonly cells: readonly ComparisonCell[];
  readonly clean: {
    readonly text: string;
    readonly reason: string;
    readonly overridden: boolean;
  } | null;
}

export function valueText(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  return Array.isArray(value) ? value.join("; ") : String(value);
}

/**
 * Side-by-side view for the Inbox: one row per field, one column per duplicate record, plus the
 * clean value and why it won. Tagged fields first; untagged fields stay as on the kept record.
 */
export function buildComparison(
  records: readonly RawRecord[],
  fieldColumns: readonly string[],
  policy: Policy,
  golden: Parameters<typeof applyOverrides>[0],
  overrides: Overrides,
): ComparisonRow[] {
  const final = applyOverrides(golden, overrides);
  const tagged = fieldColumns.filter((f) => f in policy.fields);
  const untagged = fieldColumns.filter((f) => !(f in policy.fields));
  const row = (field: string, isTagged: boolean): ComparisonRow => {
    const reason = final.reasons[field];
    const cleanText = valueText(final.values[field]);
    return {
      field,
      tagged: isTagged,
      cells: records.map((r) => {
        const text = r.cells[field] ?? "";
        const isWinner =
          isTagged && (reason?.sourceId === r.id || (cleanText !== "" && text === cleanText));
        return { recordId: r.id, text, isWinner };
      }),
      clean: isTagged
        ? { text: cleanText, reason: reason?.text ?? "", overridden: field in overrides }
        : null,
    };
  };
  return [...tagged.map((f) => row(f, true)), ...untagged.map((f) => row(f, false))];
}

/** A human label for a duplicate group, from whichever identifying columns the match config maps. */
export function groupLabel(
  record: RawRecord | undefined,
  fields: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
  },
): string {
  if (!record) return "Unknown";
  const cell = (column?: string) => (column ? (record.cells[column] ?? "").trim() : "");
  const name =
    cell(fields.fullName) ||
    [cell(fields.firstName), cell(fields.lastName)].filter(Boolean).join(" ");
  return name || cell(fields.email) || cell(fields.company) || record.id;
}
