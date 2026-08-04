// Proxy switch. If BACKEND_API_URL is set, the admin panel forwards to
// lea-be-core (`/api/lea/admin/*`); otherwise route handlers use the local
// file-backed store. This is the single seam to flip when his endpoints land.

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session";

export function backendConfigured(): boolean {
  return !!process.env.BACKEND_API_URL;
}

// lea-be-core (backend-test) only implements a subset of /api/lea/admin/*
// so far — see admin-data.routes.ts. BACKEND_API_URL is a single global
// switch, so without this allowlist, turning it on would also proxy calls
// (admins, articles, knowledge, model-config, counselor/user writes) to
// endpoints that don't exist there yet and 404. Add a key here the same day
// the corresponding backend-test route ships, and nothing else needs to change.
const BACKEND_ENDPOINTS = new Set([
  "counselors:list",
  "users:list",
  "subscriptions:list",
]);

// Gate for route handlers: true only when BACKEND_API_URL is set AND
// lea-be-core actually implements this specific endpoint. Use this instead
// of backendConfigured() directly in any route handler that talks to lea-be-core.
export function backendHas(endpoint: string): boolean {
  return backendConfigured() && BACKEND_ENDPOINTS.has(endpoint);
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

  // lea-be-core wraps every response as { success, data } on success, or
  // { success: false, error: { code, message, requestId } } on failure (see
  // its src/core/http/response.ts). Unwrap the success case once here so
  // every route handler — and the pages downstream — see the same flat shape
  // the local mock store returns (e.g. { items, total }), instead of
  // patching each call site.
  //
  // On failure, flatten error.message to a top-level `error` string, since
  // api.ts's req() reads `data.error` expecting a string (it throws
  // `new ApiError(status, data.error)`), not lea-be-core's nested error object.
  const body = await res.json().catch(() => null);
  const isEnvelope = !!body && typeof body === "object" && "success" in body && "data" in body;
  let unwrapped: unknown = body;
  if (isEnvelope) {
    const envelope = body as { success: boolean; data?: unknown; error?: { message?: string } };
    unwrapped = envelope.success ? envelope.data : { error: envelope.error?.message ?? "Request failed" };
  }

  return new Response(JSON.stringify(unwrapped), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
