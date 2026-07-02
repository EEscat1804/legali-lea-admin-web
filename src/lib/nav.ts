// Sidebar navigation config. Each item maps to a PRD §3 feature area and the
// capability required to see it. The shell filters this list by the signed-in
// admin's role (see components/layout/Sidebar).

import type { Capability } from "./rbac";

export interface NavItem {
  href: string;
  label: string;
  prd: string; // PRD section reference
  capability: Capability;
  icon: string; // simple emoji glyph — swap for an icon set later
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Analytics", prd: "§3.6", capability: "analytics.read", icon: "📊" },
  { href: "/users", label: "Users", prd: "§3.1", capability: "users.read", icon: "👤" },
  { href: "/counselors", label: "Counselors", prd: "§3.2", capability: "counselors.read", icon: "🧑‍⚕️" },
  { href: "/content", label: "Content", prd: "§3.3", capability: "content.read", icon: "📚" },
  { href: "/subscriptions", label: "Subscriptions", prd: "§3.4", capability: "subscriptions.read", icon: "💳" },
  { href: "/feedback", label: "Feedback", prd: "§3.5", capability: "feedback.read", icon: "📨" },
  { href: "/resources", label: "Resources", prd: "§3.7", capability: "resources.read", icon: "🎨" },
  { href: "/data", label: "Feature Data", prd: "§3.8", capability: "data.read", icon: "🗂️" },
  { href: "/system", label: "System", prd: "§3.9", capability: "system.read", icon: "⚙️" },
  { href: "/audit", label: "Audit Log", prd: "§3.10", capability: "audit.read", icon: "📝" },
  { href: "/team", label: "Team", prd: "§2", capability: "admins.write", icon: "👥" },
];
