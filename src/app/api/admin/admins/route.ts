import { NextRequest, NextResponse } from "next/server";
import { mutate, readDb, audit, uid } from "@/lib/server/db";
import { requireAdmin, isResponse, publicAdmin } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";

// Manage admin accounts (PRD §2/§4.2). Super Admin only (admins.write).
export async function GET() {
  const gate = await requireAdmin("admins.write");
  if (isResponse(gate)) return gate;
  // Not implemented on lea-be-core yet — see BACKEND_ENDPOINTS in backend.ts.
  if (backendHas("admins:list")) return NextResponse.json(await (await proxy("admins")).json());
  const db = await readDb();
  return NextResponse.json({ items: db.admins.map(publicAdmin) });
}

// Create an admin account. New accounts default password "demo" and enrol TOTP
// on first login (mocked). lea-be-core will send a real invite email instead.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin("admins.write");
  if (isResponse(gate)) return gate;
  const body = await req.json().catch(() => ({}));
  // Not implemented on lea-be-core yet — see BACKEND_ENDPOINTS in backend.ts.
  if (backendHas("admins:create")) {
    const res = await proxy("admins", { method: "POST", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const created = await mutate((db) => {
    const email = String(body.email ?? "").toLowerCase().trim();
    if (db.admins.some((a) => a.email === email)) return { error: "An admin with that email already exists." };
    const admin = {
      id: uid("a"),
      email,
      displayName: body.displayName ?? email,
      role: body.role ?? "viewer",
      isActive: true,
      lastLogin: null,
      totpEnabled: true,
      password: "demo",
    };
    db.admins.push(admin);
    audit(db, gate.email, "create", "admin", admin.id, null, `Invited as ${admin.role}`);
    return { admin: publicAdmin(admin) };
  });
  if ("error" in created) return NextResponse.json(created, { status: 409 });
  return NextResponse.json(created.admin, { status: 201 });
}
