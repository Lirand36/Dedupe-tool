"use client";

import type { FieldTag, RunConfig } from "@dedupe/core";
import { useState, useTransition } from "react";
import { previewConfigAction, saveConfigAction } from "@/lib/actions";
import type { ImpactPreview } from "@/lib/service";
import { ChannelList, FieldTagRow, MatchSettings, type Suggestion } from "./logicParts";

export type { Suggestion } from "./logicParts";

const text = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : Array.isArray(v) ? v.join("; ") : String(v);

function withTag(config: RunConfig, field: string, tag: FieldTag | undefined): RunConfig {
  const { [field]: _removed, ...rest } = config.policy.fields;
  return {
    ...config,
    policy: { ...config.policy, fields: tag ? { ...rest, [field]: tag } : rest },
  };
}

function ImpactPanel({ preview }: { preview: ImpactPreview }) {
  const { policy, exampleFailures, groupsCompared } = preview;
  return (
    <div className="space-y-3 text-sm">
      <p>
        <strong>{policy.changedGroups}</strong> of {groupsCompared} duplicate groups would get a
        different clean record
        {Object.keys(policy.byField).length > 0 && (
          <>
            :{" "}
            {Object.entries(policy.byField)
              .map(([f, n]) => `${f} (${n})`)
              .join(", ")}
          </>
        )}
        . Matching changes apply on save.
      </p>
      {policy.samples.length > 0 && (
        <ul className="space-y-1">
          {policy.samples.slice(0, 6).map((s) => (
            <li key={`${s.sourceIds.join()}-${s.field}`} className="text-muted">
              {s.sourceIds.join(" + ")} · <span className="text-ink">{s.field}</span>:{" "}
              {text(s.before)} → <span className="font-medium text-ink">{text(s.after)}</span>
            </li>
          ))}
        </ul>
      )}
      {exampleFailures.length > 0 ? (
        <div className="rounded-lg bg-bad-soft p-3 text-bad">
          <strong>{exampleFailures.length} example check(s) would break:</strong>
          <ul className="mt-1 list-inside list-disc">
            {exampleFailures.map((f) => (
              <li key={`${f.example}-${f.field}`}>
                {f.example}: {f.field} should be "{text(f.expected)}", would be "{text(f.actual)}"
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-good">All saved examples still pass.</p>
      )}
    </div>
  );
}

export function LogicEditor(props: {
  initial: RunConfig;
  columns: readonly string[];
  suggestions: Record<string, Suggestion>;
}) {
  const [config, setConfig] = useState<RunConfig>(props.initial);
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const [status, setStatus] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(config) !== JSON.stringify(props.initial);

  const change = (next: RunConfig) => {
    setConfig(next);
    setPreview(null);
    setStatus(null);
  };
  const runPreview = () =>
    startTransition(async () => {
      const result = await previewConfigAction(config);
      if (result.error) setStatus({ tone: "bad", text: result.error });
      else setPreview(result.preview ?? null);
    });
  const save = () =>
    startTransition(async () => {
      const result = await saveConfigAction(config);
      setStatus(
        result.error
          ? { tone: "bad", text: result.error }
          : { tone: "good", text: result.message ?? "Saved" },
      );
      if (!result.error) setPreview(null);
    });

  return (
    <div className="space-y-6 pb-24">
      <section className="card p-5">
        <h2 className="font-semibold">Channels</h2>
        <p className="mb-4 text-sm text-muted">
          Define once what makes a record inbound, outbound or anything else. Channel fields then
          take their value only from records in that channel.
        </p>
        <ChannelList
          channels={config.policy.channels}
          columns={props.columns}
          onChange={(channels) => change({ ...config, policy: { ...config.policy, channels } })}
        />
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Fields</h2>
        <p className="mb-4 text-sm text-muted">
          One tag per field. Hover a tag to see what it keeps.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 font-medium">Field</th>
                <th className="w-40 pb-2 font-medium">Tag</th>
                <th className="pb-2 font-medium">Details</th>
                <th className="pb-2 font-medium">Why we suggested it</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {props.columns.map((field) => (
                <FieldTagRow
                  key={field}
                  field={field}
                  tag={config.policy.fields[field]}
                  suggestion={props.suggestions[field]}
                  channels={config.policy.channels}
                  onChange={(tag) => change(withTag(config, field, tag))}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Matching</h2>
        <p className="mb-4 text-sm text-muted">
          Which columns identify a {config.match.entity}, and how sure we must be.
        </p>
        <MatchSettings
          match={config.match}
          columns={props.columns}
          onChange={(match) => change({ ...config, match })}
        />
      </section>

      {preview && (
        <section className="card border-indigo-200 p-5">
          <h2 className="mb-3 font-semibold">What would change</h2>
          <ImpactPanel preview={preview} />
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
          {status && (
            <span
              className={`mr-auto text-sm whitespace-pre-line ${status.tone === "good" ? "text-good" : "text-bad"}`}
            >
              {status.text}
            </span>
          )}
          {dirty && !status && <span className="mr-auto text-sm text-muted">Unsaved changes</span>}
          <button
            type="button"
            className="btn-ghost"
            disabled={pending || !dirty}
            onClick={runPreview}
          >
            Preview impact
          </button>
          <button type="button" className="btn-primary" disabled={pending || !dirty} onClick={save}>
            {pending ? "Working…" : "Save and re-run"}
          </button>
        </div>
      </div>
    </div>
  );
}
