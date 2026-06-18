# Lea Admin Panel — `legali-lea-admin-web`

Internal operator control plane for the Lea platform. Implements the **Lea Admin Panel PRD v0.1** (Davis, 2026-05-28).

> **Status: scaffold.** Auth, data, and all write actions are mocked client-side so the entire panel is navigable and demoable today. Everything mocked is clearly marked (amber `Scaffold:` banners + `// TODO:` comments) and maps to a future `lea-be-core` `/api/lea/admin/*` endpoint. See [What's real vs. mocked](#whats-real-vs-mocked).

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 3** — no external UI library (keeps the bundle small per PRD §5)
- Zero runtime deps beyond Next/React. `npm install` then run.

This is the "React/Next.js" option from PRD §4.1. If the team prefers to match the counselor web's Vite + TanStack Router stack, the `src/lib/*` domain layer (types, RBAC, nav) is framework-agnostic and ports directly.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (verifies all routes compile)
npm run typecheck  # tsc --noEmit
npm run lint
```

### Demo logins

Login is faked (see `src/lib/auth.tsx`). On the login page click any demo account — password is `demo`, and **any 6-digit code** passes the TOTP step. One account per role so you can exercise the RBAC matrix:

| Email | Role |
|---|---|
| `super@legali.ai` | Super Admin (full access) |
| `ops@legali.ai` | Operator |
| `editor@legali.ai` | Content Editor |
| `viewer@legali.ai` | Viewer (read-only) |

Switch accounts to see the sidebar and write-action buttons change per the capability matrix.

## Project layout

```
src/
  app/
    layout.tsx              # root: wraps app in <AuthProvider>
    page.tsx                # redirects to /dashboard or /login
    login/page.tsx          # §4.3 email+password → TOTP flow (mocked)
    (admin)/                # authenticated route group
      layout.tsx            # the shell: auth guard + Sidebar + Topbar
      dashboard/page.tsx    # §3.6 Platform Analytics
      users/page.tsx        # §3.1 list
      users/[id]/page.tsx   # §3.1 profile + lifecycle actions
      counselors/page.tsx   # §3.2
      content/page.tsx      # §3.3 learn modules
      content/languages/    # §3.3 supported languages
      subscriptions/page.tsx# §3.4
      feedback/page.tsx     # §3.5
      resources/page.tsx    # §3.7 stickers / avatars / master data
      data/page.tsx         # §3.8 feature-data browser
      system/page.tsx       # §3.9 error logs / flags / model config
      audit/page.tsx        # §3.10
  components/
    ui.tsx                  # shared primitives: Button, Card, Badge, Table, ...
    layout/Sidebar.tsx      # role-filtered nav + feedback bug badge
    layout/Topbar.tsx       # current user + sign out
  lib/
    types.ts                # all domain types (mirror lea-be-core DB)
    rbac.ts                 # 4 roles + capability matrix + can()
    nav.ts                  # sidebar config (route → PRD § → capability)
    auth.tsx                # AuthProvider/useAuth (real cookie session via /api/admin/auth)
    api.ts                  # typed client (api.*) + useApi() hook
    mock-data.ts            # seed data + paginate/search helpers (still used by un-wired pages)
    format.ts               # date/money/percent formatters
    server/                 # server-only: db.ts (file store), session.ts, backend.ts (proxy switch)
  app/api/admin/            # route handlers — the working backend (auth + per resource)
  middleware.ts             # server-side route guard (redirects to /login without a session)
```

## Architecture notes (PRD §4)

- **Separate app, own domain.** Deploys to `admin.legali.ai`, behind an IP allowlist / VPN. `next.config.mjs` sets `noindex`, `X-Frame-Options: DENY`, etc. The IP allowlist is enforced at the edge (Cloudflare / firewall), not here.
- **RBAC is defence-in-depth.** `src/lib/rbac.ts` encodes the §2 role matrix. The UI hides/disables actions a role can't perform, but **the backend must enforce the same matrix** — the client gate is never the sole control (PRD §5).
- **Auth (§4.3).** Real flow: email+password → TOTP → short-lived JWT (15m) + refresh (7d) in httpOnly cookies, validated by `adminAuthMiddleware`. The scaffold fakes step 1/2 in `localStorage`; replace `signIn`/`verifyTotp` in `auth.tsx` and the `(admin)/layout.tsx` guard with a server-side session check.
- **Audit log (§3.10).** Every write must produce an `AuditEntry`. In the scaffold the audit page reads mock data; in production the audit-log middleware fires automatically on every admin write endpoint. The viewer is append-only — no edit/delete controls exist by design.
- **Read path (§4.4).** The admin API uses dedicated admin repo functions, **not** the user-facing service layer, to avoid side effects (streak updates, notifications).

## Backend wiring (it actually works now)

The priority flows run against a **real, persistent backend** built into the app: Next.js route handlers under `src/app/api/admin/*` backed by a file store (`.data/db.json`). Auth is a real cookie session. See **`BACKEND_CONTRACT.md`** for the full endpoint list.

- **Connecting to `lea-be-core` (Davis):** set `BACKEND_API_URL` (see `.env.example`). Every route then **proxies** to `${BACKEND_API_URL}/api/lea/admin/*` instead of the local store — one env var, no frontend changes. The proxy seam is `src/lib/server/backend.ts`.
- **Client data layer:** `src/lib/api.ts` (typed `api.*` + `useApi` hook). Pages call this; never the store directly.

| Wired & persistent (works now) | Still local/mock (next to wire) |
|---|---|
| Auth: login → TOTP → httpOnly cookie session | Feedback inbox (§3.5) |
| Add/edit counselors (§3.2) | Audit log *read* (writes already recorded) |
| Monitor users + lifecycle (§3.1) | Platform analytics (§3.6) |
| Switch AI models (§3.9) | Error logs + feature flags (§3.9) |
| Create/manage admin accounts (§2) | Feature-data browser (§3.8) |
| Push articles to website (§3.3) | Stickers/avatars/master-data (§3.7) |
| Add AI knowledge / RAG (resources) | Module/lesson/badge editing (§3.3) |
| Control subscriptions — grant/revoke Pro (§3.4) | |

TOTP is still mocked (any 6-digit code) until `lea-be-core` verifies the real secret. Each not-yet-wired area has a `// TODO:` and an entry in `BACKEND_CONTRACT.md`.

## Milestone mapping (PRD §8)

| Milestone | Scope | Scaffold state |
|---|---|---|
| **M1 — Auth + Shell** | Auth, role model, audit table, UI shell | ✅ shell, RBAC, audit viewer, nav, login flow (mock auth) |
| **M2 — Users & Counselors** | §3.1, §3.2 | ✅ pages scaffolded |
| **M3 — Content & Feedback** | §3.3, §3.5 | ✅ pages scaffolded |
| **M4 — Analytics & Billing** | §3.6, §3.4 | ✅ pages scaffolded |
| **M5 — Resources & Data** | §3.7, §3.8 | ✅ pages scaffolded |
| **M6 — System** | §3.9 | ✅ pages scaffolded (notification templates = v2 placeholder) |

Every feature page covers the full PRD requirement list for its section as interactive (mock-backed) UI. The next step per area is wiring it to a real endpoint.

## Conventions for contributors

When you build out a feature area:

1. Pages are client components (`"use client"`). Compose primitives from `@/components/ui` — don't pull in a UI library.
2. Read data via the helpers in `@/lib/mock-data` for now; when the endpoint exists, swap that import for a `fetch` wrapper keeping the same return shape (`Paginated<T>` etc. in `types.ts`).
3. Gate every write with `can(user.role, "<area>.write")` from `@/lib/rbac`. Keep the backend check in lockstep.
4. Leave a `// TODO: <METHOD> /api/lea/admin/...` comment at each no-op so the integration work is greppable.
5. Run `npm run typecheck` before committing.
