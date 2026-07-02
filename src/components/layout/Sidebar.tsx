"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { can } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { FEEDBACK } from "@/lib/mock-data";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;

  // §3.5 — unresolved bug-report badge on the Feedback nav item.
  const openBugs = FEEDBACK.filter((f) => f.type === "bug" && f.status !== "resolved" && f.status !== "closed").length;

  const items = NAV.filter((n) => can(user.role, n.capability));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-brand-100 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-brand-100 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lea/module-1.png" alt="Lea" className="h-8 w-8 object-contain" />
        <span className="text-base font-semibold tracking-tight">
          <span className="text-brand-700">Lea</span> <span className="text-slate-700">Admin</span>
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/feedback" && openBugs > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-xs font-semibold text-white">{openBugs}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-brand-100 p-3 text-xs text-slate-400">PRD v0.1 · scaffold</div>
    </aside>
  );
}
