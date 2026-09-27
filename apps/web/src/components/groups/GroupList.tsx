"use client";

import { GitMerge, ThumbsUp, X } from "lucide-react";
import { useState, useTransition } from "react";
import { decideGroupsAction } from "@/lib/groupActions";
import { GroupCard, type GroupView } from "./GroupCard";

/** Duplicate groups with multi-select: merge, approve or dismiss many at once. */
export function GroupList(props: {
  groups: readonly GroupView[];
  datasetId: string;
  mode: "crm" | "import";
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = props.groups.length > 0 && props.groups.every((g) => selected.has(g.id));
  const bulk = (decision: "approved" | "merged" | "rejected") =>
    startTransition(async () => {
      const result = await decideGroupsAction(props.datasetId, [...selected], decision);
      setError(result.error ?? null);
      if (!result.error) setSelected(new Set());
    });

  if (props.groups.length === 0) {
    return <p className="card p-8 text-center text-sm text-muted">No duplicate groups here.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(props.groups.map((g) => g.id)))
            }
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Select all on this page
        </label>
        {selected.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-muted">{selected.size} selected</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulk("rejected")}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              <X size={14} aria-hidden /> Not duplicates
            </button>
            {props.mode === "crm" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => bulk("merged")}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                <GitMerge size={14} aria-hidden /> Merge {selected.size} now
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => bulk("approved")}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                <ThumbsUp size={14} aria-hidden /> Approve {selected.size}
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      {props.groups.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          datasetId={props.datasetId}
          mode={props.mode}
          selected={selected.has(g.id)}
          onToggle={() => toggle(g.id)}
        />
      ))}
    </div>
  );
}
