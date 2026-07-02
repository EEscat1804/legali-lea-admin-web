// Mock dataset + query helpers — SCAFFOLD ONLY.
//
// Every feature page reads from here so the panel is fully navigable today.
// Each exported collection corresponds to a lea-be-core admin endpoint; replace
// the `db.*` helpers with `fetch("/api/lea/admin/...")` calls when the backend
// (PRD §4.2) ships. Shapes already match src/lib/types.ts.

import type {
  AdminUser,
  AppUser,
  AuditEntry,
  Counselor,
  ErrorLogEntry,
  FeatureFlag,
  FeedbackItem,
  LearnBadge,
  LearnModule,
  Lesson,
  MasterDataItem,
  Paginated,
  PricingPlan,
  StickerPack,
  SubscriptionRow,
  SupportedLanguage,
} from "./types";

// ── Admin team / admin_users (PRD §2, §4.2) ────────────────────────────────
// The Legali operators who can sign into this panel. Super Admin manages this
// roster from the Team page. Mirrors the login accounts in src/lib/auth.tsx.
export const ADMINS: AdminUser[] = [
  { id: "a1", email: "super@legali.ai", displayName: "Super Admin", role: "super_admin", isActive: true, lastLogin: "2026-06-17T08:30:00Z", totpEnabled: true },
  { id: "a2", email: "ops@legali.ai", displayName: "Ops User", role: "operator", isActive: true, lastLogin: "2026-06-16T15:10:00Z", totpEnabled: true },
  { id: "a3", email: "editor@legali.ai", displayName: "Content Editor", role: "content_editor", isActive: true, lastLogin: "2026-06-14T11:05:00Z", totpEnabled: true },
  { id: "a4", email: "viewer@legali.ai", displayName: "Read Only", role: "viewer", isActive: true, lastLogin: "2026-06-10T09:00:00Z", totpEnabled: true },
  // Apple Mistry — intern, onboarded to help manage the trauma-informed
  // specialist network. Operator role so she can add/manage specialists.
  { id: "a5", email: "apple@legali.ai", displayName: "Apple Mistry", role: "operator", isActive: true, lastLogin: null, totpEnabled: false },
];

// ── Users (§3.1) ───────────────────────────────────────────────────────────
export const USERS: AppUser[] = [
  {
    id: "u_1001", name: "Maya Sari", email: "maya@example.com", avatarUrl: null,
    language: "id", personality: "gentle", interests: ["know_my_rights", "healthy_boundaries"],
    streak: 12, level: 4, joinDate: "2026-01-14", status: "active",
    subscription: { plan: "Pro Yearly", status: "active", billingPeriod: "yearly", start: "2026-01-14", expiry: "2027-01-14" },
    engagement: { lastLogin: "2026-06-16", chatSessions: 87, modulesCompleted: 6, moodLogs: 140 },
  },
  {
    id: "u_1002", name: "Alex Chen", email: "alex@example.com", avatarUrl: null,
    language: "en", personality: "direct", interests: ["healthy_boundaries"],
    streak: 0, level: 2, joinDate: "2026-03-02", status: "active",
    subscription: { plan: "Free", status: "free", billingPeriod: null, start: null, expiry: null },
    engagement: { lastLogin: "2026-06-10", chatSessions: 14, modulesCompleted: 1, moodLogs: 22 },
  },
  {
    id: "u_1003", name: "Sofia Ramirez", email: "sofia@example.com", avatarUrl: null,
    language: "es", personality: "warm", interests: ["know_my_rights"],
    streak: 3, level: 3, joinDate: "2025-11-20", status: "suspended",
    subscription: { plan: "Pro Monthly", status: "cancelled", billingPeriod: "monthly", start: "2025-11-20", expiry: "2026-05-20" },
    engagement: { lastLogin: "2026-05-01", chatSessions: 51, modulesCompleted: 4, moodLogs: 90 },
  },
  {
    id: "u_1004", name: "Priya Nair", email: "priya@example.com", avatarUrl: null,
    language: "hi", personality: "strong", interests: ["know_my_rights", "healthy_boundaries"],
    streak: 28, level: 6, joinDate: "2025-09-05", status: "active",
    subscription: {
      plan: "Pro (comp)", status: "active", billingPeriod: null, start: "2026-02-01", expiry: "2026-12-31",
      adminOverride: { reason: "Beta tester comp", expiry: "2026-12-31", grantedBy: "ops@legali.ai" },
    },
    engagement: { lastLogin: "2026-06-17", chatSessions: 210, modulesCompleted: 9, moodLogs: 300 },
  },
];

