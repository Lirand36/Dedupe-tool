import type { FieldValue, GoldenRecord } from "@dedupe/core";
import {
  applyOverrides,
  type Decision,
  isReadyToMerge,
  type Overrides,
  type Tier,
} from "./insights";

/** Where a duplicate group stands, as shown in the object tables. */
export type GroupStatus = "review" | "ready" | "merged" | "rejected";

export function statusOf(group: { tier: Tier; decision: Decision }): GroupStatus {
  if (group.decision === "merged") return "merged";
  if (group.decision === "rejected") return "rejected";
  return isReadyToMerge(group) ? "ready" : "review";
}

export interface Bucket {
  readonly label: string;
  readonly count: number;
}

export interface DuplicateStats {
  readonly groups: number;
  readonly recordsInvolved: number;
  readonly shareOfObject: number;
  readonly recordsToRemove: number;
  readonly byStatus: Readonly<Record<GroupStatus, number>>;
  readonly bySize: readonly Bucket[];
  readonly byReason: readonly Bucket[];
}

const SIZE_BUCKETS = ["2", "3", "4", "5+"] as const;
const MAX_SIZE_BUCKET = 5;

/** The main reason a group was matched: its first non-conflict piece of evidence. */
function primaryReason(reasons: readonly string[]): string {
  return reasons.find((r) => !r.startsWith("Conflict")) ?? reasons[0] ?? "Unknown";
}

/** The preview shown before anyone acts: how much duplication there is and why. */
export function duplicateStats(
  groups: readonly { tier: Tier; decision: Decision; size: number; reasons: readonly string[] }[],
  objectRecords: number,
): DuplicateStats {
  const recordsInvolved = groups.reduce((n, g) => n + g.size, 0);
  const byStatus: Record<GroupStatus, number> = { ready: 0, review: 0, merged: 0, rejected: 0 };
  for (const g of groups) byStatus[statusOf(g)]++;
  const reasonCounts = new Map<string, number>();
  for (const g of groups) {
    const reason = primaryReason(g.reasons);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  return {
    groups: groups.length,
    recordsInvolved,
    shareOfObject: objectRecords === 0 ? 0 : recordsInvolved / objectRecords,
    recordsToRemove: groups
      .filter((g) => g.decision !== "rejected")
      .reduce((n, g) => n + g.size - 1, 0),
    byStatus,
    bySize: SIZE_BUCKETS.map((label, i) => ({
      label,
      count: groups.filter((g) =>
        i === SIZE_BUCKETS.length - 1 ? g.size >= MAX_SIZE_BUCKET : g.size === i + 2,
      ).length,
    })),
    byReason: [...reasonCounts]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

export interface MergeSchedule {
  readonly enabled: boolean;
  readonly frequency: "daily" | "weekly";
  /** "HH:MM", UTC. */
  readonly time: string;
  /** 0 = Sunday. Only for weekly. */
  readonly weekday?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

/** The next time the auto-merge job runs, or null when it's off. */
export function nextRun(schedule: MergeSchedule, now: Date): Date | null {
  if (!schedule.enabled) return null;
  const [hours = 0, minutes = 0] = schedule.time.split(":").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes);
  for (let offset = 0; offset <= DAYS_PER_WEEK; offset++) {
    const candidate = new Date(today + offset * DAY_MS);
    const dayMatches =
      schedule.frequency === "daily" || candidate.getUTCDay() === (schedule.weekday ?? 0);
    if (dayMatches && candidate > now) return candidate;
  }
  return null;
}

const CRM_PREFIX = "crm:";
const stripCrm = (id: string) => (id.startsWith(CRM_PREFIX) ? id.slice(CRM_PREFIX.length) : id);

function text(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  return Array.isArray(value) ? value.join("; ") : String(value);
}

/** What a merge does: which record survives, which are merged into it, and every value it ends with. */
export function mergePlanRows(
  groups: readonly {
    sourceIds: readonly string[];
    masterId: string;
    golden: GoldenRecord;
    overrides: Overrides;
  }[],
  cellsById: ReadonlyMap<string, Readonly<Record<string, string>>>,
  fields: readonly string[],
): Record<string, string>[] {
  return groups.map((g) => {
    const final = applyOverrides(g.golden, g.overrides);
    const master = cellsById.get(g.masterId) ?? {};
    return {
      MasterId: stripCrm(g.masterId),
      MergedIds: g.sourceIds
        .filter((id) => id !== g.masterId)
        .map(stripCrm)
        .join("; "),
      ...Object.fromEntries(
        fields.map((f) => [f, f in final.values ? text(final.values[f]) : (master[f] ?? "")]),
      ),
    };
  });
}
