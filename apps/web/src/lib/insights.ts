import type { FieldValue, GoldenRecord } from "@dedupe/core";

export type Tier = "auto" | "review";
/** "merged" means approved for merging (in the CSV phase: included in the export). */
export type Decision = "pending" | "merged" | "rejected";
export type Overrides = Readonly<Record<string, FieldValue>>;

/** Estimated time a person spends researching and merging one duplicate group by hand. */
export const MINUTES_PER_MANUAL_MERGE = 4;

export function isReadyToMerge(group: { tier: Tier; decision: Decision }): boolean {
  if (group.decision === "rejected") return false;
  return group.tier === "auto" || group.decision === "merged";
}

/** Values a person picked in the Inbox win over the computed ones, with an honest reason. */
export function applyOverrides(golden: GoldenRecord, overrides: Overrides): GoldenRecord {
  const chosen = Object.entries(overrides).filter(([field]) => field in golden.values);
  return {
    values: { ...golden.values, ...Object.fromEntries(chosen) },
    reasons: {
      ...golden.reasons,
      ...Object.fromEntries(chosen.map(([field]) => [field, { text: "Chosen by you" }])),
    },
  };
}

export interface FillRate {
  readonly column: string;
  readonly filled: number;
  readonly rate: number;
}

export function fillRates(
  rows: readonly { cells: Readonly<Record<string, string>> }[],
  columns: readonly string[],
): FillRate[] {
  return columns
    .map((column) => {
      const filled = rows.filter((r) => (r.cells[column] ?? "").trim() !== "").length;
      return { column, filled, rate: rows.length === 0 ? 0 : filled / rows.length };
    })
    .sort((a, b) => a.rate - b.rate || a.column.localeCompare(b.column));
}

export interface HealthSummary {
  readonly records: number;
  readonly duplicateGroups: number;
  readonly duplicateRecords: number;
  readonly duplicateRate: number;
  readonly readyToMerge: number;
  readonly needsReview: number;
  readonly rejected: number;
  readonly recordsToRemove: number;
  readonly hoursSaved: number;
}

export function healthSummary(
  records: number,
  groups: readonly { tier: Tier; decision: Decision; size: number }[],
): HealthSummary {
  const ready = groups.filter(isReadyToMerge);
  const duplicateRecords = groups.reduce((n, g) => n + g.size, 0);
  return {
    records,
    duplicateGroups: groups.length,
    duplicateRecords,
    duplicateRate: records === 0 ? 0 : duplicateRecords / records,
    readyToMerge: ready.length,
    needsReview: groups.filter((g) => g.tier === "review" && g.decision === "pending").length,
    rejected: groups.filter((g) => g.decision === "rejected").length,
    recordsToRemove: ready.reduce((n, g) => n + g.size - 1, 0),
    hoursSaved: (ready.length * MINUTES_PER_MANUAL_MERGE) / 60,
  };
}
