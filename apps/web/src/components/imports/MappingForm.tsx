"use client";

import type { ColumnMap } from "@dedupe/core";
import { ArrowRight, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { applyMappingAction } from "@/lib/actions";

type Special = "id" | "createdAt" | "updatedAt";
const SPECIAL_LABELS: Record<Special, { label: string; none: string }> = {
  id: { label: "Record ID", none: "None: use row numbers" },
  createdAt: { label: "Created date", none: "None: use upload time" },
  updatedAt: { label: "Last modified date", none: "None: same as created" },
};
const SKIP = "__skip__";

interface Props {
  datasetId: string;
  kind: "import" | "crm";
  objectLabel: string;
  headers: readonly string[];
  samples: Readonly<Record<string, readonly string[]>>;
  suggestion: ColumnMap;
  targets: readonly string[];
}

export function MappingForm(props: Props) {
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.headers.map((h) => [h, props.suggestion.fields[h] ?? h])),
  );
  const [specials, setSpecials] = useState<Record<Special, string>>({
    id: props.suggestion.id ?? "",
    createdAt: props.suggestion.createdAt ?? "",
    updatedAt: props.suggestion.updatedAt ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const specialOf = (h: string) =>
    (Object.keys(specials) as Special[]).find((k) => specials[k] === h);
  const taken = (h: string) =>
    new Set(
      Object.entries(fields)
        .filter(([col, t]) => col !== h && !specialOf(col) && t !== SKIP)
        .map(([, t]) => t),
    );

  const submit = () =>
    startTransition(async () => {
      const mapped = Object.fromEntries(
        props.headers
          .filter((h) => !specialOf(h))
          .map((h) => [h, fields[h] === SKIP ? null : (fields[h] ?? h)]),
      );
      const targets = Object.values(mapped).filter(Boolean);
      if (new Set(targets).size !== targets.length) {
        setError("Two columns point to the same field. Pick a different field or skip one.");
        return;
      }
      const result = await applyMappingAction(props.datasetId, {
        fields: mapped,
        ...(specials.id && { id: specials.id }),
        ...(specials.createdAt && { createdAt: specials.createdAt }),
        ...(specials.updatedAt && { updatedAt: specials.updatedAt }),
      });
      if (result?.error) setError(result.error);
    });

  return (
    <div className="space-y-6 pb-24">
      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound size={18} className="text-accent" aria-hidden />
          <h2 className="font-semibold">Record details</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.keys(SPECIAL_LABELS) as Special[]).map((key) => (
            <div key={key}>
              <label className="label" htmlFor={`special-${key}`}>
                {SPECIAL_LABELS[key].label}
                {key === "id" && props.kind === "crm" && <span className="text-bad"> *</span>}
              </label>
              <select
                id={`special-${key}`}
                className="input py-1.5"
                value={specials[key]}
                onChange={(e) => setSpecials({ ...specials, [key]: e.target.value })}
              >
                <option value="">{SPECIAL_LABELS[key].none}</option>
                {props.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {props.kind === "crm"
            ? "The record ID is what updates point to, so it's required for a CRM export."
            : "Dates decide what counts as earliest and latest. Without them, the file counts as newer than your CRM data."}
        </p>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b border-line bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">File column</th>
              <th className="px-5 py-3 font-medium">Sample values</th>
              <th className="w-72 px-5 py-3 font-medium">{props.objectLabel} field</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {props.headers.map((h) => {
              const special = specialOf(h);
              const used = taken(h);
              return (
                <tr key={h} className={special ? "text-muted" : ""}>
                  <td className="px-5 py-3 font-medium">{h}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-muted">
                    {(props.samples[h] ?? []).join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-2">
                    {special ? (
                      <span className="text-xs">Used as {SPECIAL_LABELS[special].label}</span>
                    ) : (
                      <select
                        aria-label={`Field for ${h}`}
                        className="input py-1.5"
                        value={fields[h] ?? h}
                        onChange={(e) => setFields({ ...fields, [h]: e.target.value })}
                      >
                        {props.targets.map((t) => (
                          <option key={t} value={t} disabled={used.has(t)}>
                            {t}
                          </option>
                        ))}
                        {!props.targets.includes(h) && (
                          <option value={h}>Keep as new field "{h}"</option>
                        )}
                        <option value={SKIP}>Skip this column</option>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
          {error && <span className="mr-auto text-sm text-bad">{error}</span>}
          <button type="button" className="btn-primary" disabled={pending} onClick={submit}>
            {pending ? "Mapping and finding duplicates…" : "Continue"}{" "}
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
