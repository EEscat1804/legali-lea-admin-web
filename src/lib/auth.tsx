"use client";

// Client auth context, now backed by the real admin API (/api/admin/auth/*).
// Session lives in an httpOnly cookie set by the server (PRD §4.3); this context
// just mirrors the signed-in admin for the UI. On load it calls /me to rehydrate.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { AdminRole, AdminUser } from "./types";

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  verifyTotp: (code: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  pendingEmail: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn: AuthState["signIn"] = async (email, password) => {
    try {
      const r = await api.auth.login(email, password);
      if (r.pending) setPendingEmail(r.email ?? email);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e.message : "Login failed." };
    }
  };

  const verifyTotp: AuthState["verifyTotp"] = async (code) => {
    if (!pendingEmail) return { ok: false, error: "No pending login." };
    try {
      const r = await api.auth.verifyTotp(pendingEmail, code);
      setUser(r.user);
      setPendingEmail(null);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e.message : "Verification failed." };
    }
  };

  const signOut: AuthState["signOut"] = async () => {
    await api.auth.logout().catch(() => {});
    setUser(null);
    setPendingEmail(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, verifyTotp, signOut, pendingEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// Static hints for the login screen (the real accounts live in the store).
export const DEMO_LOGINS: Array<{ email: string; role: AdminRole }> = [
  { email: "super@legali.ai", role: "super_admin" },
  { email: "ops@legali.ai", role: "operator" },
  { email: "editor@legali.ai", role: "content_editor" },
  { email: "viewer@legali.ai", role: "viewer" },
  { email: "apple@legali.ai", role: "operator" },
  { email: "davis@legali.ai", role: "super_admin" },
];
