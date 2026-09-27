import type {
  Candidates,
  FieldCandidates,
  FieldTag,
  FieldValue,
  GoldenRecord,
  Reason,
  Slot,
} from "./types";
import { compareSlots, valueKey } from "./values";

interface Resolved {
  readonly value: FieldValue;
  readonly reason: Reason;
}

const NO_VALUE: Resolved = { value: null, reason: { text: "No value on any record" } };

function fromSlot(slot: Slot | undefined, text: string): Resolved {
  if (!slot) return NO_VALUE;
  return {
    value: slot.value,
    reason: { text: `${text} (${slot.at.slice(0, 10)})`, sourceId: slot.sourceId, at: slot.at },
  };
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function resolveStrongest(fc: FieldCandidates, ranking: readonly string[]): Resolved {
  const rankOf = new Map(ranking.map((v, i) => [valueKey(v), i]));
  const ranked = (fc.values ?? [])
    .filter((slot) => rankOf.has(valueKey(slot.value)))
    .sort((a, b) => (rankOf.get(valueKey(a.value)) ?? 0) - (rankOf.get(valueKey(b.value)) ?? 0));
  if (ranked[0]) return fromSlot(ranked[0], "Strongest: highest-ranked value");
  return fromSlot(fc.latest, "Strongest: no value in ranking, used latest value");
}

function resolveCombine(fc: FieldCandidates): Resolved {
  const slots = [...(fc.values ?? [])].sort(compareSlots);
  const records = new Set(slots.map((s) => s.sourceId)).size;
  return {
    value: slots.map((s) => String(s.value)),
    reason: { text: `Combined ${slots.length} values from ${records} record(s)` },
  };
}

function resolveField(fc: FieldCandidates | undefined, tag: FieldTag): Resolved {
  if (tag.kind === "channel") {
    const slot = fc?.channels?.[tag.channel]?.[tag.pick];
    if (!slot) return { value: null, reason: { text: `No ${tag.channel} record has a value` } };
    return fromSlot(slot, `${capitalize(tag.pick)} ${tag.channel} value`);
  }
  if (!fc) return NO_VALUE;
  switch (tag.kind) {
    case "origin":
      return fromSlot(fc.earliest, "Origin: earliest value");
    case "current":
      return fromSlot(fc.latest, "Current: latest value");
    case "strongest":
      return resolveStrongest(fc, tag.ranking);
    case "combine":
      return resolveCombine(fc);
  }
}

/** Computes the clean record for one identity, with a reason for every field. */
export function resolveGolden(
  candidates: Candidates,
  policy: { readonly fields: Readonly<Record<string, FieldTag>> },
): GoldenRecord {
  const resolved = Object.entries(policy.fields).map(
    ([field, tag]) => [field, resolveField(candidates.fields[field], tag)] as const,
  );
  return {
    values: Object.fromEntries(resolved.map(([field, r]) => [field, r.value])),
    reasons: Object.fromEntries(resolved.map(([field, r]) => [field, r.reason])),
  };
}
