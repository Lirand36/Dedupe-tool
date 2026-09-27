import type { RunConfig } from "./config";
import { normalizeFieldName } from "./presets";
import type { ChannelDefinition, FieldTag } from "./types";

export interface RuleTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const RULE_TEMPLATES: readonly RuleTemplate[] = [
  {
    id: "inbound-outbound",
    name: "Inbound vs outbound attribution",
    description:
      "Splits records into inbound and outbound by lead source. Attribution fields keep the first inbound value; SDR fields keep the latest outbound value.",
  },
  {
    id: "lifecycle-forward",
    name: "Lifecycle never goes backwards",
    description: "Stage and status fields keep the most advanced value any duplicate reached.",
  },
  {
    id: "newest-contact-info",
    name: "Keep the newest contact info",
    description: "Email, phone, title and address fields keep the most recent non-empty value.",
  },
  {
    id: "combine-multi-value",
    name: "Keep every value",
    description:
      "Interests, tags and product fields keep all distinct values from every duplicate.",
  },
];

export interface TemplateResult {
  readonly config: RunConfig;
  /** Plain-language notes on what changed and what needs a human look. */
  readonly changes: readonly string[];
}

type SampleValues = Readonly<Record<string, readonly string[]>>;

const SOURCE_FIELDS = [
  "leadsource",
  "hsanalyticssource",
  "source",
  "originalsource",
  "accountsource",
];
const INBOUND_WORDS =
  /web|form|webinar|organic|paid|search|referral|content|social|email|direct|inbound|demo|trial|chat|event|ads?\b/i;
const OUTBOUND_WORDS =
  /cold|outbound|prospect|sdr|bdr|list|purchased|call|outreach|sequence|cadence/i;
const INBOUND_FIELDS = /original|utm|first(?!name)|form|campaign|conversion|landing|referrer/;
const OUTBOUND_FIELDS = /sdr|bdr|sequence|cadence|outreach|prospector/;
const STAGE_FIELDS = /stage|status|lifecycle/;
const STAGE_ORDER = [
  "closed won",
  "customer",
  "evangelist",
  "opportunity",
  "sql",
  "salesqualifiedlead",
  "sales qualified lead",
  "mql",
  "marketingqualifiedlead",
  "marketing qualified lead",
  "lead",
  "subscriber",
];
const CONTACT_FIELDS =
  /^(email|emailaddress|phone|mobile|mobilephone|phonenumber|title|jobtitle)$|address|street|city|country|state|zip|postal/;
const MULTI_VALUE_FIELDS = /interest|tags?$|products?|segments?$|topics?$/;

function withFields(config: RunConfig, fields: Record<string, FieldTag>): RunConfig {
  return {
    ...config,
    policy: { ...config.policy, fields: { ...config.policy.fields, ...fields } },
  };
}

function matching(columns: readonly string[], pattern: RegExp): string[] {
  return columns.filter((c) => pattern.test(normalizeFieldName(c)));
}

function inboundOutbound(
  config: RunConfig,
  columns: readonly string[],
  samples: SampleValues,
): TemplateResult {
  const source = columns.find((c) => SOURCE_FIELDS.includes(normalizeFieldName(c)));
  if (!source) return { config, changes: ["No lead source field found, so nothing changed."] };
  const values = samples[source] ?? [];
  const outbound = values.filter((v) => OUTBOUND_WORDS.test(v));
  const inbound = values.filter((v) => !OUTBOUND_WORDS.test(v) && INBOUND_WORDS.test(v));
  const unassigned = values.filter((v) => !inbound.includes(v) && !outbound.includes(v));
  const channel = (name: string, list: string[]): ChannelDefinition => ({
    name,
    when: [{ field: source, op: "in", values: list }],
  });
  const others = config.policy.channels.filter(
    (c) => c.name !== "inbound" && c.name !== "outbound",
  );
  const rest = columns.filter((c) => c !== source);
  const inboundFields = matching(rest, INBOUND_FIELDS);
  const outboundFields = matching(rest, OUTBOUND_FIELDS).filter((c) => !inboundFields.includes(c));
  const fields: Record<string, FieldTag> = {
    [source]: { kind: "origin" },
    ...Object.fromEntries(
      inboundFields.map((f) => [f, { kind: "channel", channel: "inbound", pick: "earliest" }]),
    ),
    ...Object.fromEntries(
      outboundFields.map((f) => [f, { kind: "channel", channel: "outbound", pick: "latest" }]),
    ),
  };
  const next = withFields(config, fields);
  return {
    config: {
      ...next,
      policy: {
        ...next.policy,
        channels: [...others, channel("inbound", inbound), channel("outbound", outbound)],
      },
    },
    changes: [
      `Inbound when ${source} is ${inbound.join(", ") || "(none found yet)"}.`,
      `Outbound when ${source} is ${outbound.join(", ") || "(none found yet)"}.`,
      `First inbound value: ${inboundFields.join(", ") || "no fields matched"}.`,
      `Latest outbound value: ${outboundFields.join(", ") || "no fields matched"}.`,
      ...(unassigned.length > 0
        ? [`Not assigned to a channel, check these: ${unassigned.join(", ")}.`]
        : []),
    ],
  };
}

function stageRank(value: string): number {
  const index = STAGE_ORDER.indexOf(value.trim().toLowerCase());
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function lifecycleForward(
  config: RunConfig,
  columns: readonly string[],
  samples: SampleValues,
): TemplateResult {
  const stageFields = matching(columns, STAGE_FIELDS);
  if (stageFields.length === 0)
    return { config, changes: ["No stage or status field found, so nothing changed."] };
  const results = stageFields.map((field) => {
    const values = samples[field] ?? [];
    const ranking = [...values].sort((a, b) => {
      const [ra, rb] = [stageRank(a), stageRank(b)];
      return ra === rb ? 0 : ra - rb;
    });
    const unknown = values.filter((v) => stageRank(v) === Number.POSITIVE_INFINITY);
    const note = unknown.length > 0 ? ` Check where these belong: ${unknown.join(", ")}.` : "";
    return {
      field,
      tag: { kind: "strongest", ranking } as FieldTag,
      note: `${field}: ${ranking.join(" › ")}.${note}`,
    };
  });
  return {
    config: withFields(config, Object.fromEntries(results.map((r) => [r.field, r.tag]))),
    changes: results.map((r) => r.note),
  };
}

function tagAll(
  config: RunConfig,
  fields: readonly string[],
  tag: FieldTag,
  label: string,
): TemplateResult {
  if (fields.length === 0)
    return { config, changes: [`No ${label} fields found, so nothing changed.`] };
  return {
    config: withFields(config, Object.fromEntries(fields.map((f) => [f, tag]))),
    changes: [
      `${fields.join(", ")} now keep ${tag.kind === "combine" ? "every value" : "the newest value"}.`,
    ],
  };
}

/** Applies a starting rule set on top of the current config. Never mutates its input. */
export function applyTemplate(
  config: RunConfig,
  templateId: string,
  columns: readonly string[],
  samples: SampleValues,
): TemplateResult {
  switch (templateId) {
    case "inbound-outbound":
      return inboundOutbound(config, columns, samples);
    case "lifecycle-forward":
      return lifecycleForward(config, columns, samples);
    case "newest-contact-info":
      return tagAll(config, matching(columns, CONTACT_FIELDS), { kind: "current" }, "contact");
    case "combine-multi-value":
      return tagAll(
        config,
        matching(columns, MULTI_VALUE_FIELDS),
        { kind: "combine" },
        "multi-value",
      );
    default:
      throw new Error(`Unknown template "${templateId}"`);
  }
}
