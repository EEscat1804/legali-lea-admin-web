// Role-based access control (PRD §2).
// Four roles; every feature area declares which roles may view it, and write
// actions additionally check `can()`. The backend enforces the same matrix —
// this is defence-in-depth for the UI, never the sole gate (PRD §5).

import type { AdminRole } from "./types";

export const ROLES: Record<AdminRole, { label: string; description: string }> = {
  super_admin: {
    label: "Super Admin",
    description: "Full access. Can create/revoke other admin accounts.",
  },
  operator: {
    label: "Operator",
    description: "Day-to-day ops: users, counselors, content, support. No billing config or system settings.",
  },
  content_editor: {
    label: "Content Editor",
    description: "Create/edit/publish learn modules, lessons, and badges only.",
  },
  viewer: {
    label: "Viewer",
    description: "Read-only. Analytics and audit log.",
  },
};

// Capabilities are coarse-grained per feature area. `*` = all.
export type Capability =
  | "users.read"
  | "users.write"
  | "counselors.read"
  | "counselors.write"
  | "content.read"
  | "content.write"
  | "subscriptions.read"
  | "subscriptions.write"
  | "feedback.read"
  | "feedback.write"
  | "analytics.read"
  | "resources.read"
  | "resources.write"
  | "data.read"
  | "data.write" // destructive feature-data ops (Super Admin only in practice)
  | "system.read"
  | "system.write"
  | "audit.read"
  | "admins.write"; // manage other admin accounts

const MATRIX: Record<AdminRole, Capability[] | "*"> = {
  super_admin: "*",
  operator: [
    "users.read",
    "users.write",
    "counselors.read",
    "counselors.write",
    "content.read",
    "content.write",
    "subscriptions.read",
    "feedback.read",
    "feedback.write",
    "analytics.read",
    "resources.read",
    "resources.write",
    "data.read",
    "system.read",
    "audit.read",
  ],
  content_editor: ["content.read", "content.write", "resources.read", "analytics.read"],
  viewer: [
    "users.read",
    "counselors.read",
    "content.read",
    "subscriptions.read",
    "feedback.read",
    "analytics.read",
    "resources.read",
    "data.read",
    "system.read",
    "audit.read",
  ],
};

export function can(role: AdminRole, cap: Capability): boolean {
  const caps = MATRIX[role];
  if (caps === "*") return true;
  return caps.includes(cap);
}
