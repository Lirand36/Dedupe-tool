import { FileUp, Plus } from "lucide-react";
import Link from "next/link";
import { DeleteDatasetButton } from "@/components/DeleteDatasetButton";
import { EmptyState } from "@/components/EmptyState";
import { Badge, PageHeader } from "@/components/ui";
import { objectLabel, objectSystem } from "@/lib/objects";
import { listDatasets } from "@/lib/repo";
import { SYSTEM_COLOR } from "@/lib/tagStyle";

export default async function ImportsPage() {
  const imports = await listDatasets("import");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Imports"
        description="Clean a file before it goes into your CRM: merge duplicates by your rules and split new people from existing ones."
        actions={
          <Link href="/imports/new" className="btn-primary">
            <Plus size={16} aria-hidden /> New import
          </Link>
        }
      />
      {imports.length === 0 ? (
        <EmptyState
          icon={FileUp}
          title="Clean your first import"
          body="Upload a trade-show list, a purchased list or any CSV, and pick where it will be imported."
          href="/imports/new"
          cta="New import"
        />
      ) : (
        <div className="card divide-y divide-line">
          {imports.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <Link
                href={d.status === "ready" ? `/imports/${d.id}` : `/imports/${d.id}/map`}
                className="min-w-0 flex-1"
              >
                <div className="truncate font-medium">{d.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SYSTEM_COLOR[objectSystem(d.objectType)] }}
                    aria-hidden
                  />
                  into {objectLabel(d.objectType)} · {d.recordCount} rows ·{" "}
                  {d.createdAt.toLocaleDateString()}
                </div>
              </Link>
              {d.status === "ready" ? (
                <Badge tone="emerald">Ready</Badge>
              ) : (
                <Badge tone="amber">Map columns</Badge>
              )}
              <DeleteDatasetButton id={d.id} name={d.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
