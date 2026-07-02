// Server-side admin session helpers. The session token lives in an httpOnly
// cookie (PRD §4.3); we validate it against the store. When BACKEND_API_URL is
// set, auth is delegated to lea-be-core and this still reads the same cookie.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDb, type AdminAccount } from "./db";
import { can, type Capability } from "@/lib/rbac";

export const SESSION_COOKIE = "admin_session";

export async function currentAdmin(): Promise<AdminAccount | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await readDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session || session.expiresAt < Date.now()) return null;
  const admin = db.admins.find((a) => a.id === session.adminId);
  if (!admin || !admin.isActive) return null;
  return admin;
}

// Strip the password before sending an admin to the client.
export function publicAdmin(a: AdminAccount) {
  const { password, ...rest } = a;
  void password;
  return rest;
}

// Guard a route handler: require a valid session and (optionally) a capability.
// Returns the admin, or a NextResponse to return immediately on failure.
export async function requireAdmin(cap?: Capability): Promise<AdminAccount | NextResponse> {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (cap && !can(admin.role, cap)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return admin;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
