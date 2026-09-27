import type { FieldTag } from "./types";

export interface TagSuggestion {
  readonly tag: FieldTag;
  readonly confidence: "high" | "low";
  readonly why: string;
}

interface NameRule {
  readonly pattern: RegExp;
  readonly tag: FieldTag;
  readonly why: string;
}

/** Ordered: the first matching rule wins, so "First Name" is identity and "First_Last_Touch" is origin. */
const NAME_RULES: readonly NameRule[] = [
  {
    pattern: /^(first|last)_?name$/,
    tag: { kind: "current" },
    why: "Identity field: keep the latest spelling",
  },
  {
    pattern: /(^|_)(first|original|orig|initial)(_|$)/,
    tag: { kind: "origin" },
    why: "Name says it records how the person first arrived",
  },
  { pattern: /lead_?source|(^|_)utm_/, tag: { kind: "origin" }, why: "Attribution field" },
  {
    pattern: /(^|_)(last|latest|recent)(_|$)/,
    tag: { kind: "current" },
    why: "Name says it tracks the latest state",
  },
  {
    pattern: /stage|status/,
    tag: { kind: "strongest", ranking: [] },
    why: "Funnel field: keep the most advanced value (set the ranking)",
  },
  { pattern: /interest|tags?$|products?/, tag: { kind: "combine" }, why: "Multi-value field" },
];

/** Splits camelCase and normalises separators so "LeadSource" and "lead source" look alike. */
function normalizeName(field: string): string {
  return field
    .replace(/__c$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

/** Guesses what a field means from its name. RevOps confirms or changes the guess. */
export function suggestTag(field: string): TagSuggestion {
  const name = normalizeName(field);
  const rule = NAME_RULES.find((r) => r.pattern.test(name));
  if (rule) return { tag: rule.tag, confidence: "high", why: rule.why };
  return { tag: { kind: "current" }, confidence: "low", why: "Default: keep the latest value" };
}
