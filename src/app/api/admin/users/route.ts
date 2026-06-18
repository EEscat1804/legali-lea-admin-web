import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendConfigured, proxy } from "@/lib/server/backend";

// Monitor users (manager ask #3). Supports ?q, ?status, ?sub, ?language.
export async function GET(req: NextRequest) {
  const gate = await requireAdmin("users.read");
  if (isResponse(gate)) return gate;
  const url = new URL(req.url);
  if (backendConfigured()) return NextResponse.json(await (await proxy(`users${url.search}`)).json());

  const q = url.searchParams.get("q")?.toLowerCase() ?? "";
  const status = url.searchParams.get("status");
  const sub = url.searchParams.get("sub");
  const language = url.searchParams.get("language");
  const db = await readDb();
  const items = db.users.filter((u) => {
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    if (status && u.status !== status) return false;
    if (sub && u.subscription.status !== sub) return false;
    if (language && u.language !== language) return false;
    return true;
  });
  return NextResponse.json({ items, total: items.length });
}