// ── Counselors (§3.2) ────────────────────────────────────────────────────────
export const COUNSELORS: Counselor[] = [
  {
    id: "c_01", name: "Dr. Lena Fischer", email: "lena@legali.ai", typeKey: "legal_advisor",
    isAvailable: true, isActive: true, activeClients: 8, maxClients: 15, languages: ["de", "en"],
    joinDate: "2025-08-01", specialisations: ["Family law", "Restraining orders"], credentials: "JD, Bar #4421",
    bio: "15 years in survivor advocacy.", fee: 0, responseTime: "< 24h", proBono: true, crisis: false,
  },
  {
    id: "c_02", name: "Marcus Webb", email: "marcus@legali.ai", typeKey: "counselor",
    isAvailable: false, isActive: true, activeClients: 12, maxClients: 12, languages: ["en"],
    joinDate: "2025-10-12", specialisations: ["Trauma", "CBT"], credentials: "LPC",
    bio: "Trauma-informed counselor.", fee: 60, responseTime: "< 48h", proBono: false, crisis: true,
  },
  {
    id: "c_03", name: "Aisha Khan", email: "aisha@legali.ai", typeKey: "counselor",
    isAvailable: true, isActive: false, activeClients: 0, maxClients: 10, languages: ["en", "hi"],
    joinDate: "2025-06-30", specialisations: ["Anxiety"], credentials: "MSW",
    bio: "Deactivated pending re-credentialing.", fee: 45, responseTime: "< 72h", proBono: false, crisis: false,
  },
];

// ── Content (§3.3) ───────────────────────────────────────────────────────────
export const MODULES: LearnModule[] = [
  { id: "m_1", title: "Know Your Rights", description: "Legal basics for survivors.", lessonCount: 6, badgeCount: 2, published: true, difficulty: "beginner", estimatedMinutes: 45, order: 1, enrolment: 1240, completionRate: 0.62, avgScore: 0.81, imageUrl: "/lea/module-1.png" },
  { id: "m_2", title: "Setting Boundaries", description: "Healthy boundary-setting.", lessonCount: 5, badgeCount: 1, published: true, difficulty: "beginner", estimatedMinutes: 30, order: 2, enrolment: 980, completionRate: 0.54, avgScore: 0.76, imageUrl: "/lea/module-2.png" },
  { id: "m_3", title: "Safety Planning", description: "Build a personal safety plan.", lessonCount: 4, badgeCount: 1, published: false, difficulty: "intermediate", estimatedMinutes: 25, order: 3, enrolment: 0, completionRate: 0, avgScore: 0, imageUrl: "/lea/module-3.png" },
];

// Lessons keyed by module (§3.3). getLessons() simulates the lessons endpoint.
export const LESSONS: Lesson[] = [
  { id: "l_1", moduleId: "m_1", title: "What are my rights?", order: 1, type: "read", status: "published" },
  { id: "l_2", moduleId: "m_1", title: "Reporting & evidence", order: 2, type: "read", status: "published" },
  { id: "l_3", moduleId: "m_1", title: "Quick check", order: 3, type: "quiz", status: "published" },
  { id: "l_4", moduleId: "m_2", title: "Naming a boundary", order: 1, type: "read", status: "published" },
  { id: "l_5", moduleId: "m_2", title: "Watch: saying no", order: 2, type: "video", status: "draft" },
  { id: "l_6", moduleId: "m_3", title: "Your safe contacts", order: 1, type: "read", status: "draft" },
];

