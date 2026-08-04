// Maps lea-be-core's /api/lea/admin/* response shapes (snake_case, see
// backend-test's admin-data.routes.ts — response keys are snake_case by
// repo-wide convention there) onto the camelCase shapes this panel's pages
// are built against (src/lib/types.ts). backend.ts's proxy() only unwraps
// the { success, data } envelope; it doesn't know per-endpoint field shapes,
// so that mapping happens here, one function per implemented endpoint.
//
// Add a mapper here the same day a new lea-be-core endpoint is added to
// BACKEND_ENDPOINTS in backend.ts.

import type { Counselor, PricingPlan, SubscriptionRow, AppUser } from "@/lib/types";

// ── Counselors ──────────────────────────────────────────────────────────────
interface BackendCounselor {
  id: string;
  name: string;
  email: string;
  type_key: string | null;
  is_available: boolean;
  is_active: boolean;
  active_clients: number;
  max_clients: number | null;
  languages: string[] | null;
  join_date: string;
  specialisations: string[] | null;
  credentials: string[] | null;
  bio: string | null;
  fee: number | null;
  response_time: string | null;
  pro_bono: boolean;
  crisis_support: boolean;
}

export function mapCounselor(c: BackendCounselor): Counselor {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    typeKey: c.type_key ?? "",
    isAvailable: c.is_available,
    isActive: c.is_active,
    activeClients: c.active_clients,
    maxClients: c.max_clients ?? 0,
    languages: (c.languages ?? []) as Counselor["languages"],
    joinDate: c.join_date,
    specialisations: c.specialisations ?? [],
    credentials: (c.credentials ?? []).join(", "),
    bio: c.bio ?? "",
    fee: c.fee,
    responseTime: c.response_time ?? "",
    proBono: c.pro_bono,
    crisis: c.crisis_support,
  };
}

// ── Users ───────────────────────────────────────────────────────────────────
interface BackendUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  language: string;
  personality: string;
  interests: string[];
  streak: number;
  level: number;
  join_date: string;
  status: "active" | "deleted";
  subscription: {
    plan: string;
    status: string;
    billing_period: string | null;
    start: string | null;
    expiry: string | null;
  };
  engagement: {
    last_login: string | null;
    chat_sessions: number;
    modules_completed: number;
    mood_logs: number;
  };
}

export function mapUser(u: BackendUser): AppUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatar_url,
    language: u.language as AppUser["language"],
    personality: u.personality as AppUser["personality"],
    interests: u.interests,
    streak: u.streak,
    level: u.level,
    joinDate: u.join_date,
    status: u.status,
    subscription: {
      plan: u.subscription.plan,
      status: u.subscription.status as AppUser["subscription"]["status"],
      billingPeriod: u.subscription.billing_period as AppUser["subscription"]["billingPeriod"],
      start: u.subscription.start,
      expiry: u.subscription.expiry,
    },
    engagement: {
      lastLogin: u.engagement.last_login,
      chatSessions: u.engagement.chat_sessions,
      modulesCompleted: u.engagement.modules_completed,
      moodLogs: u.engagement.mood_logs,
    },
  };
}

// ── Subscriptions ───────────────────────────────────────────────────────────
interface BackendSubscriptionItem {
  id: string;
  user_id: string;
  user_name: string;
  plan: string;
  status: string;
  billing_period: string | null;
  start: string | null;
  expiry: string | null;
}

interface BackendPlan {
  id: string;
  name: string;
  type: "free" | "pro" | "other";
  price: number;
  currency: string;
  billing_period: "monthly" | "yearly";
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

interface BackendSubscriptionsResponse {
  items: BackendSubscriptionItem[];
  total: number;
  limit: number;
  offset: number;
  plans: BackendPlan[];
  metrics: {
    active_subscribers: number;
    cancelled: number;
    expired: number;
    free: number;
  };
}

export function mapSubscriptions(res: BackendSubscriptionsResponse): {
  items: SubscriptionRow[];
  total: number;
  plans: PricingPlan[];
  metrics: Record<string, number>;
} {
  return {
    items: res.items.map((s) => ({
      id: s.id,
      userId: s.user_id,
      userName: s.user_name,
      plan: s.plan,
      status: s.status as SubscriptionRow["status"],
      start: s.start,
      expiry: s.expiry,
    })),
    total: res.total,
    plans: res.plans.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      price: p.price,
      currency: p.currency,
      billingPeriod: p.billing_period,
      stripeProductId: p.stripe_product_id,
      stripePriceId: p.stripe_price_id,
    })),
    metrics: {
      activeSubscribers: res.metrics.active_subscribers,
      cancelled: res.metrics.cancelled,
      expired: res.metrics.expired,
      free: res.metrics.free,
    },
  };
}
