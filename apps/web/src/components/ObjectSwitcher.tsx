"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { selectDatasetAction } from "@/lib/actions";
import { SYSTEM_COLOR } from "@/lib/tagStyle";

export interface ObjectOption {
  readonly id: string;
  readonly name: string;
  readonly system: string;
  readonly label: string;
}

export function ObjectSwitcher({
  options,
  currentId,
}: {
  options: readonly ObjectOption[];
  currentId: string | null;
}) {
  const form = useRef<HTMLFormElement>(null);
  const current = options.find((o) => o.id === currentId);
  if (!current) {
    return (
      <Link href="/crm" className="btn-ghost">
        <Plus size={16} aria-hidden /> Add CRM data or an import
      </Link>
    );
  }
  return (
    <form
      key={current.id}
      ref={form}
      action={selectDatasetAction}
      className="relative flex min-w-0 items-center gap-2"
    >
      <div className="relative min-w-0">
        <span
          className="pointer-events-none absolute top-1/2 left-3 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{ background: SYSTEM_COLOR[current.system] ?? SYSTEM_COLOR.other }}
          aria-hidden
        />
        <select
          name="id"
          aria-label="Current object"
          defaultValue={current.id}
          onChange={() => form.current?.requestSubmit()}
          className="max-w-[340px] cursor-pointer appearance-none truncate rounded-lg border border-line bg-white py-2 pr-9 pl-8 text-sm font-medium shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} — {o.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          size={14}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        />
      </div>
      <Link
        href="/imports/new"
        className="btn-ghost px-2.5"
        aria-label="New import"
        title="New import"
      >
        <Plus size={16} aria-hidden />
      </Link>
    </form>
  );
}
