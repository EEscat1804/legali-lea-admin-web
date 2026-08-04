import { NextRequest, NextResponse } from "next/server";
import { mutate, readDb, audit, uid } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendHas, proxy } from "@/lib/server/backend";
import { mapCounselor } from "@/lib/server/backend-mappers";
import type { Counselor } from "@/lib/types";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin("counselors.read");
  if (isResponse(gate)) return gate;
  const search = new URL(req.url).search;
  if (backendHas("counselors:list")) {
    const raw = await (await proxy(`counselors${search}`)).json();
    return NextResponse.json({ items: (raw.items ?? []).map(mapCounselor), total: raw.total ?? 0 });
  }

  const q = new URL(req.url).searchParams.get("q")?.toLowerCase() ?? "";
  const db = await readDb();
  const items = db.counselors.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
  );
  return NextResponse.json({ items, total: items.length });
}

// Add a counselor to the trauma-informed specialist network (manager ask #1).
export async function POST(req: NextRequest) {
  const gate = await requireAdmin("counselors.write");
  if (isResponse(gate)) return gate;
  const body = await req.json().catch(() => ({}));
  // lea-be-core (backend-test) only implements GET /counselors so far — no
  // create endpoint yet — so this always falls through to the local store
  // even when BACKEND_API_URL is set. Add "counselors:create" to
  // BACKEND_ENDPOINTS in backend.ts once it ships.
  if (backendHas("counselors:create")) {
    const res = await proxy("counselors", { method: "POST", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const created = await mutate((db) => {
    const c: Counselor = {
      id: uid("c"),
      name: body.name ?? "",
      email: body.email ?? "",
      typeKey: body.typeKey ?? "counselor",
      isAvailable: true,
      isActive: true,
      activeClients: 0,
      maxClients: body.maxClients ?? 10,
      languages: body.languages ?? ["en"],
      joinDate: new Date().toISOString().slice(0, 10),
      specialisations: body.specialisations ?? [],
      credentials: body.credentials ?? "",
      bio: body.bio ?? "",
      fee: body.fee ?? null,
      responseTime: body.responseTime ?? "< 48h",
      proBono: !!body.proBono,
      crisis: !!body.crisis,
    };
    db.counselors.unshift(c);
    audit(db, gate.email, "create", "counselor", c.id, null, "Invited to specialist network");
    return c;
  });
  return NextResponse.json(created, { status: 201 });
}
