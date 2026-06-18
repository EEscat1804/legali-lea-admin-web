import { NextRequest, NextResponse } from "next/server";
import { mutate, audit } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendConfigured, proxy } from "@/lib/server/backend";

// Publish/unpublish/edit an article. PATCH body: { status?, title?, body?, excerpt? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin("content.write");
  if (isResponse(gate)) return gate;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (backendConfigured()) {
    const res = await proxy(`articles/${id}`, { method: "PATCH", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const updated = await mutate((db) => {
    const a = db.articles.find((x) => x.id === id);
    if (!a) return null;
    const before = a.status;
    if (typeof body.title === "string") a.title = body.title;
    if (typeof body.body === "string") a.body = body.body;
    if (typeof body.excerpt === "string") a.excerpt = body.excerpt;
    if (body.status === "published" || body.status === "draft") {
      a.status = body.status;
      a.publishedAt = body.status === "published" ? new Date().toISOString() : null;
    }
    a.updatedAt = new Date().toISOString();
    audit(db, gate.email, "update", "article", id, { status: { before, after: a.status } }, body.status === "published" ? "Pushed to website" : null);
    return a;
  });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin("content.write");
  if (isResponse(gate)) return gate;
  const { id } = await params;
  if (backendConfigured()) {
    const res = await proxy(`articles/${id}`, { method: "DELETE" });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }
  await mutate((db) => {
    db.articles = db.articles.filter((a) => a.id !== id);
    audit(db, gate.email, "delete", "article", id);
  });
  return NextResponse.json({ ok: true });
}
