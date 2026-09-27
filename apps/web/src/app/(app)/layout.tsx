import { NavLinks } from "@/components/NavLinks";
import { RunButton } from "@/components/RunButton";
import { logoutAction, selectDatasetAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { healthSummary } from "@/lib/insights";
import { latestRun, listDatasets, listIdentities } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const [datasets, dataset] = await Promise.all([listDatasets(), currentDataset()]);
  const run = dataset ? await latestRun(dataset.id) : null;
  const identities = run ? await listIdentities(run.id) : [];
  const needsReview = healthSummary(
    0,
    identities.map((i) => ({ tier: i.tier, decision: i.decision, size: i.sourceIds.length })),
  ).needsReview;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-line bg-white p-4 md:min-h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            D
          </div>
          <span className="font-semibold">Dedupe</span>
        </div>
        <NavLinks needsReview={needsReview} />
        <div className="mt-auto space-y-3">
          {datasets.length > 0 && (
            <form action={selectDatasetAction} className="px-2">
              <label htmlFor="dataset" className="label">
                Dataset
              </label>
              <div className="flex gap-1.5">
                <select id="dataset" name="id" defaultValue={dataset?.id} className="input py-1.5">
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-ghost px-2 py-1.5 text-xs">
                  Open
                </button>
              </div>
            </form>
          )}
          <form action={logoutAction} className="px-2">
            <button type="submit" className="text-sm text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-3">
          <div className="min-w-0 truncate text-sm text-muted">
            {dataset ? (
              <>
                <span className="font-medium text-ink">{dataset.name}</span> ·{" "}
                {dataset.recordCount.toLocaleString()}{" "}
                {dataset.entity === "person" ? "people" : "companies"}
                {run && <> · last run {run.createdAt.toLocaleString()}</>}
              </>
            ) : (
              "No dataset yet"
            )}
          </div>
          {dataset && <RunButton />}
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
