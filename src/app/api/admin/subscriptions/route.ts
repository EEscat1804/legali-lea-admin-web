import { NextResponse } from "next/server";
import { readDb } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";
import { mapSubscriptions } from "@/lib/server/backend-mappers";

// Subscription control surface (manager ask / PRD §3.4). Returns the live
// subscription rows (derived from users so admin overrides show up) + plans +
// metrics so the page reflects real state.
export async function GET() {
  const gate = await requireAdmin("subscriptions.read");
  if (isResponse(gate)) return gate;
  if (backendHas("subscriptions:list")) {
    const raw = await (await proxy("subscriptions")).json();
    return NextResponse.json(mapSubscriptions(raw));
  }

  const db = await readDb();
  const rows = db.users.map((u) => ({
    id: `s_${u.id}`,
    userId: u.id,
    userName: u.name,
    plan: u.subscription.plan,
    status: u.subscription.status,
    start: u.subscription.start,
    expiry: u.subscription.expiry,
  }));
  const active = rows.filter((r) => r.status === "active").length;
  const metrics = {
    activeSubscribers: active,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    expired: rows.filter((r) => r.status === "expired").length,
    free: rows.filter((r) => r.status === "free").length,
  };
  return NextResponse.json({ items: rows, plans: db.plans, metrics });
}
