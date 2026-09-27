"use client";

import type { ChannelDefinition, FieldTag, MatchConfig } from "@dedupe/core";

export interface Suggestion {
  kind: FieldTag["kind"];
  confidence: "high" | "low";
  why: string;
}

export const TAG_OPTIONS: ReadonlyArray<{
  value: FieldTag["kind"] | "none";
  label: string;
  help: string;
}> = [
  { value: "origin", label: "Origin", help: "Keep the earliest value: how they first came in" },
  { value: "current", label: "Current", help: "Keep the latest non-empty value" },
  { value: "channel", label: "Channel", help: "Earliest or latest value from one channel" },
  { value: "strongest", label: "Strongest", help: "Highest value in a ranking you set" },
  { value: "combine", label: "Combine", help: "Keep every distinct value" },
  { value: "none", label: "Not tagged", help: "Left as on the kept record" },
];

const splitList = (text: string) =>
  text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export function defaultTag(
  kind: FieldTag["kind"],
  channels: readonly ChannelDefinition[],
): FieldTag {
  switch (kind) {
    case "channel":
      return { kind, channel: channels[0]?.name ?? "", pick: "latest" };
    case "strongest":
      return { kind, ranking: [] };
    default:
      return { kind };
  }
}

export function FieldTagRow(props: {
  field: string;
  tag: FieldTag | undefined;
  suggestion: Suggestion | undefined;
  channels: readonly ChannelDefinition[];
  onChange: (tag: FieldTag | undefined) => void;
}) {
  const { field, tag, suggestion, channels, onChange } = props;
  const isGuess = suggestion && tag?.kind === suggestion.kind && suggestion.confidence === "low";
  return (
    <tr>
      <td className="py-2 pr-4 font-medium whitespace-nowrap">
        {field}
        {isGuess && (
          <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-normal text-warn">
            guess
          </span>
        )}
      </td>
      <td className="py-2 pr-4">
        <select
          aria-label={`Tag for ${field}`}
          className="input py-1.5"
          value={tag?.kind ?? "none"}
          title={TAG_OPTIONS.find((o) => o.value === (tag?.kind ?? "none"))?.help}
          onChange={(e) => {
            const kind = e.target.value as FieldTag["kind"] | "none";
            onChange(kind === "none" ? undefined : defaultTag(kind, channels));
          }}
        >
          {TAG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-4">
        {tag?.kind === "channel" && (
          <div className="flex gap-2">
            <select
              aria-label={`${field} pick`}
              className="input py-1.5"
              value={tag.pick}
              onChange={(e) => onChange({ ...tag, pick: e.target.value as "earliest" | "latest" })}
            >
              <option value="earliest">Earliest from</option>
              <option value="latest">Latest from</option>
            </select>
            <select
              aria-label={`${field} channel`}
              className="input py-1.5"
              value={tag.channel}
              onChange={(e) => onChange({ ...tag, channel: e.target.value })}
            >
              {channels.length === 0 && <option value="">Add a channel first</option>}
              {channels.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tag?.kind === "strongest" && (
          <input
            aria-label={`${field} ranking`}
            className="input py-1.5"
            placeholder="Strongest first: Customer, SQL, MQL, Lead"
            defaultValue={tag.ranking.join(", ")}
            onBlur={(e) => onChange({ ...tag, ranking: splitList(e.target.value) })}
          />
        )}
      </td>
      <td className="py-2 text-xs text-muted">{suggestion?.why}</td>
    </tr>
  );
}

export function ChannelList(props: {
  channels: readonly ChannelDefinition[];
  columns: readonly string[];
  onChange: (channels: ChannelDefinition[]) => void;
}) {
  const { channels, columns, onChange } = props;
  const update = (index: number, next: ChannelDefinition) =>
    onChange(channels.map((c, i) => (i === index ? next : c)));
  const firstCondition = (c: ChannelDefinition) => {
    const cond = c.when[0];
    return cond?.op === "in"
      ? cond
      : { field: columns[0] ?? "", op: "in" as const, values: [] as string[] };
  };
  return (
    <div className="space-y-2">
      {channels.map((channel, index) => {
        const cond = firstCondition(channel);
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: channels have no stable id; names change while typing
            key={index}
            className="grid gap-2 sm:grid-cols-[160px_180px_1fr_auto] sm:items-center"
          >
            <input
              aria-label="Channel name"
              className="input py-1.5"
              value={channel.name}
              placeholder="inbound"
              onChange={(e) => update(index, { ...channel, name: e.target.value.trim() })}
            />
            <select
              aria-label="Channel field"
              className="input py-1.5"
              value={cond.field}
              onChange={(e) =>
                update(index, { ...channel, when: [{ ...cond, field: e.target.value }] })
              }
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  when {c} is
                </option>
              ))}
            </select>
            <input
              aria-label="Channel values"
              className="input py-1.5"
              placeholder="Web Form, Webinar"
              defaultValue={cond.values.join(", ")}
              onBlur={(e) =>
                update(index, {
                  ...channel,
                  when: [{ ...cond, values: splitList(e.target.value) }],
                })
              }
            />
            <button
              type="button"
              className="text-xs text-muted hover:text-bad"
              onClick={() => onChange(channels.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="btn-ghost py-1.5 text-xs"
        onClick={() =>
          onChange([
            ...channels,
            { name: "", when: [{ field: columns[0] ?? "", op: "in", values: [] }] },
          ])
        }
      >
        + Add channel
      </button>
    </div>
  );
}

const MATCH_FIELDS: ReadonlyArray<{ key: keyof MatchConfig["fields"]; label: string }> = [
  { key: "email", label: "Email" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "fullName", label: "Full name" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company name" },
  { key: "website", label: "Website" },
];

export function MatchSettings(props: {
  match: MatchConfig;
  columns: readonly string[];
  onChange: (match: MatchConfig) => void;
}) {
  const { match, columns, onChange } = props;
  const setField = (key: keyof MatchConfig["fields"], column: string) => {
    const { [key]: _removed, ...rest } = match.fields;
    onChange({ ...match, fields: column ? { ...rest, [key]: column } : rest });
  };
  const setThreshold = (key: "auto" | "review", value: number) =>
    onChange({ ...match, thresholds: { ...match.thresholds, [key]: value } });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        {MATCH_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="label" htmlFor={`match-${key}`}>
              {label}
            </label>
            <select
              id={`match-${key}`}
              className="input py-1.5"
              value={match.fields[key] ?? ""}
              onChange={(e) => setField(key, e.target.value)}
            >
              <option value="">—</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div>
          <label className="label" htmlFor="match-country">
            Default phone country
          </label>
          <input
            id="match-country"
            className="input py-1.5"
            maxLength={2}
            placeholder="US"
            value={match.defaultCountry ?? ""}
            onChange={(e) => {
              const { defaultCountry: _removed, ...rest } = match;
              const value = e.target.value.toUpperCase();
              onChange(value ? { ...rest, defaultCountry: value } : rest);
            }}
          />
        </div>
      </div>
      <div className="space-y-5">
        {(["auto", "review"] as const).map((key) => (
          <div key={key}>
            <div className="mb-1 flex justify-between text-sm">
              <label htmlFor={`threshold-${key}`} className="font-medium">
                {key === "auto" ? "Merge automatically at" : "Send to Inbox at"}
              </label>
              <span className="tabular-nums">{Math.round(match.thresholds[key] * 100)}%</span>
            </div>
            <input
              id={`threshold-${key}`}
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={match.thresholds[key]}
              onChange={(e) => setThreshold(key, Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>
        ))}
        <p className="text-xs text-muted">
          Only an exact email match reaches 100%. Shared phones and similar names never merge on
          their own.
        </p>
      </div>
    </div>
  );
}
