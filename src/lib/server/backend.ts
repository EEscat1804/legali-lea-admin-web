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
      ...(process.env.ADMIN_SECRET 
  ? { Authorization: `Bearer ${process.env.ADMIN_SECRET}` } 
  : token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  // lea-be-core wraps every response as { success, data } (or { success: false, error }
  // on failure). Unwrap once here so every route handler — and the pages downstream —
  // see the same flat shape the local mock store returns (e.g. { items, total }),
  // instead of patching each call site. Error bodies are passed through unchanged
  // since they already expose `.error` at the top level, which api.ts's req() expects.
  const body = await res.json().catch(() => null);
  const isEnvelope = !!body && typeof body === "object" && "success" in body && "data" in body;
  const unwrapped = isEnvelope && (body as { success: boolean }).success ? (body as { data: unknown }).data : body;

  return new Response(JSON.stringify(unwrapped), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
