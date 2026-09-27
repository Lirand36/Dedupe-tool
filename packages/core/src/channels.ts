import type { ChannelDefinition, Condition, SourceRecord } from "./types";
import { isEmpty, toList, valueKey } from "./values";

function holds(record: SourceRecord, condition: Condition): boolean {
  const value = record.fields[condition.field];
  if (condition.op === "notEmpty") return !isEmpty(value);
  if (value === undefined || isEmpty(value)) return false;
  const allowed = new Set(condition.values.map(valueKey));
  return toList(value).some((v) => allowed.has(valueKey(v)));
}

/** The first channel whose conditions all hold, or null. */
export function classifyChannel(
  record: SourceRecord,
  channels: readonly ChannelDefinition[],
): string | null {
  const match = channels.find((channel) => channel.when.every((c) => holds(record, c)));
  return match?.name ?? null;
}
