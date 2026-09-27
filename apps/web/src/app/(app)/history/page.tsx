import { History } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { EventIcon } from "@/components/EventIcon";
import { PageHeader, Tabs } from "@/components/ui";
import { objectLabel } from "@/lib/objects";
import { type EventKind, type EventRow, listEvents } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

const FILTERS: readonly { key: string; label: string; kinds: readonly EventKind[] }[] = [
  { key: "all", label: "All", kinds: ["upload", "run", "rules", "decision", "example", "export"] },
  { key: "rules", label: "Rule changes", kinds: ["rules", "example"] },
  { key: "decisions", label: "Decisions", kinds: ["decision"] },
  { key: "runs", label: "Runs and exports", kinds: ["upload", "run", "export"] },
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const dataset = await currentDataset();
  if (!dataset)
    return (
      <EmptyState
        title="No history yet"
        body="Add an object to get started."
        href="/objects"
        cta="Add an object"
        icon={History}
      />
    );
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const events = (await listEvents(dataset.id)).filter((e) => active?.kinds.includes(e.kind));
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    const day = e.createdAt.toDateString();
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={objectLabel(dataset.objectType)}
        title="History"
        description="Every upload, run, rule change and decision on this object."
      />
      <Tabs
        active={active?.key ?? "all"}
        items={FILTERS.map((f) => ({
          key: f.key,
          label: f.label,
          href: `/history?filter=${f.key}`,
        }))}
      />
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing here yet.</p>
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">{day}</h2>
            <ol className="card divide-y divide-line">
              {list.map((e) => {
                const changes = Array.isArray(e.detail.changes)
                  ? (e.detail.changes as string[])
                  : [];
                return (
                  <li key={e.id} className="flex gap-4 p-4">
                    <EventIcon kind={e.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{e.summary}</span>
                        <span className="text-xs text-muted">
                          {e.createdAt.toLocaleTimeString()}
                        </span>
                      </div>
                      {changes.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-muted">
                          {changes.map((c) => (
                            <li key={c}>• {c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
