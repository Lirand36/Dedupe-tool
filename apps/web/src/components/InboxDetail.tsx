"use client";

import type { Evidence } from "@dedupe/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideAction, overrideAction, saveExampleAction } from "@/lib/actions";
import type { Decision, Tier } from "@/lib/insights";
import type { ComparisonRow } from "@/lib/views";

interface Props {
  identityId: string;
  title: string;
  tier: Tier;
  decision: Decision;
  confidence: number;
  keepRecordId: string;
  evidence: readonly Evidence[];
  recordIds: readonly string[];
  rows: readonly ComparisonRow[];
  nextHref: string;
}

export function InboxDetail(props: Props) {
  const { identityId, rows, recordIds, keepRecordId } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [showUntagged, setShowUntagged] = useState(false);

  const decide = (decision: Decision) =>
    startTransition(async () => {
      await decideAction(identityId, decision);
      if (decision !== "pending") router.push(props.nextHref);
    });
  const pin = (field: string, text: string | null) =>
    startTransition(async () => {
      await overrideAction(identityId, field, text);
    });
  const saveExample = () => {
    const name = prompt("Name this example (e.g. 'Inbound 2023 + cold call 2025')", props.title);
    if (name === null) return;
    startTransition(async () => {
      const result = await saveExampleAction(identityId, name);
      setNotice(result.message ?? result.error ?? null);
    });
  };

  const visible = rows.filter((r) => r.tagged || showUntagged);
  const untaggedCount = rows.length - rows.filter((r) => r.tagged).length;

  return (
    <section className={`card min-w-0 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
        <div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {props.evidence.map((e) => (
              <span
                key={`${e.a}-${e.b}`}
                className={`rounded-full px-2 py-0.5 ${e.reason.startsWith("Conflict") ? "bg-bad-soft text-bad" : "bg-slate-100 text-slate-600"}`}
                title={`${e.a} ↔ ${e.b}`}
              >
                {e.reason} · {Math.round(e.score * 100)}%
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.decision === "pending" ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => decide("rejected")}
                className="btn-ghost"
              >
                Not duplicates
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => decide("merged")}
                className="btn-primary"
              >
                Approve merge
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("pending")}
              className="btn-ghost"
            >
              Undo decision
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Field</th>
              {recordIds.map((id) => (
                <th key={id} className="px-4 py-2 font-medium">
                  {id.startsWith("crm:") ? (
                    <span className="normal-case">
                      <span className="mr-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
                        In CRM
                      </span>
                      {id.slice(4)}
                    </span>
                  ) : (
                    id
                  )}
                  {id === keepRecordId && (
                    <span className="ml-1 normal-case text-accent">(kept)</span>
                  )}
                </th>
              ))}
              <th className="bg-accent-soft px-4 py-2 font-medium text-accent">Clean record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => (
              <tr key={row.field} className={row.tagged ? "" : "text-muted"}>
                <td className="px-4 py-2 font-medium whitespace-nowrap">{row.field}</td>
                {row.cells.map((cell) => (
                  <td key={cell.recordId} className="px-2 py-1">
                    {row.tagged && cell.text !== "" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => pin(row.field, cell.text)}
                        title="Use this value"
                        className={`w-full rounded-md px-2 py-1 text-left ${
                          cell.isWinner ? "bg-good-soft text-good" : "hover:bg-slate-100"
                        }`}
                      >
                        {cell.text}
                      </button>
                    ) : (
                      <span className="px-2">
                        {cell.text || <span className="text-slate-300">—</span>}
                      </span>
                    )}
                  </td>
                ))}
                <td className="bg-accent-soft/40 px-4 py-2">
                  {row.clean ? (
                    <div>
                      <div className="font-medium">
                        {row.clean.text || <span className="text-slate-300">—</span>}
                      </div>
                      <div className="text-xs text-muted">
                        {row.clean.reason}
                        {row.clean.overridden && (
                          <button
                            type="button"
                            onClick={() => pin(row.field, null)}
                            className="ml-2 text-accent hover:underline"
                          >
                            reset
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs">Not tagged: stays as on kept record</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4 text-sm">
        <div className="flex gap-4">
          {untaggedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowUntagged((v) => !v)}
              className="text-muted hover:text-ink"
            >
              {showUntagged ? "Hide" : "Show"} {untaggedCount} untagged field
              {untaggedCount === 1 ? "" : "s"}
            </button>
          )}
          <button
            type="button"
            onClick={saveExample}
            disabled={pending}
            className="text-accent hover:underline"
          >
            Save as example
          </button>
        </div>
        {notice && <span className="text-good">{notice}</span>}
      </div>
    </section>
  );
}
