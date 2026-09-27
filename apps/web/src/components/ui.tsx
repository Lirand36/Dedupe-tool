import type { FieldTag } from "@dedupe/core";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { TONE_CLASS, type Tone, tagLabel, tagTone } from "@/lib/tagStyle";

export function PageHeader(props: {
  title: string;
  description?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {props.eyebrow && (
          <div className="mb-1 text-xs font-medium text-muted">{props.eyebrow}</div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
        {props.description && <p className="mt-1 text-sm text-muted">{props.description}</p>}
      </div>
      {props.actions && <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
    </div>
  );
}

export function Badge({ tone = "slate", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function TagBadge({ tag }: { tag: FieldTag | undefined }) {
  return <Badge tone={tagTone(tag)}>{tagLabel(tag)}</Badge>;
}

export function StatCard(props: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: Tone;
}) {
  const Icon = props.icon;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{props.label}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${TONE_CLASS[props.tone ?? "slate"]}`}
        >
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{props.value}</div>
      {props.hint && <div className="mt-1 text-xs text-muted">{props.hint}</div>}
    </div>
  );
}

export function Tabs({
  items,
  active,
}: {
  items: readonly { key: string; label: string; href: string; count?: number }[];
  active: string;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            item.key === active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1.5 tabular-nums text-muted">{item.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    </div>
  );
}
