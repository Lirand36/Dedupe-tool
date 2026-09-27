import { OBJECT_PRESETS } from "@dedupe/core";
import { Building2, Inbox, Plug, UploadCloud, Users } from "lucide-react";
import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import { selectDatasetAction } from "@/lib/actions";
import { healthSummary } from "@/lib/insights";
import { crmSnapshot, latestRun, listIdentities } from "@/lib/repo";
import { SYSTEM_COLOR } from "@/lib/tagStyle";

async function objectStatus(objectType: string) {
  const snapshot = await crmSnapshot(objectType);
  const run = snapshot ? await latestRun(snapshot.id) : null;
  const identities = run ? await listIdentities(run.id) : [];
  const health = healthSummary(
    snapshot?.recordCount ?? 0,
    identities.map((i) => ({ tier: i.tier, decision: i.decision, size: i.sourceIds.length })),
  );
  return { snapshot, health };
}

export default async function CrmPage() {
  const presets = OBJECT_PRESETS.filter((p) => p.system !== "other");
  const statuses = await Promise.all(presets.map((p) => objectStatus(p.id)));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="CRM"
        description="Duplicates in your CRM today, per object. Pick the object you want to clean."
      />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-200 bg-accent-soft/60 p-4 text-sm">
        <Plug size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <span>
          Live Salesforce and HubSpot connections are next on the roadmap. Until then, upload an
          export of the object (with its record ID). It shows today's duplicates and lets imports
          tell new people from existing ones.
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((p, i) => {
          const status = statuses[i];
          const snapshot = status?.snapshot;
          const Icon = p.entity === "person" ? Users : Building2;
          return (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SYSTEM_COLOR[p.system] }}
                    aria-hidden
                  />
                  {p.systemLabel}
                </span>
                <Icon size={16} className="text-muted" aria-hidden />
              </div>
              <div className="text-lg font-semibold">{p.objectLabel}</div>
              {snapshot && status ? (
                <>
                  <div className="mt-1 text-sm text-muted">
                    {snapshot.recordCount.toLocaleString()} records · updated{" "}
                    {snapshot.createdAt.toLocaleDateString()}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="violet">{status.health.duplicateGroups} duplicate groups</Badge>
                    {status.health.needsReview > 0 && (
                      <Badge tone="amber">{status.health.needsReview} to review</Badge>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <form action={selectDatasetAction}>
                      <input type="hidden" name="id" value={snapshot.id} />
                      <input type="hidden" name="next" value="/inbox" />
                      <button type="submit" className="btn-primary px-3 py-1.5 text-xs">
                        <Inbox size={14} aria-hidden /> Review
                      </button>
                    </form>
                    <form action={selectDatasetAction}>
                      <input type="hidden" name="id" value={snapshot.id} />
                      <input type="hidden" name="next" value="/rules" />
                      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                        Rules
                      </button>
                    </form>
                    <Link
                      href={`/imports/new?kind=crm&object=${p.id}`}
                      className="ml-auto text-xs text-muted hover:text-ink"
                    >
                      Replace export
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 text-sm text-muted">No data yet.</div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    <Link
                      href={`/imports/new?kind=crm&object=${p.id}`}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      <UploadCloud size={14} aria-hidden /> Upload export
                    </Link>
                    <span
                      className="rounded-lg px-3 py-1.5 text-xs text-slate-400 ring-1 ring-line"
                      title="Coming next"
                    >
                      Connect {p.systemLabel} · soon
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
