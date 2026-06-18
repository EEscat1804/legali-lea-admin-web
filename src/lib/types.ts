// Shared domain types for the Lea Admin Panel.
// These mirror the entities described in the PRD (§2, §3) and the lea-be-core DB.
// Kept intentionally lightweight — the backend (lea-be-core /api/lea/admin/*) is the
// source of truth; these are the shapes the admin UI consumes.

// ── Roles & auth (PRD §2, §4.3) ────────────────────────────────────────────
export type AdminRole = "super_admin" | "operator" | "content_editor" | "viewer";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  lastLogin: string | null; // ISO timestamp
  totpEnabled: boolean;
}

// ── Survivors / app users (PRD §3.1) ───────────────────────────────────────
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "free";
export type Language = "en" | "id" | "es" | "de" | "fr" | "hi";
export type LeaPersonality = "gentle" | "direct" | "strong" | "warm" | "crisis";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  language: Language;
  personality: LeaPersonality;
  interests: string[];
  streak: number;
  level: number;
  joinDate: string;
  status: "active" | "suspended" | "deleted";
  subscription: {
    plan: string;
    status: SubscriptionStatus;
    billingPeriod: "monthly" | "yearly" | null;
    start: string | null;
    expiry: string | null;
    adminOverride?: { reason: string; expiry: string; grantedBy: string };
  };
  engagement: {
    lastLogin: string | null;
    chatSessions: number;
    modulesCompleted: number;
    moodLogs: number;
  };
}

// ── Counselors (PRD §3.2) ──────────────────────────────────────────────────
export interface Counselor {
  id: string;
  name: string;
  email: string;
  typeKey: string;
  isAvailable: boolean;
  isActive: boolean;
  activeClients: number;
  maxClients: number;
  languages: Language[];
  joinDate: string;
  specialisations: string[];
  credentials: string;
  bio: string;
  fee: number | null;
  responseTime: string;
  proBono: boolean;
  crisis: boolean;
}

// ── Content / Learn (PRD §3.3) ─────────────────────────────────────────────
export interface LearnModule {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  badgeCount: number;
  published: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  order: number;
  enrolment: number;
  completionRate: number; // 0..1
  avgScore: number; // 0..1, avg quiz score across the module
  imageUrl: string | null; // module cover illustration
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  type: "quiz" | "read" | "video";
  status: "draft" | "published";
}

export interface LearnBadge {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  iconUrl: string | null;
  earnedCount: number; // # users who have earned it — drives the delete warning
}

export interface SupportedLanguage {
  code: Language;
  displayName: string;
  enabled: boolean;
}

// ── Subscriptions & billing (PRD §3.4) ─────────────────────────────────────
export interface PricingPlan {
  id: string;
  name: string;
  type: "free" | "pro" | "other";
  price: number;
  currency: string;
  billingPeriod: "monthly" | "yearly";
  stripeProductId: string | null;
  stripePriceId: string | null;
}

export interface SubscriptionRow {
  id: string;
  userId: string;
  userName: string;
  plan: string;
  status: SubscriptionStatus;
  start: string | null;
  expiry: string | null;
}

// ── Feedback & support (PRD §3.5) ──────────────────────────────────────────
export type FeedbackType = "bug" | "suggestion";
export type FeedbackStatus = "open" | "in_progress" | "resolved" | "closed";

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  userId: string;
  userName: string;
  message: string;
  screenshotUrl: string | null;
  createdAt: string;
  status: FeedbackStatus;
  assignee: string | null;
  internalNote: string | null;
  githubUrl: string | null;
}

// ── Audit log (PRD §3.10) ──────────────────────────────────────────────────
export type AuditAction = "create" | "update" | "delete" | "login" | "override";

export interface AuditEntry {
  id: string;
  actor: string; // admin email
  action: AuditAction;
  entityType: string;
  entityId: string;
  diff: Record<string, { before: unknown; after: unknown }> | null;
  reason: string | null;
  timestamp: string;
}

// ── System & config (PRD §3.9) ─────────────────────────────────────────────
export interface ErrorLogEntry {
  id: string;
  status: number;
  method: string;
  path: string;
  message: string;
  timestamp: string;
}

export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  createdAt: string;
}

// ── Resources / master data (PRD §3.7) ─────────────────────────────────────
export interface StickerPack {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  stickerCount: number;
  enabled: boolean;
  order: number;
}

export interface MasterDataItem {
  key: string;
  displayName: string;
  enabled: boolean;
}

// ── Content articles pushed to the marketing website (manager ask) ─────────
export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "draft" | "published";
  author: string;
  publishedAt: string | null;
  updatedAt: string;
}

// ── AI knowledge base entries (RAG) fed to Lea (manager ask) ───────────────
export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  status: "indexed" | "pending";
  addedBy: string;
  addedAt: string;
}

// ── AI model configuration (PRD §3.9) ──────────────────────────────────────
export interface ModelConfig {
  primary: string;
  fallback: string[];
  candidates: string[];
  updatedBy: string | null;
  reason: string | null;
  updatedAt: string | null;
}

// ── Generic paginated response shape used by every list endpoint ───────────
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
