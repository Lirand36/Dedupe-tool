import {
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Layers,
  Percent,
  Sparkles,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { EventIcon } from "@/components/EventIcon";
import { PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { fillRates, healthSummary, MINUTES_PER_MANUAL_MERGE } from "@/lib/insights";
import { objectLabel } from "@/lib/objects";
import { countEvents, getRecords, latestRun, listEvents, listIdentities } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

const FILL_RATES_SHOWN = 6;
const RECENT_EVENTS = 6;
const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;

export default async function OverviewPage() {
  const dataset = await currentDataset();
  if (!dataset) {
    return (
      <EmptyState
        title="Welcome to Dedupe"
        body="Start by adding the object you want to clean: Salesforce Leads, Contacts or Accounts, HubSpot Contacts or Companies, or any CSV."
        href="/crm"
        cta="Get started"
      />
    );
  }
  const [run, records, counts, events] = await Promise.all([
    latestRun(dataset.id),
    getRecords(dataset.id),
    countEvents(dataset.objectType),
    listEvents(dataset.objectType, RECENT_EVENTS),
  ]);
  const identities = run ? await listIdentities(run.id) : [];
  const health = healthSummary(
    dataset.recordCount,
    identities.map((i) => ({ tier: i.tier, decision: i.decision, size: i.sourceIds.length })),
  );
  const downloadHref = dataset.kind === "import" ? `/imports/${dataset.id}` : "/api/export";
  const steps = [
    { label: "Add CRM data or an import", done: true, href: "/crm" },
    { label: "Review and publish your rules", done: counts.rules > 0, href: "/rules/setup" },
    {
      label: "Clear the review queue",
      done: run !== null && health.needsReview === 0,
      href: "/inbox",
    },
    { label: "Download the clean data", done: counts.export > 0, href: downloadHref },
  ];
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow={`${objectLabel(dataset.objectType)} · ${dataset.name}`}
        title="Overview"
        description="How clean this object is and what's left to do."
        actions={
          health.readyToMerge > 0 && (
            <a href={downloadHref} className="btn-ghost">
              <Download size={16} aria-hidden /> Download clean CSV
            </a>
          )
        }
      />

      {nextStep && (
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-gradient-to-r from-indigo-50 to-white px-6 py-4">
            <Sparkles size={18} className="text-accent" aria-hidden />
            <h2 className="font-semibold">Get set up</h2>
            <span className="ml-auto text-sm text-muted">
              {steps.filter((s) => s.done).length} of {steps.length} done
            </span>
          </div>
          <ol className="grid gap-px bg-line sm:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label} className="bg-white">
                <Link href={s.href} className="flex h-full items-start gap-3 p-5 hover:bg-slate-50">
                  {s.done ? (
                    <CheckCircle2 size={20} className="shrink-0 text-good" aria-hidden />
                  ) : (
                    <Circle
                      size={20}
                      className={`shrink-0 ${s === nextStep ? "text-accent" : "text-slate-300"}`}
                      aria-hidden
                    />
                  )}
                  <span className="text-sm">
                    <span className="block text-xs text-muted">Step {i + 1}</span>
                    <span className={s.done ? "text-muted line-through" : "font-medium"}>
                      {s.label}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Percent}
          label="Duplicate rate"
          value={pct(health.duplicateRate)}
          hint={`${health.duplicateRecords} of ${health.records.toLocaleString()} records`}
          tone="violet"
        />
        <StatCard
          icon={Layers}
          label="Ready to merge"
          value={String(health.readyToMerge)}
          hint={`${health.recordsToRemove} records to remove`}
          tone="emerald"
        />
        <StatCard
          icon={Clock}
          label="Needs review"
          value={String(health.needsReview)}
          hint={health.needsReview > 0 ? "Open Review to decide" : "All caught up"}
          tone="amber"
        />
        <StatCard
          icon={Timer}
          label="Time saved"
          value={`${health.hoursSaved.toFixed(1)} h`}
          hint={`est. ${MINUTES_PER_MANUAL_MERGE} min per manual merge`}
          tone="sky"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <SectionTitle title="Emptiest fields" description="Share of records with a value." />
          <ul className="space-y-3">
            {fillRates(records, dataset.fieldColumns)
              .slice(0, FILL_RATES_SHOWN)
              .map((r) => (
                <li key={r.column}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="truncate">{r.column}</span>
                    <span className="tabular-nums text-muted">{pct(r.rate)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                      style={{ width: pct(r.rate) }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </section>
        <section className="card p-6">
          <div className="flex items-start justify-between">
            <SectionTitle title="Recent activity" />
            <Link href="/history" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          {events.length === 0 && (
            <p className="text-sm text-muted">
              Uploads, runs, rule changes and decisions will show up here.
            </p>
          )}
          <ol className="space-y-4">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <EventIcon kind={e.kind} />
                <div className="min-w-0">
                  <div className="truncate text-sm">{e.summary}</div>
                  <div className="text-xs text-muted">{e.createdAt.toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
