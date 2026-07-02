import { NextRequest, NextResponse } from "next/server";
import { mutate, audit, uid } from "@/lib/server/db";
import { SESSION_COOKIE } from "@/lib/server/session";
import { publicAdmin } from "@/lib/server/session";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// Step 2 of PRD §4.3: TOTP challenge. On success we mint a session, store it,
// and set it as an httpOnly cookie. Admin auth is owned by this BFF (not
// proxied) — see auth/login. TOTP is mocked (any 6-digit code) until a real
// authenticator secret is wired per admin.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, code } = body as { email?: string; code?: string };
  if (!/^\d{6}$/.test(String(code ?? ""))) {
    return NextResponse.json({ error: "Enter the 6-digit code from your authenticator." }, { status: 400 });
  }

  const result = await mutate((db) => {
    const admin = db.admins.find((a) => a.email === String(email ?? "").toLowerCase().trim());
    if (!admin || !admin.isActive) return null;
    const token = uid("sess");
    db.sessions.push({ token, adminId: admin.id, expiresAt: Date.now() + SEVEN_DAYS });
    admin.lastLogin = new Date().toISOString();
    audit(db, admin.email, "login", "admin", admin.id);
    return { token, admin: publicAdmin(admin) };
  });

  if (!result) return NextResponse.json({ error: "No pending login for that account." }, { status: 401 });

  const res = NextResponse.json({ user: result.admin });
  res.cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS / 1000,
  });
  return res;
}
