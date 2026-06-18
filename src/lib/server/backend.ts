// Proxy switch. If BACKEND_API_URL is set, the admin panel forwards to Davis's
// lea-be-core (`/api/lea/admin/*`); otherwise route handlers use the local
// file-backed store. This is the single seam to flip when his endpoints land.

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session";

export function backendConfigured(): boolean {
  return !!process.env.BACKEND_API_URL;
}

// Forward the current request to lea-be-core, attaching the admin session as a
// bearer token. Used by route handlers when backendConfigured() is true.
export async function proxy(
  pathAndQuery: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  const base = process.env.BACKEND_API_URL!;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${base}/api/lea/admin/${pathAndQuery}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  return res;
}
