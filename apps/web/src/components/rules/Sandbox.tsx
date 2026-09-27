"use client";

import type { RunConfig } from "@dedupe/core";
import { FlaskConical, Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { type RecordHit, sandboxAction, searchRecordsAction } from "@/lib/rulesActions";
import type { SandboxResult } from "@/lib/sandbox";

const VERDICT = {
  auto: { tone: "emerald", label: "Would merge automatically" },
  review: { tone: "amber", label: "Would go to review" },
  none: { tone: "slate", label: "Not a match" },
} as const;

/** Pick a few records and see how they would match and merge under the rules being edited. */
export function Sandbox({ config }: { config: RunConfig }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly RecordHit[]>([]);
  const [picked, setPicked] = useState<readonly RecordHit[]>([]);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const search = () =>
    startTransition(async () => {
      const r = await searchRecordsAction(query, config);
      setError(r.error ?? null);
      setHits(r.data ?? []);
    });
  const simulate = () =>
    startTransition(async () => {
      const r = await sandboxAction(
        picked.map((p) => p.id),
        config,
      );
      setError(r.error ?? null);
      setResult(r.data ?? null);
    });
  const toggle = (hit: RecordHit) => {
    setResult(null);
    setPicked((list) =>
      list.some((p) => p.id === hit.id) ? list.filter((p) => p.id !== hit.id) : [...list, hit],
    );
  };

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <FlaskConical size={18} className="text-accent" aria-hidden />
        <h2 className="font-semibold">Test sandbox</h2>
      </div>
      <p className="mb-4 text-sm text-muted">
        Pick any records and see exactly how they'd match and merge with these rules.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            className="input pl-9"
            placeholder="Search by name, email, company or id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search records"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-ghost">
          Search
        </button>
      </form>
      {hits.length > 0 && (
        <ul className="mt-3 max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {hits.map((hit) => {
            const isPicked = picked.some((p) => p.id === hit.id);
            return (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => toggle(hit)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${isPicked ? "bg-accent-soft" : "hover:bg-slate-50"}`}
                >
                  <span>
                    <span className="font-medium">{hit.label}</span>{" "}
                    <span className="text-muted">{hit.detail}</span>
                  </span>
                  <span className="text-xs text-accent">{isPicked ? "Picked" : "Pick"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {picked.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {picked.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs"
            >
              {p.label}
              <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.label}`}>
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            disabled={pending || picked.length < 2}
            onClick={simulate}
            className="btn-primary ml-auto"
          >
            Simulate merge
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {result && (
        <div className="mt-5 space-y-4">
          <ul className="space-y-1.5 text-sm">
            {result.pairs.map((p) => (
              <li key={`${p.a}-${p.b}`} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {p.a} ↔ {p.b}
                </span>
                <Badge tone={VERDICT[p.verdict].tone}>{VERDICT[p.verdict].label}</Badge>
                <span className="text-muted">
                  {p.reason} · {Math.round(p.score * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Field</th>
                  {result.recordIds.map((id) => (
                    <th key={id} className="px-3 py-2 font-medium">
                      {id}
                    </th>
                  ))}
                  <th className="bg-accent-soft px-3 py-2 font-medium text-accent">Clean record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows
                  .filter((r) => r.tagged)
                  .map((row) => (
                    <tr key={row.field}>
                      <td className="px-3 py-2 font-medium">{row.field}</td>
                      {row.cells.map((c) => (
                        <td
                          key={c.recordId}
                          className={`px-3 py-2 ${c.isWinner ? "text-good" : ""}`}
                        >
                          {c.text || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="bg-accent-soft/40 px-3 py-2">
                        <div className="font-medium">{row.clean?.text || "—"}</div>
                        <div className="text-xs text-muted">{row.clean?.reason}</div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
