"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Health" },
  { href: "/inbox", label: "Inbox" },
  { href: "/logic", label: "Logic" },
  { href: "/data", label: "Data" },
] as const;

export function NavLinks({ needsReview }: { needsReview: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-accent-soft text-accent" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
            {label === "Inbox" && needsReview > 0 && (
              <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">
                {needsReview}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
