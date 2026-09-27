import type { RunConfig } from "./config";
import { goldenFromRecords } from "./golden";
import { type Evidence, findDuplicates } from "./match";
import type { GoldenRecord, SourceRecord } from "./types";
import { compareSlots } from "./values";

export interface Identity {
  readonly id: string;
  readonly sourceIds: readonly string[];
  readonly tier: "auto" | "review";
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
  /** The CRM record that survives the merge. Its fields are overwritten with the golden values. */
  readonly keepRecordId: string;
  readonly removeRecordIds: readonly string[];
  readonly golden: GoldenRecord;
}

export interface RunStats {
  readonly records: number;
  readonly duplicateGroups: number;
  readonly autoGroups: number;
  readonly reviewGroups: number;
  readonly recordsToRemove: number;
}

export interface RunResult {
  readonly identities: readonly Identity[];
  readonly stats: RunStats;
}

/** Default choice of which record to keep: the oldest one. Connectors can refine this later. */
function oldestRecord(records: readonly SourceRecord[]): SourceRecord {
  const bySlot = (r: SourceRecord) => ({ value: null, at: r.createdAt, sourceId: r.id });
  return [...records].sort((a, b) => compareSlots(bySlot(a), bySlot(b)))[0] as SourceRecord;
}

/** Match -> group -> compute clean records. Pure: reads nothing and writes nothing. */
export function runPipeline(records: readonly SourceRecord[], config: RunConfig): RunResult {
  const byId = new Map(records.map((r) => [r.id, r]));
  const identities = findDuplicates(records, config.match).map((group): Identity => {
    const members = group.ids.map((id) => byId.get(id) as SourceRecord);
    const keep = oldestRecord(members);
    return {
      id: `idn_${keep.id}`,
      sourceIds: group.ids,
      tier: group.tier,
      confidence: group.confidence,
      evidence: group.evidence,
      keepRecordId: keep.id,
      removeRecordIds: group.ids.filter((id) => id !== keep.id),
      golden: goldenFromRecords(members, config.policy),
    };
  });
  const autoGroups = identities.filter((i) => i.tier === "auto").length;
  return {
    identities,
    stats: {
      records: records.length,
      duplicateGroups: identities.length,
      autoGroups,
      reviewGroups: identities.length - autoGroups,
      recordsToRemove: identities.reduce((n, i) => n + i.removeRecordIds.length, 0),
    },
  };
}
