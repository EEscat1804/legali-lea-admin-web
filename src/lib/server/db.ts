// File-backed data store — the working backend for the admin panel.
//
// This is a real, persistent store (JSON on disk under .data/) so every admin
// flow actually works today. It is intentionally simple — an internal tool with
// low traffic. When Davis's lea-be-core admin endpoints exist, set BACKEND_API_URL
// and the route handlers proxy to him instead of touching this store (see
// src/lib/server/backend.ts). Until then, this IS the backend.

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  USERS,
  COUNSELORS,
  MODULES,
  LESSONS,
  BADGES,
  PLANS,
  SUBSCRIPTIONS,
  FEEDBACK,
  AUDIT,
  FEATURE_FLAGS,
} from "@/lib/mock-data";
import type {
  AdminUser,
  AppUser,
  Article,
  AuditEntry,
  Counselor,
  FeatureFlag,
  FeedbackItem,
  KnowledgeEntry,
  LearnModule,
  ModelConfig,
  PricingPlan,
  SubscriptionRow,
} from "@/lib/types";

// Admin accounts include a password (demo) — never sent to the client.
export interface AdminAccount extends AdminUser {
  password: string;
}

export interface Session {
  token: string;
  adminId: string;
  expiresAt: number; // epoch ms
}

export interface Db {
  admins: AdminAccount[];
  sessions: Session[];
  users: AppUser[];
  counselors: Counselor[];
  modules: LearnModule[];
  plans: PricingPlan[];
  subscriptions: SubscriptionRow[];
  feedback: FeedbackItem[];
  featureFlags: FeatureFlag[];
  audit: AuditEntry[];
  modelConfig: ModelConfig;
  articles: Article[];
  knowledge: KnowledgeEntry[];
}

// process.cwd() is inside the deployed bundle, which is read-only on Vercel
// (and most serverless hosts) — writing there throws EROFS. process.env.VERCEL
// is set automatically by the platform, so fall back to the OS tmp dir there.
// NOTE: /tmp is ephemeral per function instance — fine for seed data (it's
// regenerated on first read), but session tokens written here can disappear
// across cold starts or when a request lands on a different warm instance.
// This unblocks the 500, it does not make the local store production-durable
// — see BACKEND_API_URL / lea-be-core for the real fix.
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "lea-admin-data")
  : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function seed(): Db {
  return {
    admins: [
      { id: "a1", email: "super@legali.ai", displayName: "Super Admin", role: "super_admin", isActive: true, lastLogin: null, totpEnabled: true, password: "demo" },
      { id: "a2", email: "ops@legali.ai", displayName: "Ops User", role: "operator", isActive: true, lastLogin: null, totpEnabled: true, password: "demo" },
      { id: "a3", email: "editor@legali.ai", displayName: "Content Editor", role: "content_editor", isActive: true, lastLogin: null, totpEnabled: true, password: "demo" },
      { id: "a4", email: "viewer@legali.ai", displayName: "Read Only", role: "viewer", isActive: true, lastLogin: null, totpEnabled: true, password: "demo" },
      { id: "a5", email: "apple@legali.ai", displayName: "Apple Mistry", role: "operator", isActive: true, lastLogin: null, totpEnabled: true, password: "demo" },
      { id: "a6", email: "davis@legali.ai", displayName: "Davis", role: "super_admin", isActive: true, lastLogin: null, totpEnabled: true, password: "demo" },
    ],
    sessions: [],
    users: structuredClone(USERS),
    counselors: structuredClone(COUNSELORS),
    modules: structuredClone(MODULES),
    plans: structuredClone(PLANS),
    subscriptions: structuredClone(SUBSCRIPTIONS),
    feedback: structuredClone(FEEDBACK),
    featureFlags: structuredClone(FEATURE_FLAGS),
    audit: structuredClone(AUDIT),
    modelConfig: {
      primary: "claude-opus-4-8",
      fallback: ["claude-sonnet-4-6", "gemini-1.5-pro"],
      candidates: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5", "gemini-1.5-pro", "gemini-1.5-flash"],
      updatedBy: null,
      reason: null,
      updatedAt: null,
    },
    articles: [
      { id: "art_1", title: "Recognising coercive control", slug: "recognising-coercive-control", excerpt: "What coercive control looks like and your options.", body: "Coercive control is a pattern of behaviour...", status: "published", author: "editor@legali.ai", publishedAt: "2026-05-02T10:00:00Z", updatedAt: "2026-05-02T10:00:00Z" },
      { id: "art_2", title: "Preparing for a protection order hearing", slug: "preparing-protection-order-hearing", excerpt: "A step-by-step guide.", body: "Draft...", status: "draft", author: "editor@legali.ai", publishedAt: null, updatedAt: "2026-06-10T09:00:00Z" },
    ],
    knowledge: [
      { id: "kb_1", title: "Restraining order eligibility (US)", content: "In most US states, you may petition for a restraining order if...", tags: ["legal", "us", "restraining-order"], status: "indexed", addedBy: "ops@legali.ai", addedAt: "2026-04-12T12:00:00Z" },
    ],
  };
}

let cache: Db | null = null;

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(seed(), null, 2), "utf8");
  }
}

export async function readDb(): Promise<Db> {
  if (cache) return cache;
  await ensureFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  cache = JSON.parse(raw) as Db;
  return cache;
}

export async function writeDb(db: Db): Promise<void> {
  cache = db;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

// Mutate the db with a callback, persist, and return the callback's result.
export async function mutate<T>(fn: (db: Db) => T): Promise<T> {
  const db = await readDb();
  const result = fn(db);
  await writeDb(db);
  return result;
}

// Append an audit entry (PRD §3.10). Call inside mutate() before persisting.
export function audit(
  db: Db,
  actor: string,
  action: AuditEntry["action"],
  entityType: string,
  entityId: string,
  diff: AuditEntry["diff"] = null,
  reason: string | null = null,
): void {
  db.audit.unshift({
    id: `al_${db.audit.length + 1}_${entityId}`,
    actor,
    action,
    entityType,
    entityId,
    diff,
    reason,
    timestamp: new Date().toISOString(),
  });
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}