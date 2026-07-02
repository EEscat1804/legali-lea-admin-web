"use client";

// Typed client for the admin API. Calls same-origin /api/admin/* route handlers
// (which use the local store, or proxy to lea-be-core when BACKEND_API_URL is
// set). Return shapes match src/lib/types.ts so pages stay typed.

import { useCallback, useEffect, useState } from "react";
import type {
  AdminUser,
  AppUser,
  Article,
  Counselor,
  KnowledgeEntry,
  ModelConfig,
  PricingPlan,
  SubscriptionRow,
} from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return "";
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
  const s = new URLSearchParams(clean as Record<string, string>).toString();
  return s ? `?${s}` : "";
}

export const api = {
  auth: {
    login: (email: string, password: string) => req<{ ok: boolean; pending?: boolean; email?: string }>("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    verifyTotp: (email: string, code: string) => req<{ user: AdminUser }>("/api/admin/auth/verify-totp", { method: "POST", body: JSON.stringify({ email, code }) }),
    logout: () => req<{ ok: boolean }>("/api/admin/auth/logout", { method: "POST" }),
    me: () => req<{ user: AdminUser | null }>("/api/admin/auth/me"),
  },
  counselors: {
    list: (params?: Record<string, string | undefined>) => req<{ items: Counselor[]; total: number }>(`/api/admin/counselors${qs(params)}`),
    create: (body: Partial<Counselor>) => req<Counselor>("/api/admin/counselors", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Counselor>) => req<Counselor>(`/api/admin/counselors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  },
  users: {
    list: (params?: Record<string, string | undefined>) => req<{ items: AppUser[]; total: number }>(`/api/admin/users${qs(params)}`),
    get: (id: string) => req<AppUser>(`/api/admin/users/${id}`),
    patch: (id: string, body: { action: string; reason?: string; expiry?: string }) => req<AppUser>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  },
  modelConfig: {
    get: () => req<ModelConfig>("/api/admin/model-config"),
    override: (body: { primary?: string; fallback?: string[]; reason: string }) => req<ModelConfig>("/api/admin/model-config", { method: "POST", body: JSON.stringify(body) }),
  },
  admins: {
    list: () => req<{ items: AdminUser[] }>("/api/admin/admins"),
    create: (body: { email: string; displayName: string; role: string }) => req<AdminUser>("/api/admin/admins", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { role?: string; isActive?: boolean }) => req<AdminUser>(`/api/admin/admins/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  },
  articles: {
    list: () => req<{ items: Article[] }>("/api/admin/articles"),
    create: (body: Partial<Article>) => req<Article>("/api/admin/articles", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Article>) => req<Article>(`/api/admin/articles/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => req<{ ok: boolean }>(`/api/admin/articles/${id}`, { method: "DELETE" }),
  },
  knowledge: {
    list: () => req<{ items: KnowledgeEntry[] }>("/api/admin/knowledge"),
    create: (body: Partial<KnowledgeEntry>) => req<KnowledgeEntry>("/api/admin/knowledge", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: string) => req<{ ok: boolean }>(`/api/admin/knowledge/${id}`, { method: "DELETE" }),
  },
  subscriptions: {
    get: () => req<{ items: SubscriptionRow[]; plans: PricingPlan[]; metrics: Record<string, number> }>("/api/admin/subscriptions"),
  },
};

// Small data hook for client pages: fetch on mount/deps, expose reload().
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    run()
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
