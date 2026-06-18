import { NextRequest, NextResponse } from "next/server";
import { mutate, readDb, audit, uid } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendConfigured, proxy } from "@/lib/server/backend";
import type { KnowledgeEntry } from "@/lib/types";

// AI knowledge base (manager ask) — entries Lea draws on (RAG). When proxied,
// lea-be-core embeds + indexes them; locally we just persist with status.
export async function GET() {
  const gate = await requireAdmin("resources.read");
  if (isResponse(gate)) return gate;
  if (backendConfigured()) return NextResponse.json(await (await proxy("knowledge")).json());
  const db = await readDb();
  return NextResponse.json({ items: db.knowledge });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin("resources.write");
  if (isResponse(gate)) return gate;
  const body = await req.json().catch(() => ({}));
  if (backendConfigured()) {
    const res = await proxy("knowledge", { method: "POST", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const created = await mutate((db) => {
    const entry: KnowledgeEntry = {
      id: uid("kb"),
      title: body.title ?? "Untitled",
      content: body.content ?? "",
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: "indexed", // lea-be-core would set "pending" until embedded
      addedBy: gate.email,
      addedAt: new Date().toISOString(),
    };
    db.knowledge.unshift(entry);
    audit(db, gate.email, "create", "knowledge", entry.id, null, "Added to AI knowledge base");
    return entry;
  });
  return NextResponse.json(created, { status: 201 });
}
