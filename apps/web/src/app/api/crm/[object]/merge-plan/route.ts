import { safeCell } from "@dedupe/cli/csv";
import { stringify } from "csv-stringify/sync";
import { hasSession } from "@/lib/auth";
import { mergePlanRows } from "@/lib/groups";
import { crmSnapshot, latestRun, listIdentities, logEvent } from "@/lib/repo";
import { datasetRecords } from "@/lib/service";

export const dynamic = "force-dynamic";

/** Every merged group: the master that survives, the ids merged into it, and the values it ends with. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ object: string }> },
): Promise<Response> {
  if (!(await hasSession())) return new Response("Unauthorized", { status: 401 });
  const { object } = await params;
  const snapshot = await crmSnapshot(object);
  const run = snapshot ? await latestRun(snapshot.id) : null;
  if (!snapshot || !run) return new Response("Not found", { status: 404 });
  const [identities, records] = await Promise.all([
    listIdentities(run.id),
    datasetRecords(snapshot),
  ]);
  const merged = identities.filter((i) => i.decision === "merged");
  const rows = mergePlanRows(
    merged,
    new Map(records.map((r) => [r.id, r.cells])),
    snapshot.fieldColumns,
  );
  const columns = ["MasterId", "MergedIds", ...snapshot.fieldColumns];
  const csv = stringify([columns, ...rows.map((r) => columns.map((c) => safeCell(r[c] ?? "")))]);
  await logEvent(
    { objectType: object, datasetId: snapshot.id },
    "export",
    `Downloaded merge plan with ${rows.length} group${rows.length === 1 ? "" : "s"}`,
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${object.replace(".", "-")}-merge-plan.csv"`,
    },
  });
}
