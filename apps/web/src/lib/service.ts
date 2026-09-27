import "server-only";
import { type RawRecord, toSourceRecords } from "@dedupe/cli/csv";
import {
  checkExamples,
  type ExampleFailure,
  type PolicyChangePreview,
  previewPolicyChange,
  type RunConfig,
  runPipeline,
} from "@dedupe/core";
import { cookies } from "next/headers";
import {
  carryOverDecisions,
  createRun,
  type DatasetSummary,
  getConfig,
  getDataset,
  getRecords,
  latestRun,
  listDatasets,
  listExamples,
  listIdentities,
} from "./repo";

export const DATASET_COOKIE = "dedupe_dataset";

/** The dataset the admin is working on: the one they picked, else the newest. */
export async function currentDataset(): Promise<DatasetSummary | null> {
  const picked = (await cookies()).get(DATASET_COOKIE)?.value;
  const dataset = picked ? await getDataset(picked) : null;
  return dataset ?? (await listDatasets())[0] ?? null;
}

export async function selectDataset(id: string): Promise<void> {
  (await cookies()).set(DATASET_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
}

/** Runs matching + survivorship on the stored records and keeps earlier Inbox decisions. */
export async function runDataset(datasetId: string): Promise<string> {
  const config = await getConfig(datasetId);
  if (!config) throw new Error("This dataset has no logic yet. Open Logic and save it first.");
  const previous = await latestRun(datasetId);
  const records = toSourceRecords(await getRecords(datasetId), config.policy);
  const runId = await createRun(datasetId, config, runPipeline(records, config));
  if (previous) await carryOverDecisions(previous.id, runId);
  return runId;
}

export interface ImpactPreview {
  readonly policy: PolicyChangePreview;
  readonly exampleFailures: readonly ExampleFailure[];
  readonly groupsCompared: number;
}

/** What saving `next` would change on the latest run's duplicate groups, and which examples break. */
export async function previewImpact(datasetId: string, next: RunConfig): Promise<ImpactPreview> {
  const [current, run, raw, examples] = await Promise.all([
    getConfig(datasetId),
    latestRun(datasetId),
    getRecords(datasetId),
    listExamples(datasetId),
  ]);
  const byId = new Map<string, RawRecord>(raw.map((r) => [r.id, r]));
  const identities = run ? await listIdentities(run.id) : [];
  const groups = identities.map((identity) =>
    toSourceRecords(
      identity.sourceIds.flatMap((id) => byId.get(id) ?? []),
      next.policy,
    ),
  );
  const before = current?.policy ?? next.policy;
  return {
    policy: previewPolicyChange(groups, before, next.policy),
    exampleFailures: checkExamples(examples, next.policy),
    groupsCompared: groups.length,
  };
}
