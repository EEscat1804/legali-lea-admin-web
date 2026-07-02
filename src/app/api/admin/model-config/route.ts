import { NextRequest, NextResponse } from "next/server";
import { mutate, readDb, audit } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendConfigured, proxy } from "@/lib/server/backend";

// Switch easily between AI models (manager ask #2 / PRD §3.9).
export async function GET() {
  const gate = await requireAdmin("system.read");
  if (isResponse(gate)) return gate;
  if (backendConfigured()) return NextResponse.json(await (await proxy("model-config")).json());
  const db = await readDb();
  return NextResponse.json(db.modelConfig);
}

// Override the primary model (and optionally the fallback chain). Super Admin
// only (system.write). Audit-logged with a reason (PRD §3.9).
export async function POST(req: NextRequest) {
  const gate = await requireAdmin("system.write");
  if (isResponse(gate)) return gate;
  const body = await req.json().catch(() => ({}));
  if (backendConfigured()) {
    const res = await proxy("model-config", { method: "POST", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const updated = await mutate((db) => {
    const before = db.modelConfig.primary;
    if (body.primary) db.modelConfig.primary = body.primary;
    if (Array.isArray(body.fallback)) db.modelConfig.fallback = body.fallback;
    db.modelConfig.updatedBy = gate.email;
    db.modelConfig.reason = body.reason ?? null;
    db.modelConfig.updatedAt = new Date().toISOString();
    audit(db, gate.email, "override", "model_config", "primary", { primary: { before, after: db.modelConfig.primary } }, body.reason ?? null);
    return db.modelConfig;
  });
  return NextResponse.json(updated);
}
