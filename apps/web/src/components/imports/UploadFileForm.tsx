"use client";

import type { ObjectPreset } from "@dedupe/core";
import { Building2, Check, FileSpreadsheet, UploadCloud, Users } from "lucide-react";
import { useActionState, useState } from "react";
import { type FormState, uploadFileAction } from "@/lib/actions";
import { SYSTEM_COLOR } from "@/lib/tagStyle";

export type PresetOption = Pick<
  ObjectPreset,
  "id" | "system" | "systemLabel" | "objectLabel" | "entity"
>;

const SYSTEMS = [
  { id: "salesforce", label: "Salesforce", hint: "Leads, Contacts, Accounts" },
  { id: "hubspot", label: "HubSpot", hint: "Contacts, Companies" },
  { id: "other", label: "Other", hint: "Any people or company list" },
] as const;

const COPY = {
  import: {
    target: "1. Where will this file be imported?",
    submit: "Upload and map columns",
    note: "Any CSV works: no id or date columns needed. Nothing is written to your CRM.",
  },
  crm: {
    target: "1. Which object is this export from?",
    submit: "Upload export and map columns",
    note: "Export the object from your CRM including its record ID. It replaces any earlier export of the same object.",
  },
} as const;

export function UploadFileForm(props: {
  presets: readonly PresetOption[];
  kind: "import" | "crm";
  defaultObject?: string | undefined;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadFileAction, {});
  const initial =
    props.presets.find((p) => p.id === props.defaultObject) ??
    props.presets.find((p) => p.id === "salesforce.contact");
  const [system, setSystem] = useState<string>(initial?.system ?? "salesforce");
  const [objectType, setObjectType] = useState<string>(initial?.id ?? "");
  const copy = COPY[props.kind];

  return (
    <form action={action} className="card space-y-6 p-6">
      <input type="hidden" name="kind" value={props.kind} />
      <input type="hidden" name="objectType" value={objectType} />
      <div>
        <div className="label">{copy.target}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSystem(s.id);
                setObjectType(props.presets.find((p) => p.system === s.id)?.id ?? "");
              }}
              className={`relative rounded-xl border p-4 text-left transition ${
                system === s.id
                  ? "border-accent bg-accent-soft/60 ring-2 ring-accent/20"
                  : "border-line hover:border-slate-300"
              }`}
            >
              <span
                className="mb-2 block h-2.5 w-2.5 rounded-full"
                style={{ background: SYSTEM_COLOR[s.id] }}
                aria-hidden
              />
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-muted">{s.hint}</div>
              {system === s.id && (
                <Check size={16} className="absolute top-3 right-3 text-accent" aria-hidden />
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.presets
            .filter((p) => p.system === system)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setObjectType(p.id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                  objectType === p.id
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-white hover:border-slate-300"
                }`}
              >
                {p.entity === "person" ? (
                  <Users size={15} aria-hidden />
                ) : (
                  <Building2 size={15} aria-hidden />
                )}
                {p.objectLabel}
              </button>
            ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="file" className="label">
            2. CSV file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent"
          />
        </div>
        <div>
          <label htmlFor="name" className="label">
            3. Name (optional)
          </label>
          <input
            id="name"
            name="name"
            maxLength={100}
            placeholder="Defaults to the file name"
            className="input"
          />
        </div>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted">
        <FileSpreadsheet size={14} className="mt-0.5 shrink-0" aria-hidden />
        {copy.note} Up to 25 MB.
      </p>
      {state.error && (
        <p className="rounded-lg bg-bad-soft p-3 text-sm whitespace-pre-line text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || !objectType} className="btn-primary">
        <UploadCloud size={16} aria-hidden />
        {pending ? "Uploading…" : copy.submit}
      </button>
    </form>
  );
}
