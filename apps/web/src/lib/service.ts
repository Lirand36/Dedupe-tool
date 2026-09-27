import "server-only";
import { type RawRecord, toSourceRecords } from "@dedupe/cli/csv";
import {
  checkExamples,
  draftConfig,
  type ExampleFailure,
  type Identity,
  type ImportPlan,
  type PolicyChangePreview,
  planImport,
  previewPolicyChange,
  type RunConfig,
  runPipeline,
} from "@dedupe/core";
import { cookies } from "next/headers";
import { UserFacingError } from "./errors";
import { applyOverrides, isReadyToMerge } from "./insights";
import {
  carryOverDecisions,
  createRun,
  crmSnapshot,
  type DatasetSummary,
  getDataset,
  getObject,
  getRecords,
  latestRun,
  listDatasets,
  listExamples,
  listIdentities,
  logEvent,
  saveObject,
} from "./repo";

export const DATASET_COOKIE = "dedupe_dataset";
/** Existing CRM records are prefixed inside import runs so their ids never clash with file row ids. */
export const CRM_PREFIX = "crm:";

/** What the admin is working on: the CRM data or import they picked, else the newest one. */
export async function currentDataset(): Promise<DatasetSummary | null> {
  const picked = (await cookies()).get(DATASET_COOKIE)?.value;
  const dataset = picked ? await getDataset(picked) : null;
  return dataset ?? (await listDatasets())[0] ?? null;
}

export async function selectDataset(id: string): Promise<void> {
  (await cookies()).set(DATASET_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** The records a run compares: CRM data alone, or an import plus the object's CRM data. */
export async function datasetRecords(dataset: DatasetSummary): Promise<RawRecord[]> {
  const own = await getRecords(dataset.id);
  if (dataset.kind === "crm") return own;
  const snapshot = await crmSnapshot(dataset.objectType);
  if (!snapshot) return own;
  const existing = await getRecords(snapshot.id);
  return [...own, ...existing.map((r) => ({ ...r, id: `${CRM_PREFIX}${r.id}` }))];
}

const isCrmId = (id: string) => id.startsWith(CRM_PREFIX);

function statsFor(identities: readonly Identity[], records: number) {
  const autoGroups = identities.filter((i) => i.tier === "auto").length;
  return {
    records,
    duplicateGroups: identities.length,
    autoGroups,
    reviewGroups: identities.length - autoGroups,
    recordsToRemove: identities.reduce((n, i) => n + i.removeRecordIds.length, 0),
  };
}

/** Matches and computes clean records for one dataset, keeping earlier Review decisions. */
export async function runDataset(datasetId: string): Promise<string> {
  const dataset = await getDataset(datasetId);
  if (!dataset) throw new UserFacingError("That dataset no longer exists.");
  if (dataset.status !== "ready") throw new UserFacingError("Map the file's columns first.");
  const object = await getObject(dataset.objectType);
  if (!object) throw new UserFacingError("This object has no rules yet.");
  const config = object.config;
  const records = toSourceRecords(await datasetRecords(dataset), config.policy);
  const result = runPipeline(records, config);
  // An import only cares about groups that involve its own rows, not duplicates already in the CRM.
  const identities =
    dataset.kind === "import"
      ? result.identities.filter((i) => i.sourceIds.some((id) => !isCrmId(id)))
      : result.identities;
  const stats = statsFor(identities, dataset.recordCount);
  const previous = await latestRun(datasetId);
  const runId = await createRun(datasetId, config, { identities, stats });
  if (previous) await carryOverDecisions(previous.id, runId);
  await logEvent(
    { objectType: dataset.objectType, datasetId },
    "run",
    `${dataset.kind === "crm" ? "CRM data" : `Import "${dataset.name}"`}: ${stats.duplicateGroups} duplicate groups, ${stats.autoGroups} automatic, ${stats.reviewGroups} for review`,
    { stats },
  );
  return runId;
}

/** After the rules change, every CRM export and import of the object is re-evaluated. */
export async function rerunObject(objectType: string): Promise<void> {
  const datasets = (await listDatasets()).filter(
    (d) => d.objectType === objectType && d.status === "ready",
  );
  for (const d of datasets) await runDataset(d.id);
}

/**
 * Makes sure an object has rules covering the given fields. New objects get drafted rules; fields
 * never seen before on an existing object get suggested tags. Rules you already set are untouched.
 */
export async function ensureObject(
  objectType: string,
  fields: readonly string[],
): Promise<string[]> {
  const existing = await getObject(objectType);
  const known = new Set(existing?.fields ?? []);
  const added = fields.filter((f) => !known.has(f));
  if (existing && added.length === 0) return [];
  const draft = draftConfig(existing ? added : fields, objectType).config;
  const config: RunConfig = existing
    ? {
        policy: {
          ...existing.config.policy,
          fields: { ...draft.policy.fields, ...existing.config.policy.fields },
        },
        match: {
          ...existing.config.match,
          fields: { ...draft.match.fields, ...existing.config.match.fields },
        },
      }
    : draft;
  await saveObject(objectType, config, [...known, ...added]);
  return added;
}

export interface ImpactPreview {
  readonly policy: PolicyChangePreview;
  readonly exampleFailures: readonly ExampleFailure[];
  readonly groupsCompared: number;
}

/** What saving `next` would change on the latest run's duplicate groups, and which examples break. */
export async function previewImpact(
  dataset: DatasetSummary,
  next: RunConfig,
): Promise<ImpactPreview> {
  const [object, run, raw, examples] = await Promise.all([
    getObject(dataset.objectType),
    latestRun(dataset.id),
    datasetRecords(dataset),
    listExamples(dataset.objectType),
  ]);
  const byId = new Map<string, RawRecord>(raw.map((r) => [r.id, r]));
  const identities = run ? await listIdentities(run.id) : [];
  const groups = identities.map((identity) =>
    toSourceRecords(
      identity.sourceIds.flatMap((id) => byId.get(id) ?? []),
      next.policy,
    ),
  );
  return {
    policy: previewPolicyChange(groups, object?.config.policy ?? next.policy, next.policy),
    exampleFailures: checkExamples(examples, next.policy),
    groupsCompared: groups.length,
  };
}

const stripCrm = (text: string) => text.split(CRM_PREFIX).join("");

/** What importing this file would do: new records to insert, existing CRM records to update. */
export async function importPlanFor(
  dataset: DatasetSummary,
): Promise<{ plan: ImportPlan; hasCrm: boolean }> {
  const [object, run, raw, snapshot] = await Promise.all([
    getObject(dataset.objectType),
    latestRun(dataset.id),
    datasetRecords(dataset),
    crmSnapshot(dataset.objectType),
  ]);
  if (!object || !run) throw new UserFacingError("Run this import first.");
  const records = toSourceRecords(raw, object.config.policy);
  const identities = await listIdentities(run.id);
  const plan = planImport({
    importRecords: records.filter((r) => !isCrmId(r.id)),
    crmRecords: records.filter((r) => isCrmId(r.id)),
    identities: identities.map((i) => ({
      sourceIds: i.sourceIds,
      golden: applyOverrides(i.golden, i.overrides),
      ready: isReadyToMerge(i) || i.decision === "merged",
    })),
    fields: dataset.fieldColumns,
  });
  const clean = (row: Record<string, string>) => ({
    ...row,
    Id: stripCrm(row.Id ?? ""),
    _note: stripCrm(row._note ?? ""),
  });
  return { plan: { ...plan, updates: plan.updates.map(clean) }, hasCrm: snapshot !== null };
}
