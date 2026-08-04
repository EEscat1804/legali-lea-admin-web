import { NextRequest, NextResponse } from "next/server";
import { mutate, audit } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin("resources.write");
  if (isResponse(gate)) return gate;
  const { id } = await params;
  // Not implemented on lea-be-core yet — see BACKEND_ENDPOINTS in backend.ts.
  if (backendHas("knowledge:delete")) {
    const res = await proxy(`knowledge/${id}`, { method: "DELETE" });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }
  await mutate((db) => {
    db.knowledge = db.knowledge.filter((k) => k.id !== id);
    audit(db, gate.email, "delete", "knowledge", id);
  });
  return NextResponse.json({ ok: true });
}
