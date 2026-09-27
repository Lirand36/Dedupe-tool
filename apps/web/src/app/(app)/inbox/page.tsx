import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { InboxDetail } from "@/components/InboxDetail";
import { PageHeader } from "@/components/ui";
import type { IdentityRow } from "@/lib/repo";
import { getConfig, getRecords, latestRun, listIdentities } from "@/lib/repo";
import { currentDataset } from "@/lib/service";
import { buildComparison, groupLabel } from "@/lib/views";

const VIEWS = {
  review: {
    label: "Needs review",
    filter: (i: IdentityRow) => i.tier === "review" && i.decision === "pending",
  },
  auto: {
    label: "Automatic",
    filter: (i: IdentityRow) => i.tier === "auto" && i.decision === "pending",
  },
  decided: { label: "Decided", filter: (i: IdentityRow) => i.decision !== "pending" },
} as const;
type View = keyof typeof VIEWS;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; g?: string }>;
}) {
  const params = await searchParams;
  const dataset = await currentDataset();
  const run = dataset ? await latestRun(dataset.id) : null;
  if (!dataset || !run) {
    return (
      <EmptyState
        title="Nothing to review yet"
        body="Upload a dataset to find duplicates."
        href="/data"
        cta="Upload a dataset"
      />
    );
  }
  const [identities, records, config] = await Promise.all([
    listIdentities(run.id),
    getRecords(dataset.id),
    getConfig(dataset.id),
  ]);
  const byId = new Map(records.map((r) => [r.id, r]));
  const view: View = params.view && params.view in VIEWS ? (params.view as View) : "review";
  const list = identities.filter(VIEWS[view].filter);
  const selectedIndex = Math.max(
    0,
    list.findIndex((i) => i.id === params.g),
  );
  const selected = list[selectedIndex];
  const next = list[selectedIndex + 1] ?? list[selectedIndex - 1];
  const matchFields = config?.match.fields ?? run.config.match.fields;
  const label = (i: IdentityRow) => groupLabel(byId.get(i.keepRecordId), matchFields);
  const policy = config?.policy ?? run.config.policy;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Review"
        description="Only the groups that need a person. Click any value to use it instead."
      />
      <div className="flex gap-1 border-b border-line">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={`/inbox?view=${v}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              v === view
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {VIEWS[v].label}{" "}
            <span className="tabular-nums">({identities.filter(VIEWS[v].filter).length})</span>
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState
          title={view === "review" ? "All caught up" : "Nothing here"}
          body={
            view === "review"
              ? "No duplicate groups are waiting for you."
              : "Groups will show up here after a run."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="card max-h-[70vh] divide-y divide-line overflow-y-auto">
            {list.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/inbox?view=${view}&g=${encodeURIComponent(i.id)}`}
                  className={`block px-4 py-3 ${i.id === selected?.id ? "bg-accent-soft" : "hover:bg-slate-50"}`}
                >
                  <div className="truncate text-sm font-medium">{label(i)}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span>{i.sourceIds.length} records</span>·
                    <span className="tabular-nums">{Math.round(i.confidence * 100)}% sure</span>
                    {i.decision !== "pending" && (
                      <span className={i.decision === "merged" ? "text-good" : "text-bad"}>
                        · {i.decision === "merged" ? "approved" : "not duplicates"}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {selected && (
            <InboxDetail
              key={selected.id}
              identityId={selected.id}
              title={label(selected)}
              tier={selected.tier}
              decision={selected.decision}
              confidence={selected.confidence}
              keepRecordId={selected.keepRecordId}
              evidence={selected.evidence}
              recordIds={selected.sourceIds}
              rows={buildComparison(
                selected.sourceIds.flatMap((id) => byId.get(id) ?? []),
                dataset.fieldColumns,
                policy,
                selected.golden,
                selected.overrides,
              )}
              nextHref={
                next
                  ? `/inbox?view=${view}&g=${encodeURIComponent(next.id)}`
                  : `/inbox?view=${view}`
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
