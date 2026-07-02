"use client";

import { useAuth } from "@/lib/auth";
import { ROLES } from "@/lib/rbac";
import { Button } from "@/components/ui";

export function Topbar() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-brand-100 bg-white px-6">
      <div className="text-sm text-slate-400">admin.legali.ai</div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-900">{user.displayName}</div>
          <div className="text-xs text-slate-500">{ROLES[user.role].label}</div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
          {user.displayName.charAt(0)}
        </div>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
