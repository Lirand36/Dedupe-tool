"use server";

import {
  applyTemplate,
  ConfigError,
  type LogicSummary,
  MAX_PAIRWISE_RECORDS,
  parseRunConfig,
  summarizeLogic,
} from "@dedupe/core";
import { requireSession } from "./auth";
import { UserFacingError } from "./errors";
import * as repo from "./repo";
import { type SandboxResult, simulateMerge } from "./sandbox";
import { currentDataset } from "./service";
import { groupLabel } from "./views";

type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

function fail(error: unknown): { error: string } {
  if (error instanceof ConfigError || error instanceof UserFacingError)
    return { error: error.message };
  console.error(error);
  return { error: "Something went wrong. Check the server logs." };
}

async function requireDataset() {
  await requireSession();
  const dataset = await currentDataset();
  if (!dataset) throw new UserFacingError("Upload an object first.");
  return dataset;
}

/** Applies a starting rule set to the rules being edited. Nothing is saved until Go live. */
export async function applyTemplateAction(
  input: unknown,
  templateId: string,
): Promise<Result<{ config: unknown; changes: readonly string[] }>> {
  try {
    const dataset = await requireDataset();
    const samples = await repo.sampleValues(dataset.id);
    const { config, changes } = applyTemplate(
      parseRunConfig(input),
      templateId,
      dataset.fieldColumns,
      samples,
    );
    return { data: { config, changes } };
  } catch (error) {
    return fail(error);
  }
}

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export interface RecordHit {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

export async function searchRecordsAction(
  query: string,
  input: unknown,
): Promise<Result<RecordHit[]>> {
  try {
    const dataset = await requireDataset();
    const q = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (q.length < MIN_QUERY_LENGTH) return { data: [] };
    const config = parseRunConfig(input);
    const records = await repo.searchRecords(dataset.id, q);
    return {
      data: records.map((r) => ({
        id: r.id,
        label: groupLabel(r, config.match.fields),
        detail: [
          r.id,
          r.cells[config.match.fields.email ?? ""],
          r.cells[config.match.fields.company ?? ""],
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function sandboxAction(
  ids: readonly string[],
  input: unknown,
): Promise<Result<SandboxResult>> {
  try {
    const dataset = await requireDataset();
    const unique = [...new Set(ids)];
    if (unique.length < 2) throw new UserFacingError("Pick at least two records.");
    if (unique.length > MAX_PAIRWISE_RECORDS) {
      throw new UserFacingError(`Pick at most ${MAX_PAIRWISE_RECORDS} records.`);
    }
    const records = await repo.getRecordsByIds(dataset.id, unique);
    return { data: simulateMerge(records, dataset.fieldColumns, parseRunConfig(input)) };
  } catch (error) {
    return fail(error);
  }
}

export async function summarizeAction(input: unknown): Promise<Result<LogicSummary>> {
  try {
    const dataset = await requireDataset();
    return { data: summarizeLogic(parseRunConfig(input), dataset.fieldColumns) };
  } catch (error) {
    return fail(error);
  }
}
