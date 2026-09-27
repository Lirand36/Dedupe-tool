import { type RawRecord, toSourceRecords } from "@dedupe/cli/csv";
import {
  goldenFromRecords,
  type PairExplanation,
  type RunConfig,
  scoreAllPairs,
} from "@dedupe/core";
import { buildComparison, type ComparisonRow } from "./views";

export interface SandboxResult {
  readonly recordIds: readonly string[];
  readonly pairs: readonly PairExplanation[];
  readonly rows: readonly ComparisonRow[];
}

/** "What if these records were duplicates?" under the given (possibly unsaved) rules. */
export function simulateMerge(
  raw: readonly RawRecord[],
  fieldColumns: readonly string[],
  config: RunConfig,
): SandboxResult {
  const records = toSourceRecords(raw, config.policy);
  return {
    recordIds: raw.map((r) => r.id),
    pairs: scoreAllPairs(records, config.match),
    rows: buildComparison(
      raw,
      fieldColumns,
      config.policy,
      goldenFromRecords(records, config.policy),
      {},
    ),
  };
}
