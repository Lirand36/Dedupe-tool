import { Layers, Percent, Trash2, Users } from "lucide-react";
import { StatCard } from "@/components/ui";
import type { Bucket, DuplicateStats, GroupStatus } from "@/lib/groups";

/** Validated with the dataviz palette checker; the one close colorblind pair is covered by labels and gaps. */
const STATUS_COLORS: Record<GroupStatus, string> = {
  ready: "#059669",
  review: "#d97706",
  merged: "#4f46e5",
  rejected: "#db2777",
};
const STATUS_LABELS: Record<GroupStatus, string> = {
  ready: "Ready to merge",
  review: "Needs review",
  merged: "Merged",
  rejected: "Not duplicates",
};
const BAR_COLOR = "#4f46e5";
const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;

function StatusBar({ byStatus, total }: { byStatus: DuplicateStats["byStatus"]; total: number }) {
  const entries = (Object.keys(STATUS_COLORS) as GroupStatus[]).filter((s) => byStatus[s] > 0);
  return (
    <div>
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded bg-slate-100"
        role="img"
        aria-label="Groups by status"
      >
        {entries.map((s) => (
          <div
            key={s}
            title={`${STATUS_LABELS[s]}: ${byStatus[s]}`}
            className="h-full first:rounded-l last:rounded-r"
            style={{
              width: `${(byStatus[s] / Math.max(total, 1)) * 100}%`,
              background: STATUS_COLORS[s],
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {(Object.keys(STATUS_COLORS) as GroupStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: STATUS_COLORS[s] }}
              aria-hidden
            />
            <span className="text-muted">{STATUS_LABELS[s]}</span>
            <span className="font-medium tabular-nums">{byStatus[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ buckets, unit }: { buckets: readonly Bucket[]; unit: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <ul className="space-y-2.5">
      {buckets.map((b) => (
        <li key={b.label} title={`${b.label}: ${b.count} ${unit}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{b.label}</span>
            <span className="tabular-nums text-muted">{b.count}</span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded"
              style={{ width: `${(b.count / max) * 100}%`, background: BAR_COLOR }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** What was found, before anyone acts: how much duplication, why, and how much a merge would remove. */
export function DuplicatePreview({
  stats,
  objectRecords,
}: {
  stats: DuplicateStats;
  objectRecords: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Layers}
          label="Duplicate groups"
          value={stats.groups.toLocaleString()}
          tone="violet"
        />
        <StatCard
          icon={Users}
          label="Records involved"
          value={stats.recordsInvolved.toLocaleString()}
          hint={`of ${objectRecords.toLocaleString()} records`}
          tone="sky"
        />
        <StatCard
          icon={Percent}
          label="Share of object"
          value={pct(stats.shareOfObject)}
          tone="amber"
        />
        <StatCard
          icon={Trash2}
          label="Records a merge removes"
          value={stats.recordsToRemove.toLocaleString()}
          hint="Excludes groups marked not duplicates"
          tone="emerald"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr_2fr]">
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">Where they stand</h3>
          <StatusBar byStatus={stats.byStatus} total={stats.groups} />
        </section>
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">Why they matched</h3>
          <Bars buckets={stats.byReason} unit="groups" />
        </section>
        <section className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">Records per group</h3>
          <Bars buckets={stats.bySize} unit="groups" />
        </section>
      </div>
    </div>
  );
}
