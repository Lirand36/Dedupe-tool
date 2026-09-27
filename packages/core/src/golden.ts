import { candidatesFromRecord, mergeCandidates } from "./candidates";
import { resolveGolden } from "./resolve";
import type { GoldenRecord, Policy, SourceRecord } from "./types";

/** Summarises a group of duplicate records and computes their clean record. */
export function goldenFromRecords(records: readonly SourceRecord[], policy: Policy): GoldenRecord {
  const summaries = records.map((r) => candidatesFromRecord(r, policy));
  const merged = summaries.reduce(mergeCandidates, { sourceIds: [], fields: {} });
  return resolveGolden(merged, policy);
}
