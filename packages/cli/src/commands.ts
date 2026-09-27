import { readFile, writeFile } from "node:fs/promises";
import { parseRunConfig, type RunStats, runPipeline } from "@dedupe/core";
import { identitiesToCsv, readRows, recordsFromCsv } from "./csv";
import { type FieldSuggestionRow, suggestConfig } from "./suggestConfig";

export interface RunOptions {
  readonly input: string;
  readonly config: string;
  readonly out: string;
  readonly report?: string;
}

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${(error as Error).message}`);
  }
}

/** Reads a CSV export, finds duplicates and writes one clean row per identity. Never touches a CRM. */
export async function runCommand(options: RunOptions): Promise<RunStats> {
  const config = parseRunConfig(await readJson(options.config));
  const records = recordsFromCsv(await readFile(options.input, "utf8"), config.policy);
  const result = runPipeline(records, config);
  await writeFile(options.out, identitiesToCsv(result, config.policy));
  if (options.report) await writeFile(options.report, `${JSON.stringify(result, null, 2)}\n`);
  return result.stats;
}

export interface SuggestOptions {
  readonly input: string;
  readonly out: string;
  readonly entity?: "person" | "company";
}

/** Drafts a config from a CSV's headers and writes it for RevOps to review. */
export async function suggestCommand(options: SuggestOptions): Promise<FieldSuggestionRow[]> {
  const { headers } = readRows(await readFile(options.input, "utf8"));
  const { config, rows } = suggestConfig(headers, options.entity);
  await writeFile(options.out, `${JSON.stringify(config, null, 2)}\n`);
  return rows;
}
