"use client";

import type { ObjectPreset } from "@dedupe/core";
import { Building2, Check, FileSpreadsheet, UploadCloud, Users } from "lucide-react";
import { useActionState, useState } from "react";
import { type FormState, uploadDatasetAction } from "@/lib/actions";
import { SYSTEM_COLOR } from "@/lib/tagStyle";

type Preset = Pick<ObjectPreset, "id" | "system" | "systemLabel" | "objectLabel" | "entity">;

const SYSTEMS = [
  { id: "salesforce", label: "Salesforce", hint: "Leads, Contacts, Accounts" },
  { id: "hubspot", label: "HubSpot", hint: "Contacts, Companies" },
  { id: "other", label: "Other / CSV", hint: "Any people or company list" },
] as const;

export function AddObjectForm({ presets }: { presets: readonly Preset[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadDatasetAction, {});
  const [system, setSystem] = useState<string>("salesforce");
  const [objectType, setObjectType] = useState<string>("salesforce.contact");
  const objects = presets.filter((p) => p.system === system);
  const chosen = presets.find((p) => p.id === objectType);

  return (
    <form action={action} className="card space-y-6 p-6">
      <div>
        <div className="label">1. Where does the data come from?</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSystem(s.id);
                setObjectType(presets.find((p) => p.system === s.id)?.id ?? "");
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
      </div>

      <div>
        <div className="label">2. Which object?</div>
        <div className="flex flex-wrap gap-2">
          {objects.map((p) => (
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
        <input type="hidden" name="objectType" value={objectType} />
        {chosen && chosen.system !== "other" && (
          <p className="mt-2 text-xs text-muted">
            Standard {chosen.systemLabel} {chosen.objectLabel} fields are mapped and tagged for you.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">
            3. Name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={100}
            defaultValue={chosen ? `${chosen.systemLabel} ${chosen.objectLabel}` : ""}
            key={objectType}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="file" className="label">
            4. CSV export
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
      </div>
      <p className="flex items-start gap-2 text-xs text-muted">
        <FileSpreadsheet size={14} className="mt-0.5 shrink-0" aria-hidden />
        Needs id, createdAt and updatedAt columns (dates like 2024-03-01). Multi-value cells use
        ";". Up to 25 MB. Nothing is written back to your CRM.
      </p>
      {state.error && (
        <p className="rounded-lg bg-bad-soft p-3 text-sm whitespace-pre-line text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        <UploadCloud size={16} aria-hidden />
        {pending ? "Uploading and finding duplicates…" : "Add object and find duplicates"}
      </button>
    </form>
  );
}
