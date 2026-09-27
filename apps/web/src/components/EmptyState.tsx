import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export function EmptyState(props: {
  title: string;
  body: string;
  href?: string;
  cta?: string;
  icon?: LucideIcon;
}) {
  const Icon = props.icon ?? Sparkles;
  return (
    <div className="card mx-auto max-w-lg px-8 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon size={22} aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{props.title}</h2>
      <p className="mt-2 text-sm text-muted">{props.body}</p>
      {props.href && props.cta && (
        <Link href={props.href} className="btn-primary mt-6">
          {props.cta}
        </Link>
      )}
    </div>
  );
}
