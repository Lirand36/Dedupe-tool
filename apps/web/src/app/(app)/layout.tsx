import { ObjectSwitcher } from "@/components/ObjectSwitcher";
import { RunButton } from "@/components/RunButton";
import { Sidebar } from "@/components/Sidebar";
import { requireSession } from "@/lib/auth";
import { healthSummary } from "@/lib/insights";
import { objectLabel, objectSystem } from "@/lib/objects";
import { latestRun, listDatasets, listIdentities } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const [datasets, dataset] = await Promise.all([listDatasets(), currentDataset()]);
  const run = dataset ? await latestRun(dataset.id) : null;
  const identities = run ? await listIdentities(run.id) : [];
  const { needsReview } = healthSummary(
    0,
    identities.map((i) => ({ tier: i.tier, decision: i.decision, size: i.sourceIds.length })),
  );
  const options = datasets.map((d) => ({
    id: d.id,
    name: d.name,
    system: objectSystem(d.objectType),
    label: objectLabel(d.objectType),
  }));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar needsReview={needsReview} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <ObjectSwitcher options={options} currentId={dataset?.id ?? null} />
          <div className="flex items-center gap-4">
            {run && (
              <span className="hidden text-xs text-muted lg:inline">
                Last run {run.createdAt.toLocaleString()}
              </span>
            )}
            {dataset && <RunButton />}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
