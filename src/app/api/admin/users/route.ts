import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";
import { mapUser } from "@/lib/server/backend-mappers";

// Monitor users (manager ask #3). Supports ?q, ?status, ?sub, ?language.
export async function GET(req: NextRequest) {
  const gate = await requireAdmin("users.read");
  if (isResponse(gate)) return gate;
  const url = new URL(req.url);
  if (backendHas("users:list")) {
    const raw = await (await proxy(`users${url.search}`)).json();
    return NextResponse.json({ items: (raw.items ?? []).map(mapUser), total: raw.total ?? 0 });
  }

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
