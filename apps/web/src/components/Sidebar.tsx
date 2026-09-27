"use client";

import { Cloud, FileUp, GitMerge, History, Inbox, LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";

const LINKS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/crm", label: "CRM", icon: Cloud },
  { href: "/imports", label: "Imports", icon: FileUp },
  { href: "/inbox", label: "Review", icon: Inbox },
  { href: "/rules", label: "Rules", icon: GitMerge },
  { href: "/history", label: "History", icon: History },
] as const;

export function Sidebar({ needsReview }: { needsReview: number }) {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 flex-col bg-slate-900 text-slate-300 md:sticky md:top-0 md:h-screen md:w-60">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
          D
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Dedupe</div>
          <div className="text-[11px] text-slate-400">RevOps data hygiene</div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon
                size={17}
                aria-hidden
                className={active ? "text-indigo-300" : "text-slate-400"}
              />
              <span className="flex-1">{label}</span>
              {label === "Review" && needsReview > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-300">
                  {needsReview}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <form action={logoutAction} className="mt-auto hidden border-t border-white/10 p-3 md:block">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/5 hover:text-white"
        >
          <LogOut size={17} aria-hidden className="text-slate-400" />
          Sign out
        </button>
      </form>
    </aside>
  );
}
