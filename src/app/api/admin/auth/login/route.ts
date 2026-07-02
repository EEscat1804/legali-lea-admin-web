import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/server/db";

// Step 1 of PRD §4.3: email + password. On success the client proceeds to the
// TOTP challenge (/auth/verify-totp). No session is issued until TOTP passes.
//
// Admin auth is ALWAYS handled here (never proxied): lea-be-core has no
// per-admin auth — its admin namespace is gated by an ADMIN_SECRET header
// (dev/staging only). This BFF owns the admin session; data endpoints proxy.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };
  const db = await readDb();
  const admin = db.admins.find((a) => a.email === String(email ?? "").toLowerCase().trim());
  if (!admin || admin.password !== password) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (!admin.isActive) {
    return NextResponse.json({ error: "Account is deactivated." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, pending: true, email: admin.email });
}
