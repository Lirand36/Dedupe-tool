import { type FieldTag, type MatchConfig, type RunConfig, suggestTag } from "@dedupe/core";
import { RESERVED_COLUMNS } from "./csv";

type MatchField = keyof MatchConfig["fields"];

const MATCH_COLUMN_PATTERNS: ReadonlyArray<readonly [MatchField, RegExp]> = [
  ["email", /^e_?mail(_address)?$/],
  ["phone", /^(phone|mobile|mobile_phone|phone_number)$/],
  ["firstName", /^first_?name$/],
  ["lastName", /^last_?name$/],
  ["fullName", /^(full_?name|name)$/],
  ["company", /^(company|company_name|account|account_name)$/],
  ["website", /^(website|domain|url|company_website)$/],
];

export interface FieldSuggestionRow {
  readonly field: string;
  readonly tag: string;
  readonly confidence: "high" | "low";
  readonly why: string;
}

function simplify(header: string): string {
  return header
    .replace(/__c$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function guessMatchFields(headers: readonly string[]): MatchConfig["fields"] {
  const pairs = MATCH_COLUMN_PATTERNS.flatMap(([key, pattern]) => {
    const header = headers.find((h) => pattern.test(simplify(h)));
    return header ? [[key, header] as const] : [];
  });
  return Object.fromEntries(pairs);
}

function describeTag(tag: FieldTag): string {
  return tag.kind === "channel" ? `channel:${tag.channel}:${tag.pick}` : tag.kind;
}

/** Drafts a config from CSV headers so RevOps starts by confirming guesses, not writing JSON. */
export function suggestConfig(
  headers: readonly string[],
  entity: MatchConfig["entity"] = "person",
): { config: RunConfig; rows: FieldSuggestionRow[] } {
  const suggestions = headers
    .filter((h) => !RESERVED_COLUMNS.has(h))
    .map((field) => ({ field, ...suggestTag(field) }));
  const config: RunConfig = {
    policy: {
      channels: [],
      fields: Object.fromEntries(suggestions.map((s) => [s.field, s.tag])),
    },
    match: {
      entity,
      fields: guessMatchFields(headers),
      thresholds: { auto: 0.95, review: 0.75 },
    },
  };
  const rows = suggestions.map((s) => ({
    field: s.field,
    tag: describeTag(s.tag),
    confidence: s.confidence,
    why: s.why,
  }));
  return { config, rows };
}
