"use client";

import type { RuleTemplate, RunConfig } from "@dedupe/core";
import { LayoutTemplate, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { applyTemplateAction } from "@/lib/rulesActions";

export function TemplatesPanel(props: {
  templates: readonly RuleTemplate[];
  config: RunConfig;
  onApply: (config: RunConfig) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState<{ template: string; lines: readonly string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (template: RuleTemplate) =>
    startTransition(async () => {
      const result = await applyTemplateAction(props.config, template.id);
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      setError(null);
      props.onApply(result.data.config as RunConfig);
      setNotes({ template: template.name, lines: result.data.changes });
    });

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <LayoutTemplate size={18} className="text-accent" aria-hidden />
        <h2 className="font-semibold">Start from a template</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {props.templates.map((t) => (
          <div key={t.id} className="flex flex-col rounded-xl border border-line p-4">
            <div className="font-medium">{t.name}</div>
            <p className="mt-1 flex-1 text-sm text-muted">{t.description}</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => apply(t)}
              className="btn-ghost mt-3 self-start px-3 py-1.5 text-xs"
            >
              <Wand2 size={14} aria-hidden /> Apply
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-bad">{error}</p>}
      {notes && (
        <div className="mt-4 rounded-lg bg-accent-soft/70 p-4 text-sm">
          <div className="mb-1 font-medium">
            Applied "{notes.template}". Check it below, nothing is live until step 5.
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-slate-700">
            {notes.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