// Learn badges keyed by module (§3.3). earnedCount drives the delete warning.
export const BADGES: LearnBadge[] = [
  { id: "b_1", moduleId: "m_1", name: "Rights Rookie", description: "Completed lesson 1.", iconUrl: "/lea/badge-1.png", earnedCount: 612 },
  { id: "b_2", moduleId: "m_1", name: "Rights Champion", description: "Completed the module.", iconUrl: "/lea/badge-2.png", earnedCount: 188 },
  { id: "b_3", moduleId: "m_2", name: "Boundary Builder", description: "Completed the module.", iconUrl: "/lea/badge-3.png", earnedCount: 240 },
  { id: "b_4", moduleId: "m_3", name: "Safety First", description: "Built a safety plan.", iconUrl: "/lea/badge-4.png", earnedCount: 0 },
];

export function getLessons(moduleId: string): Lesson[] {
  return LESSONS.filter((l) => l.moduleId === moduleId).sort((a, b) => a.order - b.order);
}

export function getBadges(moduleId: string): LearnBadge[] {
  return BADGES.filter((b) => b.moduleId === moduleId);
}

export const LANGUAGES: SupportedLanguage[] = [
  { code: "en", displayName: "English", enabled: true },
  { code: "id", displayName: "Bahasa Indonesia", enabled: true },
  { code: "es", displayName: "Español", enabled: true },
  { code: "de", displayName: "Deutsch", enabled: true },
  { code: "fr", displayName: "Français", enabled: false },
  { code: "hi", displayName: "हिन्दी", enabled: true },
];

// ── Billing (§3.4) ────────────────────────────────────────────────────────────
export const PLANS: PricingPlan[] = [
  { id: "p_free", name: "Free", type: "free", price: 0, currency: "USD", billingPeriod: "monthly", stripeProductId: null, stripePriceId: null },
  { id: "p_pro_m", name: "Pro Monthly", type: "pro", price: 9.99, currency: "USD", billingPeriod: "monthly", stripeProductId: "prod_abc", stripePriceId: "price_m1" },
  { id: "p_pro_y", name: "Pro Yearly", type: "pro", price: 79.99, currency: "USD", billingPeriod: "yearly", stripeProductId: "prod_abc", stripePriceId: "price_y1" },
];

export const SUBSCRIPTIONS: SubscriptionRow[] = USERS.map((u) => ({
  id: `s_${u.id}`, userId: u.id, userName: u.name, plan: u.subscription.plan,
  status: u.subscription.status, start: u.subscription.start, expiry: u.subscription.expiry,
}));

// ── Feedback (§3.5) ───────────────────────────────────────────────────────────
export const FEEDBACK: FeedbackItem[] = [
  { id: "f_1", type: "bug", userId: "u_1002", userName: "Alex Chen", message: "Chat scroll jumps when keyboard opens.", screenshotUrl: null, createdAt: "2026-06-15T10:22:00Z", status: "open", assignee: null, internalNote: null, githubUrl: null },
  { id: "f_2", type: "suggestion", userId: "u_1001", userName: "Maya Sari", message: "Please add dark mode to journal.", screenshotUrl: null, createdAt: "2026-06-12T08:00:00Z", status: "in_progress", assignee: "Davis", internalNote: "Scheduled for M3.", githubUrl: null },
  { id: "f_3", type: "bug", userId: "u_1004", userName: "Priya Nair", message: "Streak reset after timezone change.", screenshotUrl: null, createdAt: "2026-06-09T19:40:00Z", status: "resolved", assignee: "Davis", internalNote: "Fixed in 2.14.", githubUrl: "https://github.com/legali/lea/issues/412" },
];

