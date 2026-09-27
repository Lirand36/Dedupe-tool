import type { RunConfig } from "./config";
import { SIGNAL_SCORES } from "./matchScore";
import type { FieldTag } from "./types";

export interface SummaryGroup {
  readonly kind: FieldTag["kind"];
  readonly label: string;
  readonly sentence: string;
  readonly fields: readonly string[];
}

export interface LogicSummary {
  readonly matching: readonly string[];
  readonly groups: readonly SummaryGroup[];
  readonly untagged: readonly string[];
}

function verdict(score: number, thresholds: RunConfig["match"]["thresholds"]): string {
  if (score >= thresholds.auto) return "merged automatically";
  if (score >= thresholds.review) return "sent to review";
  return "ignored";
}

function personMatching(config: RunConfig): string[] {
  const { fields, thresholds } = config.match;
  const v = (score: number) => verdict(score, thresholds);
  const hasName = Boolean(fields.fullName || fields.firstName || fields.lastName);
  const hasOrg = Boolean(fields.email || fields.company || fields.website);
  return [
    fields.email
      ? `Same email: ${v(SIGNAL_SCORES.sameEmail)}.`
      : "No email column is mapped, so email isn't used.",
    ...(fields.email && hasName
      ? [
          `Same email but clearly different names (a shared inbox): ${v(SIGNAL_SCORES.sameEmailDifferentName)}.`,
        ]
      : []),
    fields.phone && hasName
      ? `Same phone and a similar name: ${v(SIGNAL_SCORES.samePhoneSimilarName)}.`
      : "No phone column is mapped, so phone isn't used.",
    ...(hasName && hasOrg
      ? [`Similar name at the same company: ${v(SIGNAL_SCORES.similarNameSameCompany)} at most.`]
      : []),
    "Free email domains like gmail.com are never treated as a shared company.",
  ];
}

function companyMatching(config: RunConfig): string[] {
  const { fields, thresholds } = config.match;
  const v = (score: number) => verdict(score, thresholds);
  return [
    fields.website
      ? `Same website domain: ${v(SIGNAL_SCORES.sameDomain)}.`
      : "No website column is mapped, so domains aren't used.",
    ...(fields.company
      ? [
          `Same company name: ${v(SIGNAL_SCORES.sameCompanyName)}.`,
          `Similar company name: ${v(SIGNAL_SCORES.similarCompanyName)} at most.`,
        ]
      : []),
    ...(fields.phone && fields.company
      ? [`Same phone and a similar name: ${v(SIGNAL_SCORES.companyPhoneConfirmed)}.`]
      : []),
  ];
}

function groupKey(tag: FieldTag): string {
  return tag.kind === "channel" ? `channel:${tag.pick}:${tag.channel}` : tag.kind;
}

function describe(
  tag: FieldTag,
  fields: readonly string[],
  all: RunConfig["policy"]["fields"],
): SummaryGroup {
  const list = fields.join(", ");
  switch (tag.kind) {
    case "origin":
      return {
        kind: tag.kind,
        label: "Origin",
        fields,
        sentence: `${list} keep the earliest value: how they first came in.`,
      };
    case "current":
      return {
        kind: tag.kind,
        label: "Current",
        fields,
        sentence: `${list} keep the newest non-empty value.`,
      };
    case "combine":
      return {
        kind: tag.kind,
        label: "Combine",
        fields,
        sentence: `${list} keep every distinct value.`,
      };
    case "channel": {
      const label = `${tag.pick === "earliest" ? "First" : "Latest"} ${tag.channel}`;
      return {
        kind: tag.kind,
        label,
        fields,
        sentence: `${list} come from the ${label.toLowerCase()} record.`,
      };
    }
    case "strongest": {
      const parts = fields.map((f) => {
        const t = all[f];
        const ranking =
          t?.kind === "strongest" && t.ranking.length > 0
            ? ` (${t.ranking.join(" › ")})`
            : " (no ranking set yet)";
        return `${f} never goes backwards${ranking}`;
      });
      return { kind: tag.kind, label: "Strongest", fields, sentence: `${parts.join("; ")}.` };
    }
  }
}

/** The whole logic in plain words, for the Rules page and for sharing with stakeholders. */
export function summarizeLogic(config: RunConfig, columns: readonly string[]): LogicSummary {
  const byGroup = new Map<string, { tag: FieldTag; fields: string[] }>();
  for (const [field, tag] of Object.entries(config.policy.fields)) {
    const key = groupKey(tag);
    const entry = byGroup.get(key);
    byGroup.set(key, { tag: entry?.tag ?? tag, fields: [...(entry?.fields ?? []), field] });
  }
  return {
    matching: config.match.entity === "person" ? personMatching(config) : companyMatching(config),
    groups: [...byGroup.values()].map(({ tag, fields }) =>
      describe(tag, fields, config.policy.fields),
    ),
    untagged: columns.filter((c) => !(c in config.policy.fields)),
  };
}

function tagLabel(tag: FieldTag): string {
  return tag.kind === "channel"
    ? `${tag.pick === "earliest" ? "first" : "latest"} ${tag.channel}`
    : tag.kind;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** What changed between two versions of the rules, one line per change, for the History log. */
export function diffConfigs(before: RunConfig, after: RunConfig): string[] {
  const channelsBefore = new Map(before.policy.channels.map((c) => [c.name, JSON.stringify(c)]));
  const channelsAfter = new Map(after.policy.channels.map((c) => [c.name, JSON.stringify(c)]));
  const channelChanges = [
    ...[...channelsAfter].flatMap(([name, def]) =>
      !channelsBefore.has(name)
        ? [`Added channel ${name}`]
        : channelsBefore.get(name) !== def
          ? [`Changed channel ${name}`]
          : [],
    ),
    ...[...channelsBefore.keys()]
      .filter((n) => !channelsAfter.has(n))
      .map((n) => `Removed channel ${n}`),
  ];
  const fieldChanges = [
    ...Object.entries(after.policy.fields).flatMap(([field, tag]) => {
      const old = before.policy.fields[field];
      if (!old) return [`${field}: now ${tagLabel(tag)}`];
      if (JSON.stringify(old) === JSON.stringify(tag)) return [];
      return tagLabel(old) === tagLabel(tag)
        ? [`${field}: ranking changed`]
        : [`${field}: ${tagLabel(old)} → ${tagLabel(tag)}`];
    }),
    ...Object.keys(before.policy.fields)
      .filter((f) => !(f in after.policy.fields))
      .map((f) => `${f}: no longer tagged`),
  ];
  const matchKeys = [
    ...new Set([...Object.keys(before.match.fields), ...Object.keys(after.match.fields)]),
  ];
  const matchChanges = matchKeys.flatMap((key) => {
    const [old, next] = [
      before.match.fields[key as keyof typeof before.match.fields],
      after.match.fields[key as keyof typeof after.match.fields],
    ];
    if (old === next) return [];
    if (!next) return [`Match on ${key}: no longer used`];
    return [old ? `Match on ${key}: ${old} → ${next}` : `Match on ${key}: now ${next}`];
  });
  const t = [before.match.thresholds, after.match.thresholds] as const;
  const thresholdChanges = [
    ...(t[0].auto !== t[1].auto
      ? [`Auto-merge threshold: ${pct(t[0].auto)} → ${pct(t[1].auto)}`]
      : []),
    ...(t[0].review !== t[1].review
      ? [`Review threshold: ${pct(t[0].review)} → ${pct(t[1].review)}`]
      : []),
  ];
  return [...channelChanges, ...fieldChanges, ...matchChanges, ...thresholdChanges];
}
