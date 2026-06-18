import { NextResponse } from "next/server";
import { currentAdmin, publicAdmin } from "@/lib/server/session";

// Returns the signed-in admin (sans password) or 401. The client uses this to
// rehydrate the session on load (replaces the old localStorage check).
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: publicAdmin(admin) });
}