// ── Audit log (§3.10) ─────────────────────────────────────────────────────────
export const AUDIT: AuditEntry[] = [
  { id: "al_1", actor: "ops@legali.ai", action: "override", entityType: "user.subscription", entityId: "u_1004", diff: { status: { before: "free", after: "active" } }, reason: "Beta tester comp", timestamp: "2026-02-01T12:00:00Z" },
  { id: "al_2", actor: "super@legali.ai", action: "update", entityType: "counselor", entityId: "c_03", diff: { isActive: { before: true, after: false } }, reason: "Re-credentialing", timestamp: "2026-05-22T09:15:00Z" },
  { id: "al_3", actor: "editor@legali.ai", action: "create", entityType: "learn_module", entityId: "m_3", diff: null, reason: null, timestamp: "2026-06-01T14:30:00Z" },
];

// ── System (§3.9) ─────────────────────────────────────────────────────────────
export const ERROR_LOGS: ErrorLogEntry[] = [
  { id: "e_1", status: 500, method: "POST", path: "/api/lea/chat", message: "Gemini fallback timeout", timestamp: "2026-06-17T08:01:00Z" },
  { id: "e_2", status: 429, method: "POST", path: "/api/lea/chat", message: "Rate limited upstream", timestamp: "2026-06-17T07:58:00Z" },
  { id: "e_3", status: 404, method: "GET", path: "/api/lea/module/999", message: "Module not found", timestamp: "2026-06-16T22:10:00Z" },
];

export const FEATURE_FLAGS: FeatureFlag[] = [
  { key: "ENABLE_VOICE_CHAT", description: "Voice input for Lea chat.", enabled: false, createdAt: "2026-05-01" },
  { key: "ENABLE_PAYWALL", description: "Hard paywall on Pro features.", enabled: true, createdAt: "2026-03-15" },
  { key: "ENABLE_GEMINI_FALLBACK", description: "Fallback to Gemini on primary model error (Issue #85).", enabled: true, createdAt: "2026-06-10" },
];

// ── Resources / master data (§3.7) ──────────────────────────────────────────
export const STICKER_PACKS: StickerPack[] = [
  { id: "sp_1", name: "Encouragement", description: "Supportive stickers.", coverUrl: null, stickerCount: 12, enabled: true, order: 1 },
  { id: "sp_2", name: "Calm", description: "Calming imagery.", coverUrl: null, stickerCount: 8, enabled: true, order: 2 },
  { id: "sp_3", name: "Seasonal", description: "Holiday set.", coverUrl: null, stickerCount: 16, enabled: false, order: 3 },
];

export const INTEREST_CATEGORIES: MasterDataItem[] = [
  { key: "know_my_rights", displayName: "Know My Rights", enabled: true },
  { key: "healthy_boundaries", displayName: "Healthy Boundaries", enabled: true },
  { key: "self_care", displayName: "Self Care", enabled: true },
  { key: "financial_independence", displayName: "Financial Independence", enabled: false },
];

export const COUNSELOR_TYPES: MasterDataItem[] = [
  { key: "legal_advisor", displayName: "Legal Advisor", enabled: true },
  { key: "counselor", displayName: "Counselor", enabled: true },
];

export const PERSONALITIES: Array<MasterDataItem & { description: string }> = [
  { key: "gentle", displayName: "Gentle", description: "Soft, reassuring tone.", enabled: true },
  { key: "direct", displayName: "Direct", description: "Clear and to the point.", enabled: true },
  { key: "strong", displayName: "Strong", description: "Empowering, assertive.", enabled: true },
  { key: "warm", displayName: "Warm", description: "Friendly and personable.", enabled: true },
  { key: "crisis", displayName: "Crisis", description: "Calm, grounding crisis support.", enabled: true },
];

// ── Query helpers (simulate the API's pagination/filter/search) ─────────────
export function paginate<T>(rows: T[], page = 1, pageSize = 25): Paginated<T> {
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
}

export function search<T>(rows: T[], query: string, fields: (keyof T)[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => fields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)));
}

export function getUser(id: string): AppUser | undefined {
  return USERS.find((u) => u.id === id);
}

export function getCounselor(id: string): Counselor | undefined {
  return COUNSELORS.find((c) => c.id === id);
}
