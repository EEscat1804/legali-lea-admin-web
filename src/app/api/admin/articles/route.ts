import { NextRequest, NextResponse } from "next/server";
import { mutate, readDb, audit, uid } from "@/lib/server/db";
import { requireAdmin, isResponse } from "@/lib/server/session";
import { backendConfigured, proxy } from "@/lib/server/backend";
import type { Article } from "@/lib/types";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// Articles pushed to the marketing website (manager ask). content.read/write.
export async function GET() {
  const gate = await requireAdmin("content.read");
  if (isResponse(gate)) return gate;
  if (backendConfigured()) return NextResponse.json(await (await proxy("articles")).json());
  const db = await readDb();
  return NextResponse.json({ items: db.articles });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin("content.write");
  if (isResponse(gate)) return gate;
  const body = await req.json().catch(() => ({}));
  if (backendConfigured()) {
    const res = await proxy("articles", { method: "POST", body });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  }

  const created = await mutate((db) => {
    const now = new Date().toISOString();
    const publish = body.status === "published";
    const a: Article = {
      id: uid("art"),
      title: body.title ?? "Untitled",
      slug: body.slug ? slugify(body.slug) : slugify(body.title ?? "untitled"),
      excerpt: body.excerpt ?? "",
      body: body.body ?? "",
      status: publish ? "published" : "draft",
      author: gate.email,
      publishedAt: publish ? now : null,
      updatedAt: now,
    };
    db.articles.unshift(a);
    audit(db, gate.email, "create", "article", a.id, null, publish ? "Published to website" : "Draft created");
    return a;
  });
  return NextResponse.json(created, { status: 201 });
}
