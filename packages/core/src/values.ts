import type { FieldValue, Slot } from "./types";

export function isEmpty(value: FieldValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Comparison key so "SQL", " sql " and "Sql" count as the same value. */
export function valueKey(value: FieldValue): string {
  return String(value).trim().toLowerCase();
}

/** Flattens multi-value fields so each element can be compared on its own. */
export function toList(value: FieldValue): readonly (string | number | boolean)[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value;
  return [value as string | number | boolean];
}

function timeOf(slot: Slot): number {
  const t = Date.parse(slot.at);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** Total order on slots: by time, then by source id, so results never depend on merge order. */
export function compareSlots(a: Slot, b: Slot): number {
  const diff = timeOf(a) - timeOf(b);
  if (diff !== 0) return diff;
  if (a.sourceId === b.sourceId) return 0;
  return a.sourceId < b.sourceId ? -1 : 1;
}

export function earlierOf(a: Slot | undefined, b: Slot | undefined): Slot | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareSlots(a, b) <= 0 ? a : b;
}

export function laterOf(a: Slot | undefined, b: Slot | undefined): Slot | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareSlots(a, b) >= 0 ? a : b;
}
