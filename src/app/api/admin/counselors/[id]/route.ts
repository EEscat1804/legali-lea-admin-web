import { NextRequest, NextResponse } from "next/server";
import { mutate, audit } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin("counselors.write");
  if (isResponse(gate)) return gate;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  // Not implemented on lea-be-core yet — see BACKEND_ENDPOINTS in backend.ts.
  if (backendHas("counselors:update")) {
    const res = await proxy(`counselors/${id}`, { method: "PATCH", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const updated = await mutate((db) => {
    const c = db.counselors.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, body);
    audit(db, gate.email, "update", "counselor", id, null, null);
    return c;
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
