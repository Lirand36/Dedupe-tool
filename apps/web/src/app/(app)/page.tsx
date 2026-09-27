import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { Stat } from "@/components/Stat";
import { fillRates, healthSummary, MINUTES_PER_MANUAL_MERGE } from "@/lib/insights";
import { getRecords, latestRun, listIdentities, listRuns } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

const FILL_RATES_SHOWN = 8;
const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;

export default async function HealthPage() {
  const dataset = await currentDataset();
  if (!dataset) {
    return (
      <EmptyState
        title="Start with a CSV export"
        body="Upload people or companies from your CRM. Nothing is ever written back to the CRM from here."
        href="/data"
        cta="Upload a dataset"
      />
    );
  }
  const [run, runs, records] = await Promise.all([
    latestRun(dataset.id),
    listRuns(dataset.id),
    getRecords(dataset.id),
  ]);
  const identities = run ? await listIdentities(run.id) : [];
  const health = healthSummary(
    dataset.recordCount,
    identities.map((i) => ({ tier: i.tier, decision: i.decision, size: i.sourceIds.length })),
  );
  const rates = fillRates(records, dataset.fieldColumns).slice(0, FILL_RATES_SHOWN);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Health</h1>
          <p className="text-sm text-muted">How clean this dataset is and what's left to do.</p>
        </div>
        {health.readyToMerge > 0 && (
          <a href="/api/export" className="btn-ghost">
            Download clean CSV ({health.readyToMerge} groups)
          </a>
        )}
      </div>

      {health.needsReview > 0 && (
        <Link
          href="/inbox"
          className="card flex items-center justify-between border-amber-200 bg-warn-soft p-4"
        >
          <span className="text-sm">
            <strong>{health.needsReview}</strong> duplicate group
            {health.needsReview === 1 ? " needs" : "s need"} a quick look. Everything else was
            handled automatically.
          </span>
          <span className="text-sm font-medium text-warn">Open Inbox →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Duplicate rate"
          value={pct(health.duplicateRate)}
          hint={`${health.duplicateRecords} of ${health.records.toLocaleString()} records`}
        />
        <Stat
          label="Ready to merge"
          value={String(health.readyToMerge)}
          hint={`${health.recordsToRemove} records to remove`}
          tone="good"
        />
        <Stat
          label="Needs review"
          value={String(health.needsReview)}
          tone={health.needsReview > 0 ? "warn" : undefined}
        />
        <Stat
          label="Time saved"
          value={`${health.hoursSaved.toFixed(1)} h`}
          hint={`est. ${MINUTES_PER_MANUAL_MERGE} min per manual merge`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Emptiest fields</h2>
          <p className="mb-4 text-sm text-muted">Share of records with a value.</p>
          <ul className="space-y-3">
            {rates.map((r) => (
              <li key={r.column}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate">{r.column}</span>
                  <span className="tabular-nums text-muted">{pct(r.rate)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: pct(r.rate) }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Recent runs</h2>
          <p className="mb-4 text-sm text-muted">Every save in Logic re-runs automatically.</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 font-medium">When</th>
                <th className="pb-2 text-right font-medium">Groups</th>
                <th className="pb-2 text-right font-medium">Auto</th>
                <th className="pb-2 text-right font-medium">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.createdAt.toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums">{r.stats.duplicateGroups}</td>
                  <td className="py-2 text-right tabular-nums">{r.stats.autoGroups}</td>
                  <td className="py-2 text-right tabular-nums">{r.stats.reviewGroups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
