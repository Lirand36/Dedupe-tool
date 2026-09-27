import type { FieldTag } from "@dedupe/core";

export type Tone = "sky" | "emerald" | "violet" | "amber" | "pink" | "rose" | "teal" | "slate";

/** Hex pairs for SVG, where Tailwind classes can't reach: [strong, soft]. */
export const TONE_HEX: Record<Tone, readonly [string, string]> = {
  sky: ["#0284c7", "#e0f2fe"],
  emerald: ["#059669", "#d1fae5"],
  violet: ["#7c3aed", "#ede9fe"],
  amber: ["#d97706", "#fef3c7"],
  pink: ["#db2777", "#fce7f3"],
  rose: ["#e11d48", "#ffe4e6"],
  teal: ["#0d9488", "#ccfbf1"],
  slate: ["#64748b", "#f1f5f9"],
};

export const TONE_CLASS: Record<Tone, string> = {
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function tagTone(tag: FieldTag | undefined): Tone {
  if (!tag) return "slate";
  switch (tag.kind) {
    case "origin":
      return "sky";
    case "current":
      return "emerald";
    case "strongest":
      return "rose";
    case "combine":
      return "teal";
    case "channel":
      return tag.channel === "inbound" ? "violet" : tag.channel === "outbound" ? "amber" : "pink";
  }
}

export function tagLabel(tag: FieldTag | undefined): string {
  if (!tag) return "Not tagged";
  if (tag.kind === "channel")
    return `${tag.pick === "earliest" ? "First" : "Latest"} ${tag.channel}`;
  return tag.kind.charAt(0).toUpperCase() + tag.kind.slice(1);
}

/** Where the surviving value comes from, in a few words. */
export function tagSource(tag: FieldTag | undefined): string {
  if (!tag) return "Stays as on the kept record";
  switch (tag.kind) {
    case "origin":
      return "Earliest record with a value";
    case "current":
      return "Newest record with a value";
    case "strongest":
      return tag.ranking.length > 0
        ? `Highest of ${tag.ranking.join(" › ")}`
        : "Highest ranked value (set a ranking)";
    case "combine":
      return "Every record, all values";
    case "channel":
      return `${tag.pick === "earliest" ? "First" : "Latest"} ${tag.channel} record`;
  }
}

export const SYSTEM_COLOR: Record<string, string> = {
  salesforce: "#0176d3",
  hubspot: "#ff7a59",
  other: "#64748b",
};
