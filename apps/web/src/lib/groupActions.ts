"use server";

import type { FieldValue } from "@dedupe/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "./auth";
import { UserFacingError } from "./errors";
import type { MergeSchedule } from "./groups";
import type { Decision } from "./insights";
import * as repo from "./repo";

type Result = { error?: string; message?: string };

const MAX_GROUPS_PER_ACTION = 500;
const DECISION_VERBS: Record<Decision, string> = {
  approved: "Approved",
  merged: "Merged",
  rejected: "Marked not duplicates:",
  pending: "Reopened",
};

function fail(error: unknown): Result {
  if (error instanceof UserFacingError) return { error: error.message };
  console.error(error);
  return { error: "Something went wrong. Check the server logs." };
}

/** Every group action works on the latest run of one CRM export or import. */
async function latestRunOf(datasetId: string) {
  await requireSession();
  const dataset = await repo.getDataset(datasetId);
  const run = dataset ? await repo.latestRun(dataset.id) : null;
  if (!dataset || !run) throw new UserFacingError("Find duplicates for this data first.");
  return { dataset, run };
}

const idsSchema = z.array(z.string().min(1).max(200)).min(1).max(MAX_GROUPS_PER_ACTION);
const decisionSchema = z.enum(["pending", "approved", "merged", "rejected"]);

export async function decideGroupsAction(
  datasetId: string,
  ids: unknown,
  decision: unknown,
): Promise<Result> {
  try {
    const parsedIds = idsSchema.parse(ids);
    const parsedDecision = decisionSchema.parse(decision);
    const { dataset, run } = await latestRunOf(datasetId);
    await repo.decideIdentities(run.id, parsedIds, parsedDecision);
    await repo.logEvent(
      { objectType: dataset.objectType, datasetId },
      "decision",
      `${DECISION_VERBS[parsedDecision]} ${parsedIds.length} group${parsedIds.length === 1 ? "" : "s"}`,
      { ids: parsedIds },
    );
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return error instanceof z.ZodError ? { error: "Pick at least one group." } : fail(error);
  }
}

export async function setMasterAction(
  datasetId: string,
  identityId: string,
  recordId: string,
): Promise<Result> {
  try {
    const { run } = await latestRunOf(datasetId);
    await repo.setMaster(run.id, identityId, recordId);
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return fail(error);
  }
}

/** Pins a field of the surviving record to a value picked from one of the duplicates (null clears it). */
export async function overrideGroupAction(
  datasetId: string,
  identityId: string,
  field: string,
  text: string | null,
): Promise<Result> {
  try {
    const { dataset, run } = await latestRunOf(datasetId);
    if (!dataset.fieldColumns.includes(field))
      throw new UserFacingError(`"${field}" is not a field of this data.`);
    const tag = (await repo.getObject(dataset.objectType))?.config.policy.fields[field];
    const value: FieldValue | null =
      text === null
        ? null
        : tag?.kind === "combine"
          ? text
              .split(";")
              .map((v) => v.trim())
              .filter(Boolean)
          : text;
    await repo.setOverride(run.id, identityId, field, value);
    revalidatePath("/", "layout");
    return {};
  } catch (error) {
    return fail(error);
  }
}

const scheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["daily", "weekly"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  weekday: z.number().int().min(0).max(6).optional(),
});

export async function saveScheduleAction(objectType: string, input: unknown): Promise<Result> {
  await requireSession();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { error: "Pick a valid time (HH:MM)." };
  const object = await repo.getObject(objectType);
  if (!object) return { error: "Upload data for this object first." };
  const schedule = parsed.data as MergeSchedule;
  await repo.saveSchedule(objectType, schedule);
  await repo.logEvent(
    { objectType },
    "rules",
    schedule.enabled
      ? `Auto-merge scheduled ${schedule.frequency} at ${schedule.time} UTC`
      : "Auto-merge schedule turned off",
  );
  revalidatePath("/", "layout");
  return { message: "Schedule saved." };
}
