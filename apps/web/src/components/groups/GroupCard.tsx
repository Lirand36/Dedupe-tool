"use client";

import { Crown, GitMerge, RotateCcw, Star, ThumbsUp, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { saveExampleAction } from "@/lib/actions";
import { decideGroupsAction, overrideGroupAction, setMasterAction } from "@/lib/groupActions";
import type { GroupStatus } from "@/lib/groups";
import type { Tone } from "@/lib/tagStyle";
import type { ComparisonRow } from "@/lib/views";

export interface GroupView {
  readonly id: string;
  readonly label: string;
  readonly status: GroupStatus;
  readonly confidence: number;
  readonly reasons: readonly string[];
  readonly recordIds: readonly string[];
  readonly masterId: string;
  readonly rows: readonly ComparisonRow[];
}

export const STATUS_BADGE: Record<GroupStatus, { tone: Tone; label: string }> = {
  ready: { tone: "emerald", label: "Ready to merge" },
  review: { tone: "amber", label: "Needs review" },
  merged: { tone: "violet", label: "Merged" },
  rejected: { tone: "pink", label: "Not duplicates" },
};

const ROWS_COLLAPSED = 8;
const CRM_PREFIX = "crm:";

function RecordHeader({ id }: { id: string }) {
  if (!id.startsWith(CRM_PREFIX)) return <>{id}</>;
  return (
    <>
      <span className="mr-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">In CRM</span>
      {id.slice(CRM_PREFIX.length)}
    </>
  );
}

export function GroupCard(props: {
  group: GroupView;
  datasetId: string;
  mode: "crm" | "import";
  selected: boolean;
  onToggle: () => void;
}) {
  const { group, datasetId, mode } = props;
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.error ?? null);
    });
  const decide = (decision: "approved" | "merged" | "rejected" | "pending") =>
    run(() => decideGroupsAction(datasetId, [group.id], decision));
  const rows = expanded ? group.rows : group.rows.slice(0, ROWS_COLLAPSED);
  const open = group.status === "review" || group.status === "ready";

  return (
    <section className={`card overflow-hidden ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-slate-50/70 px-4 py-3">
        <input
          type="checkbox"
          checked={props.selected}
          onChange={props.onToggle}
          aria-label={`Select ${group.label}`}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{group.label}</span>
            <Badge tone={STATUS_BADGE[group.status].tone}>{STATUS_BADGE[group.status].label}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {group.recordIds.length} records · {Math.round(group.confidence * 100)}% sure ·{" "}
            {[...new Set(group.reasons)].join(" · ")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {open && (
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("rejected")}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              <X size={14} aria-hidden /> Not duplicates
            </button>
          )}
          {open && mode === "crm" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("merged")}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              <GitMerge size={14} aria-hidden /> Merge now
            </button>
          )}
          {group.status === "review" && mode === "import" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("approved")}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              <ThumbsUp size={14} aria-hidden /> Approve
            </button>
          )}
          {!open && (
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("pending")}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              <RotateCcw size={14} aria-hidden /> Reopen
            </button>
          )}
        </div>
      </div>
      {error && <p className="bg-bad-soft px-4 py-2 text-sm text-bad">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="w-44 px-4 py-2 font-medium">Field</th>
              {group.recordIds.map((id) => (
                <th key={id} className="px-3 py-2 font-medium normal-case">
                  <div className="flex items-center gap-1.5">
                    <RecordHeader id={id} />
                    {id === group.masterId ? (
                      <span
                        className="inline-flex items-center gap-0.5 text-accent"
                        title="Master: this record survives"
                      >
                        <Crown size={12} aria-hidden /> master
                      </span>
                    ) : (
                      open && (
                        <button
                          type="button"
                          onClick={() => run(() => setMasterAction(datasetId, group.id, id))}
                          className="text-[11px] text-muted hover:text-accent"
                        >
                          make master
                        </button>
                      )
                    )}
                  </div>
                </th>
              ))}
              <th className="bg-accent-soft px-3 py-2 font-medium text-accent">Survivor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.field}>
                <td className="px-4 py-1.5 font-medium">{row.field}</td>
                {row.cells.map((cell) => (
                  <td key={cell.recordId} className="px-1.5 py-1">
                    {cell.text !== "" && open ? (
                      <button
                        type="button"
                        onClick={() =>
                          run(() => overrideGroupAction(datasetId, group.id, row.field, cell.text))
                        }
                        title="Use this value"
                        className={`w-full rounded-md px-1.5 py-1 text-left ${cell.isWinner ? "bg-good-soft text-good" : "hover:bg-slate-100"}`}
                      >
                        {cell.text}
                      </button>
                    ) : (
                      <span className={`block px-1.5 py-1 ${cell.isWinner ? "text-good" : ""}`}>
                        {cell.text || <span className="text-slate-300">—</span>}
                      </span>
                    )}
                  </td>
                ))}
                <td className="bg-accent-soft/40 px-3 py-1.5">
                  <div className="font-medium">
                    {row.clean?.text || <span className="text-slate-300">—</span>}
                  </div>
                  <div className="text-[11px] text-muted">
                    {row.clean?.reason}
                    {row.clean?.overridden && open && (
                      <button
                        type="button"
                        onClick={() =>
                          run(() => overrideGroupAction(datasetId, group.id, row.field, null))
                        }
                        className="ml-2 text-accent hover:underline"
                      >
                        reset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs">
        {group.rows.length > ROWS_COLLAPSED ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-medium text-muted hover:text-ink"
          >
            {expanded ? "Show fewer fields" : `Show all ${group.rows.length} fields`}
          </button>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-3">
          {notice && <span className="text-good">{notice}</span>}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const name = prompt("Name this example", group.label);
              if (name === null) return;
              startTransition(async () => {
                const r = await saveExampleAction(datasetId, group.id, name);
                setNotice(r.message ?? null);
                setError(r.error ?? null);
              });
            }}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            <Star size={12} aria-hidden /> Save as example
          </button>
        </span>
      </div>
    </section>
  );
}
