import { classifyChannel } from "./channels";
import type {
  Candidates,
  ChannelSlots,
  FieldCandidates,
  FieldTag,
  FieldValue,
  Policy,
  Slot,
  SourceRecord,
} from "./types";
import { compareSlots, earlierOf, isEmpty, laterOf, toList, valueKey } from "./values";

/** Caps distinct values per field so a noisy multi-select can never blow up storage. */
export const MAX_DISTINCT_VALUES = 50;

function keepsDistinctValues(tag: FieldTag): boolean {
  return tag.kind === "strongest" || tag.kind === "combine";
}

function distinctSlots(value: FieldValue, at: string, sourceId: string): readonly Slot[] {
  return toList(value).map((v) => ({ value: v, at, sourceId }));
}

function fieldCandidates(
  record: SourceRecord,
  field: string,
  value: FieldValue,
  tag: FieldTag,
  channel: string | null,
): FieldCandidates {
  const stamp = record.fieldTimestamps?.[field];
  const earliest: Slot = { value, at: stamp ?? record.createdAt, sourceId: record.id };
  const latest: Slot = { value, at: stamp ?? record.updatedAt, sourceId: record.id };
  return {
    earliest,
    latest,
    ...(channel !== null && { channels: { [channel]: { earliest, latest } } }),
    ...(keepsDistinctValues(tag) && { values: distinctSlots(value, earliest.at, record.id) }),
  };
}

/** Summarises one record into the candidate slots the policy needs. Empty values are skipped. */
export function candidatesFromRecord(record: SourceRecord, policy: Policy): Candidates {
  const channel = classifyChannel(record, policy.channels);
  const fields = Object.entries(policy.fields).flatMap(([field, tag]) => {
    const value = record.fields[field];
    if (value === undefined || isEmpty(value)) return [];
    return [[field, fieldCandidates(record, field, value, tag, channel)] as const];
  });
  return { sourceIds: [record.id], fields: Object.fromEntries(fields) };
}

function mergeChannels(
  a: Readonly<Record<string, ChannelSlots>> | undefined,
  b: Readonly<Record<string, ChannelSlots>> | undefined,
): Readonly<Record<string, ChannelSlots>> | undefined {
  if (!a) return b;
  if (!b) return a;
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const merged = names.map((name) => {
    const earliest = earlierOf(a[name]?.earliest, b[name]?.earliest) as Slot;
    const latest = laterOf(a[name]?.latest, b[name]?.latest) as Slot;
    return [name, { earliest, latest }] as const;
  });
  return Object.fromEntries(merged);
}

function mergeValues(
  a: readonly Slot[] | undefined,
  b: readonly Slot[] | undefined,
): readonly Slot[] | undefined {
  if (!a) return b;
  if (!b) return a;
  const byKey = new Map<string, Slot>();
  for (const slot of [...a, ...b]) {
    const key = valueKey(slot.value);
    const kept = earlierOf(byKey.get(key), slot) as Slot;
    byKey.set(key, kept);
  }
  return [...byKey.values()].sort(compareSlots).slice(0, MAX_DISTINCT_VALUES);
}

function mergeField(
  a: FieldCandidates | undefined,
  b: FieldCandidates | undefined,
): FieldCandidates {
  if (!a) return b as FieldCandidates;
  if (!b) return a;
  const earliest = earlierOf(a.earliest, b.earliest);
  const latest = laterOf(a.latest, b.latest);
  const channels = mergeChannels(a.channels, b.channels);
  const values = mergeValues(a.values, b.values);
  return {
    ...(earliest && { earliest }),
    ...(latest && { latest }),
    ...(channels && { channels }),
    ...(values && { values }),
  };
}

/** Combines two summaries. Order-independent: merge(a, b) equals merge(b, a). */
export function mergeCandidates(a: Candidates, b: Candidates): Candidates {
  const sourceIds = [...new Set([...a.sourceIds, ...b.sourceIds])].sort();
  const names = [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])].sort();
  const fields = names.map((name) => [name, mergeField(a.fields[name], b.fields[name])] as const);
  return { sourceIds, fields: Object.fromEntries(fields) };
}
