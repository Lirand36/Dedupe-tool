import { safeCell } from "@dedupe/cli/csv";
import { stringify } from "csv-stringify/sync";
import { hasSession } from "@/lib/auth";
import { getDataset, logEvent } from "@/lib/repo";
import { importPlanFor } from "@/lib/service";

export const dynamic = "force-dynamic";

const FILES = {
  clean: "clean",
  insert: "new-records",
  update: "updates",
} as const;
type FileKey = keyof typeof FILES;

/** Import-ready CSVs: every object field, plus Id (existing records) and _ helper columns at the end. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
): Promise<Response> {
  if (!(await hasSession())) return new Response("Unauthorized", { status: 401 });
  const { id, file } = await params;
  if (!(file in FILES)) return new Response("Not found", { status: 404 });
  const dataset = await getDataset(id);
  if (dataset?.kind !== "import" || dataset.status !== "ready") {
    return new Response("Not found", { status: 404 });
  }
  const { plan } = await importPlanFor(dataset);
  const key = file as FileKey;
  const rows =
    key === "insert"
      ? plan.inserts
      : key === "update"
        ? plan.updates
        : [...plan.updates, ...plan.inserts];
  const columns = ["Id", ...dataset.fieldColumns, "_source_rows", "_note"];
  const csv = stringify([columns, ...rows.map((r) => columns.map((c) => safeCell(r[c] ?? "")))]);
  await logEvent(
    { objectType: dataset.objectType, datasetId: dataset.id },
    "export",
    `Downloaded ${FILES[key].replace("-", " ")} file for "${dataset.name}" (${rows.length} rows)`,
  );
  const filename = `${dataset.name.replace(/\.csv$/i, "").replace(/[^\w-]+/g, "_")}-${FILES[key]}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
