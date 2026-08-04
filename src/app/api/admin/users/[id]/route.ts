import { NextRequest, NextResponse } from "next/server";
import { mutate, readDb, audit } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin("users.read");
  if (isResponse(gate)) return gate;
  const { id } = await params;
  // Not implemented on lea-be-core yet (only the list endpoint exists) — see
  // BACKEND_ENDPOINTS in backend.ts.
  if (backendHas("users:get")) return NextResponse.json(await (await proxy(`users/${id}`)).json());
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

// Lifecycle actions: suspend/unsuspend/delete + subscription override.
// body: { action: "suspend"|"unsuspend"|"delete"|"grantPro"|"revokePro", reason?, expiry? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin("users.write");
  if (isResponse(gate)) return gate;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  // Not implemented on lea-be-core yet — see BACKEND_ENDPOINTS in backend.ts.
  if (backendHas("users:update")) {
    const res = await proxy(`users/${id}`, { method: "PATCH", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const updated = await mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) return null;
    const before = structuredClone(u);
    switch (body.action) {
      case "suspend":
        u.status = "suspended";
        break;
      case "unsuspend":
        u.status = "active";
        break;
      case "delete":
        u.status = "deleted";
        break;
      case "grantPro":
        u.subscription.status = "active";
        u.subscription.adminOverride = { reason: body.reason ?? "", expiry: body.expiry ?? "", grantedBy: gate.email };
        break;
      case "revokePro":
        u.subscription.status = "free";
        delete u.subscription.adminOverride;
        break;
    }
    audit(db, gate.email, body.action === "grantPro" || body.action === "revokePro" ? "override" : "update", "user", id, { status: { before: before.status, after: u.status } }, body.reason ?? null);
    return u;
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
