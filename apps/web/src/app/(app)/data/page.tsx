import { DeleteDatasetButton } from "@/components/DeleteDatasetButton";
import { UploadForm } from "@/components/UploadForm";
import { listDatasets } from "@/lib/repo";

export default async function DataPage() {
  const datasets = await listDatasets();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data</h1>
        <p className="text-sm text-muted">Upload a CSV export. CRM connections come next.</p>
      </div>
      <UploadForm />
      {datasets.length > 0 && (
        <section className="card divide-y divide-line">
          {datasets.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{d.name}</div>
                <div className="text-sm text-muted">
                  {d.recordCount.toLocaleString()} {d.entity === "person" ? "people" : "companies"}{" "}
                  · {d.fieldColumns.length} fields · uploaded {d.createdAt.toLocaleDateString()}
                </div>
              </div>
              <DeleteDatasetButton id={d.id} name={d.name} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
