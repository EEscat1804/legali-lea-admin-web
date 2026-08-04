import { NextRequest, NextResponse } from "next/server";
import { mutate, audit } from "@/lib/server/db";
import { requireAdmin, isResponse, publicAdmin } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";

// Change an admin's role or activation (PRD §2). Super Admin only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin("admins.write");
  if (isResponse(gate)) return gate;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  // Not implemented on lea-be-core yet — see BACKEND_ENDPOINTS in backend.ts.
  if (backendHas("admins:update")) {
    const res = await proxy(`admins/${id}`, { method: "PATCH", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const updated = await mutate((db) => {
    const a = db.admins.find((x) => x.id === id);
    if (!a) return null;
    if (typeof body.role === "string") a.role = body.role;
    if (typeof body.isActive === "boolean") {
      a.isActive = body.isActive;
      if (!body.isActive) db.sessions = db.sessions.filter((s) => s.adminId !== id); // revoke sessions
    }
    audit(db, gate.email, "update", "admin", id, null, null);
    return publicAdmin(a);
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
