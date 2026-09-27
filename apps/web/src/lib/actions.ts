"use server";

import { CsvError, parseCsv, toSourceRecords } from "@dedupe/cli/csv";
import {
  ConfigError,
  diffConfigs,
  draftConfig,
  type FieldValue,
  getPreset,
  parseRunConfig,
} from "@dedupe/core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, passwordMatches, requireSession, startSession } from "./auth";
import { readAuthEnv } from "./env";
import { UserFacingError } from "./errors";
import { applyOverrides, type Decision } from "./insights";
import { clientIp, createRateLimiter } from "./rateLimit";
import * as repo from "./repo";
import {
  currentDataset,
  type ImpactPreview,
  previewImpact,
  runDataset,
  selectDataset,
} from "./service";

export interface FormState {
  readonly error?: string;
  readonly message?: string;
}

const LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Caps total attempts too, so rotating addresses cannot buy unlimited password guesses. */
const GLOBAL_LOGIN_ATTEMPTS = 20;
const loginLimiter = createRateLimiter(LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
const globalLoginLimiter = createRateLimiter(GLOBAL_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_NAME_LENGTH = 100;
const DECISIONS: readonly Decision[] = ["pending", "merged", "rejected"];

/** Known, admin-readable errors are shown as-is; anything else is logged and kept generic. */
function friendly(error: unknown): string {
  if (
    error instanceof CsvError ||
    error instanceof ConfigError ||
    error instanceof UserFacingError
  ) {
    return error.message;
  }
  console.error(error);
  return "Something went wrong. Check the server logs.";
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const auth = readAuthEnv();
  if (!auth.ok) return { error: `Login is not configured: ${auth.problems.join("; ")}` };
  const ip = clientIp((await headers()).get("x-forwarded-for"));
  if (!globalLoginLimiter.attempt("all") || !loginLimiter.attempt(ip))
    return { error: "Too many attempts. Try again in 15 minutes." };
  if (!passwordMatches(auth.env.adminPassword, String(form.get("password") ?? ""))) {
    return { error: "Wrong password." };
  }
  loginLimiter.reset(ip);
  await startSession(auth.env.sessionSecret);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function uploadDatasetAction(_: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const name = String(form.get("name") ?? "").trim();
  const preset = getPreset(String(form.get("objectType") ?? ""));
  const file = form.get("file");
  if (!preset) return { error: "Choose which object this file holds." };
  if (!name || name.length > MAX_NAME_LENGTH)
    return { error: "Give the object a name (up to 100 characters)." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "The file is larger than 25 MB." };
  try {
    const parsed = parseCsv(await file.text());
    const { config } = draftConfig(parsed.fieldColumns, preset.id);
    const datasetId = await repo.createDataset({
      name,
      entity: preset.entity,
      objectType: preset.id,
      ...parsed,
      config,
    });
    await repo.logEvent(
      datasetId,
      "upload",
      `Uploaded ${parsed.rows.length} ${preset.systemLabel} ${preset.objectLabel} from ${file.name}`,
    );
    await selectDataset(datasetId);
    await runDataset(datasetId);
  } catch (error) {
    return { error: friendly(error) };
  }
  redirect("/rules/setup?welcome=1");
}

export async function selectDatasetAction(form: FormData): Promise<void> {
  await requireSession();
  await selectDataset(String(form.get("id") ?? ""));
  redirect("/");
}

export async function deleteDatasetAction(form: FormData): Promise<void> {
  await requireSession();
  await repo.deleteDataset(String(form.get("id") ?? ""));
  revalidatePath("/", "layout");
}

export async function runAction(): Promise<FormState> {
  await requireSession();
  const dataset = await currentDataset();
  if (!dataset) return { error: "Upload a dataset first." };
  try {
    await runDataset(dataset.id);
  } catch (error) {
    return { error: friendly(error) };
  }
  revalidatePath("/", "layout");
  return { message: "Done. Review is up to date." };
}

export async function previewConfigAction(
  input: unknown,
): Promise<{ error?: string; preview?: ImpactPreview }> {
  await requireSession();
  const dataset = await currentDataset();
  if (!dataset) return { error: "Upload a dataset first." };
  try {
    return { preview: await previewImpact(dataset.id, parseRunConfig(input)) };
  } catch (error) {
    return { error: friendly(error) };
  }
}

export async function saveConfigAction(input: unknown): Promise<FormState> {
  await requireSession();
  const dataset = await currentDataset();
  if (!dataset) return { error: "Upload a dataset first." };
  try {
    const next = parseRunConfig(input);
    const [previous, counts] = await Promise.all([
      repo.getConfig(dataset.id),
      repo.countEvents(dataset.id),
    ]);
    const changes = previous ? diffConfigs(previous, next) : [];
    await repo.saveConfig(dataset.id, next);
    await repo.logEvent(
      dataset.id,
      "rules",
      `Rules v${counts.rules + 1} went live${changes.length ? ` with ${changes.length} change(s)` : ""}`,
      { changes, config: next },
    );
    await runDataset(dataset.id);
  } catch (error) {
    return { error: friendly(error) };
  }
  revalidatePath("/", "layout");
  return { message: "Rules are live. Decisions on unchanged groups were kept." };
}

async function currentRunId(): Promise<string> {
  const dataset = await currentDataset();
  const run = dataset ? await repo.latestRun(dataset.id) : null;
  if (!run) throw new UserFacingError("No run yet. Click Find duplicates first.");
  return run.id;
}

export async function decideAction(identityId: string, decision: Decision): Promise<void> {
  await requireSession();
  if (!DECISIONS.includes(decision)) throw new UserFacingError("Unknown decision");
  const runId = await currentRunId();
  await repo.decideIdentity(runId, identityId, decision);
  const [dataset, identity] = await Promise.all([
    currentDataset(),
    repo.getIdentity(runId, identityId),
  ]);
  if (dataset && identity) {
    const verb = {
      merged: "Approved merge of",
      rejected: "Marked not duplicates:",
      pending: "Reopened",
    }[decision];
    await repo.logEvent(dataset.id, "decision", `${verb} ${identity.sourceIds.join(" + ")}`);
  }
  revalidatePath("/", "layout");
}

/** Pins a field to a value the admin picked from one of the records (null clears the pin). */
export async function overrideAction(
  identityId: string,
  field: string,
  text: string | null,
): Promise<void> {
  await requireSession();
  const dataset = await currentDataset();
  const config = dataset ? await repo.getConfig(dataset.id) : null;
  const tag = config?.policy.fields[field];
  if (!tag) throw new UserFacingError(`"${field}" is not a tagged field`);
  const value: FieldValue | null =
    text === null
      ? null
      : tag.kind === "combine"
        ? text
            .split(";")
            .map((v) => v.trim())
            .filter(Boolean)
        : text;
  await repo.setOverride(await currentRunId(), identityId, field, value);
  revalidatePath("/inbox");
}

export async function saveExampleAction(identityId: string, name: string): Promise<FormState> {
  await requireSession();
  const dataset = await currentDataset();
  const runId = await currentRunId();
  const [identity, config, raw] = await Promise.all([
    repo.getIdentity(runId, identityId),
    dataset ? repo.getConfig(dataset.id) : null,
    dataset ? repo.getRecords(dataset.id) : [],
  ]);
  if (!dataset || !identity || !config) return { error: "Could not find that group." };
  const members = raw.filter((r) => identity.sourceIds.includes(r.id));
  await repo.createExample(dataset.id, {
    name: name.trim().slice(0, MAX_NAME_LENGTH) || `Group ${identity.keepRecordId}`,
    records: toSourceRecords(members, config.policy),
    expected: { ...applyOverrides(identity.golden, identity.overrides).values },
  });
  await repo.logEvent(
    dataset.id,
    "example",
    `Saved example "${name.trim() || identity.keepRecordId}"`,
  );
  revalidatePath("/rules");
  return { message: "Saved as an example. Logic changes that break it will be flagged." };
}

export async function deleteExampleAction(form: FormData): Promise<void> {
  await requireSession();
  await repo.deleteExample(String(form.get("id") ?? ""));
  revalidatePath("/rules");
}
