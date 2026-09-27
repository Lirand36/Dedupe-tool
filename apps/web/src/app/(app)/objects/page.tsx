import { OBJECT_PRESETS } from "@dedupe/core";
import { Building2, Users } from "lucide-react";
import { AddObjectForm } from "@/components/AddObjectForm";
import { DeleteDatasetButton } from "@/components/DeleteDatasetButton";
import { PageHeader } from "@/components/ui";
import { selectDatasetAction } from "@/lib/actions";
import { objectLabel, objectSystem } from "@/lib/objects";
import { listDatasets } from "@/lib/repo";
import { currentDataset } from "@/lib/service";
import { SYSTEM_COLOR } from "@/lib/tagStyle";

export default async function ObjectsPage() {
  const [datasets, current] = await Promise.all([listDatasets(), currentDataset()]);
  const presets = OBJECT_PRESETS.map(({ id, system, systemLabel, objectLabel: label, entity }) => ({
    id,
    system,
    systemLabel,
    objectLabel: label,
    entity,
  }));
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Objects"
        description="What you're deduping. Each object has its own rules, review queue and history."
      />
      {datasets.length > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((d) => {
            const isCurrent = d.id === current?.id;
            const Icon = d.entity === "person" ? Users : Building2;
            return (
              <div
                key={d.id}
                className={`card flex flex-col p-5 ${isCurrent ? "ring-2 ring-accent/30" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: SYSTEM_COLOR[objectSystem(d.objectType)] }}
                      aria-hidden
                    />
                    {objectLabel(d.objectType)}
                  </span>
                  <Icon size={16} className="text-muted" aria-hidden />
                </div>
                <div className="truncate font-semibold">{d.name}</div>
                <div className="mt-1 text-sm text-muted">
                  {d.recordCount.toLocaleString()} records · {d.fieldColumns.length} fields
                </div>
                <div className="mt-1 text-xs text-muted">
                  Added {d.createdAt.toLocaleDateString()}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  {isCurrent ? (
                    <span className="text-xs font-medium text-accent">Working on this</span>
                  ) : (
                    <form action={selectDatasetAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                        Open
                      </button>
                    </form>
                  )}
                  <DeleteDatasetButton id={d.id} name={d.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <h2 className="mb-3 font-semibold">Add an object</h2>
      <AddObjectForm presets={presets} />
    </div>
  );
}
