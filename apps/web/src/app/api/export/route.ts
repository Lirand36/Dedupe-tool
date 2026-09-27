import { identitiesToCsv } from "@dedupe/cli/csv";
import { hasSession } from "@/lib/auth";
import { applyOverrides, isReadyToMerge } from "@/lib/insights";
import { latestRun, listIdentities, logEvent } from "@/lib/repo";
import { currentDataset } from "@/lib/service";

export const dynamic = "force-dynamic";

/** Clean CSV of every group that is ready to merge: auto groups not rejected, plus approved ones. */
export async function GET(): Promise<Response> {
  if (!(await hasSession())) return new Response("Unauthorized", { status: 401 });
  const dataset = await currentDataset();
  const run = dataset ? await latestRun(dataset.id) : null;
  if (!dataset || !run) return new Response("No run yet", { status: 404 });
  const identities = (await listIdentities(run.id))
    .filter(isReadyToMerge)
    .map((i) => ({ ...i, golden: applyOverrides(i.golden, i.overrides) }));
  const csv = identitiesToCsv({ identities, stats: run.stats }, run.config.policy);
  await logEvent(dataset.id, "export", `Downloaded clean CSV with ${identities.length} groups`);
  const filename = `${dataset.name.replace(/[^\w-]+/g, "_")}-clean.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
