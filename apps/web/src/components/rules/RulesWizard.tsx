"use client";

import type { FieldTag, LogicSummary, RuleTemplate, RunConfig } from "@dedupe/core";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChannelList, FieldTagRow, MatchSettings, type Suggestion } from "@/components/logicParts";
import { previewConfigAction, saveConfigAction } from "@/lib/actions";
import { summarizeAction } from "@/lib/rulesActions";
import type { ImpactPreview } from "@/lib/service";
import { STEPS, type StepKey } from "@/lib/steps";
import { ImpactPanel } from "./ImpactPanel";
import { Sandbox } from "./Sandbox";
import { TemplatesPanel } from "./TemplatesPanel";

interface Props {
  initialStep: StepKey;
  initial: RunConfig;
  columns: readonly string[];
  suggestions: Record<string, Suggestion>;
  templates: readonly RuleTemplate[];
  object: { label: string; name: string; records: number };
}

function withTag(config: RunConfig, field: string, tag: FieldTag | undefined): RunConfig {
  const { [field]: _removed, ...rest } = config.policy.fields;
  return {
    ...config,
    policy: { ...config.policy, fields: tag ? { ...rest, [field]: tag } : rest },
  };
}

function Stepper({ step, onPick }: { step: number; onPick: (i: number) => void }) {
  return (
    <ol className="card flex flex-wrap items-center gap-2 p-3">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPick(i)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              i === step
                ? "bg-accent text-white"
                : i < step
                  ? "text-good hover:bg-good-soft"
                  : "text-muted hover:bg-slate-50"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                i === step ? "bg-white/20" : i < step ? "bg-good-soft" : "bg-slate-100"
              }`}
            >
              {i < step ? <Check size={12} aria-hidden /> : i + 1}
            </span>
            {s.label}
          </button>
          {i < STEPS.length - 1 && (
            <span className="hidden h-px w-6 bg-line sm:block" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}

export function RulesWizard(props: Props) {
  const router = useRouter();
  const [step, setStep] = useState(
    Math.max(
      0,
      STEPS.findIndex((s) => s.key === props.initialStep),
    ),
  );
  const [config, setConfig] = useState<RunConfig>(props.initial);
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const [summary, setSummary] = useState<LogicSummary | null>(null);
  const [status, setStatus] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  /** Bumped when a template rewrites the config, so inputs that keep local text pick up new values. */
  const [templateVersion, setTemplateVersion] = useState(0);
  const dirty = JSON.stringify(config) !== JSON.stringify(props.initial);
  const key = STEPS[step]?.key;

  const change = (next: RunConfig) => {
    setConfig(next);
    setPreview(null);
    setSummary(null);
    setStatus(null);
  };

  useEffect(() => {
    if (key === "test" && !preview) {
      startTransition(async () => {
        const r = await previewConfigAction(config);
        if (r.error) setStatus({ tone: "bad", text: r.error });
        else setPreview(r.preview ?? null);
      });
    }
    if (key === "live" && !summary) {
      startTransition(async () => {
        const r = await summarizeAction(config);
        if (r.error !== undefined) setStatus({ tone: "bad", text: r.error });
        else setSummary(r.data);
      });
    }
  }, [key, preview, summary, config]);

  const goLive = () =>
    startTransition(async () => {
      const r = await saveConfigAction(config);
      if (r.error) {
        setStatus({ tone: "bad", text: r.error });
        return;
      }
      router.push("/rules?live=1");
    });

  return (
    <div className="space-y-6 pb-24">
      <Stepper step={step} onPick={setStep} />

      {key === "object" && (
        <section className="card p-6">
          <div className="text-xs font-medium text-muted">{props.object.label}</div>
          <h2 className="mt-1 text-lg font-semibold">{props.object.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {props.object.records.toLocaleString()} records · {props.columns.length} fields. Rules
            below apply to this object only.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {props.columns.map((c) => (
              <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {c}
              </span>
            ))}
          </div>
          <Link href="/objects" className="mt-5 inline-block text-sm text-accent hover:underline">
            Use a different object
          </Link>
        </section>
      )}

      {key === "match" && (
        <section className="card p-6">
          <h2 className="font-semibold">How should duplicates be found?</h2>
          <p className="mb-5 text-sm text-muted">
            Map the columns that identify a {config.match.entity}. Only an exact email or domain
            match can merge on its own.
          </p>
          <MatchSettings
            match={config.match}
            columns={props.columns}
            onChange={(match) => change({ ...config, match })}
          />
        </section>
      )}

      {key === "keep" && (
        <>
          <TemplatesPanel
            templates={props.templates}
            config={config}
            onApply={(next) => {
              change(next);
              setTemplateVersion((v) => v + 1);
            }}
          />
          <section className="card p-5">
            <h2 className="font-semibold">Channels</h2>
            <p className="mb-4 text-sm text-muted">
              What makes a record inbound, outbound or anything else. Define once.
            </p>
            <ChannelList
              key={templateVersion}
              channels={config.policy.channels}
              columns={props.columns}
              onChange={(channels) => change({ ...config, policy: { ...config.policy, channels } })}
            />
          </section>
          <section className="card p-5">
            <h2 className="font-semibold">Fields</h2>
            <p className="mb-4 text-sm text-muted">
              One rule per field. Hover a rule to see what it keeps.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="pb-2 font-medium">Field</th>
                    <th className="w-40 pb-2 font-medium">Rule</th>
                    <th className="pb-2 font-medium">Details</th>
                    <th className="pb-2 font-medium">Why we suggested it</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {props.columns.map((field) => (
                    <FieldTagRow
                      key={`${field}-${templateVersion}`}
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
        </>
      )}

      {key === "test" && (
        <>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">What would change</h2>
            {preview ? (
              <ImpactPanel preview={preview} />
            ) : (
              <p className="text-sm text-muted">Comparing with the live rules…</p>
            )}
          </section>
          <Sandbox config={config} />
        </>
      )}

      {key === "live" && (
        <section className="card p-6">
          <h2 className="font-semibold">Ready to go live</h2>
          <p className="mb-5 text-sm text-muted">
            Going live saves these rules as a new version and re-runs matching. Decisions on
            unchanged groups are kept.
          </p>
          {summary ? (
            <div className="grid gap-6 md:grid-cols-2">
              <ul className="space-y-2 text-sm">
                {summary.matching.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
              <ul className="space-y-2 text-sm">
                {summary.groups.map((g) => (
                  <li key={g.label}>
                    <span className="font-medium">{g.label}:</span> {g.sentence}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">Summarizing…</p>
          )}
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
          {!status && dirty && (
            <span className="mr-auto text-sm text-muted">
              Unsaved changes. Nothing is live until step 5.
            </span>
          )}
          <button
            type="button"
            className="btn-ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft size={15} aria-hidden /> Back
          </button>
          {key === "live" ? (
            <button type="button" className="btn-primary" disabled={pending} onClick={goLive}>
              <Rocket size={15} aria-hidden /> {pending ? "Going live…" : "Go live"}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight size={15} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
