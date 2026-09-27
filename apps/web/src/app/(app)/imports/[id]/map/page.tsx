import { objectFields, suggestColumnMap } from "@dedupe/core";
import { notFound, redirect } from "next/navigation";
import { MappingForm } from "@/components/imports/MappingForm";
import { PageHeader } from "@/components/ui";
import { objectLabel } from "@/lib/objects";
import { getDataset, getObject, getRecords } from "@/lib/repo";

const SAMPLES_PER_COLUMN = 3;

export default async function MapColumnsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dataset = await getDataset(id);
  if (!dataset) notFound();
  if (dataset.status === "ready") redirect(dataset.kind === "crm" ? "/crm" : `/imports/${id}`);
  const [records, object] = await Promise.all([getRecords(id), getObject(dataset.objectType)]);
  const samples = Object.fromEntries(
    dataset.headers.map((h) => [
      h,
      [...new Set(records.map((r) => (r.cells[h] ?? "").trim()).filter(Boolean))].slice(
        0,
        SAMPLES_PER_COLUMN,
      ),
    ]),
  );
  const targets = objectFields(dataset.objectType, object?.fields ?? []);
  const label = objectLabel(dataset.objectType);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={`${dataset.kind === "crm" ? "CRM export" : "Import"} · ${dataset.name} · ${dataset.recordCount} rows`}
        title="Map columns"
        description={`Tell us which ${label} field each column holds. We guessed from the column names.`}
      />
      <MappingForm
        datasetId={id}
        kind={dataset.kind}
        objectLabel={label}
        headers={dataset.headers}
        samples={samples}
        suggestion={suggestColumnMap(dataset.headers, targets)}
        targets={targets}
      />
    </div>
  );
}
