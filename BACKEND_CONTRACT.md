# Admin API contract — for `lea-be-core` (Davis)

The admin panel is fully wired. It talks to **same-origin Next.js route handlers** under `/api/admin/*`. Those handlers either:

- use a built-in **local file store** (`.data/db.json`) — the default, so the panel works today; or
- **proxy to `lea-be-core`** when `BACKEND_API_URL` is set — forwarding to `${BACKEND_API_URL}/api/lea/admin/<same path>` with the admin session as a `Bearer` token.

**To connect to Davis's backend:** set `BACKEND_API_URL` (see `.env.example`) and implement the endpoints below under `/api/lea/admin/*`. Request/response shapes match `src/lib/types.ts`. No frontend changes are needed to switch over — it's one env var.

---

## ✅ Status — what's already implemented in `lea-be-core`

These were added to the backend (`src/features/admin/admin-data.routes.ts`, registered in `src/index.ts` under the existing dev/staging admin guard) and **read the real Drizzle tables**. They typecheck and bundle (`wrangler deploy --dry-run`):

- `GET /api/lea/admin/counselors?q=` → real `leaCounselors` (+ `leaUser` email, accepted-connection counts) → panel `Counselor[]`
- `GET /api/lea/admin/users?q=` → real `leaUser` + `leaUserProfiles` + latest `leaUserSubscriptions` → panel `AppUser[]` (satisfies "monitor our users")
- `GET /api/lea/admin/subscriptions` → real `leaUserSubscriptions` + `leaPricingPlans` → rows + plans + metrics

**Admin auth stays in the panel** (the BFF). `lea-be-core` has no per-admin login — its `/api/lea/admin/*` namespace is gated by `APP_ENV` (dev/staging) + an `ADMIN_SECRET` bearer header (staging). So the panel never proxies `/auth/*`.

### Run & connect (needs their Postgres)
1. In `lea-be-core`: copy `.dev.vars.example` → `.dev.vars`, set `DATABASE_URL` (Supabase/Postgres) + Supabase JWT vars, then `npm install && npm run dev` (serves `http://localhost:8787`, `APP_ENV=dev` so the admin namespace is open locally).
2. In this panel: set `BACKEND_API_URL=http://localhost:8787` in `.env.local`, restart `npm run dev`. The three GET endpoints above now serve **real data**.
3. Staging: also send `ADMIN_SECRET` — add it as a header in `src/lib/server/backend.ts` `proxy()`.

### ⏳ Remaining backend work (needs their DB to build/verify)
- **Writes**: add counselor (reuse the existing counselor *invite* flow — counselors FK to a real `leaUser`, so creation provisions a user), user lifecycle PATCH, subscription overrides (tie to Stripe/`leaUserSubscriptions`).
- **New tables + migrations** (don't exist yet): `admin_users` (+ admin auth/TOTP if moving auth server-side), `articles`, `knowledge` (RAG — likely embed via `lea-ai`), `model_config` (or store in Statsig — already a dependency).
Until these exist, keep those flows on the panel's local store (leave `BACKEND_API_URL` unset, or proxy only the GETs above).

## Auth (PRD §4.3) — separate from Supabase
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ ok, pending: true, email }` (no session yet) |
| POST | `/auth/verify-totp` | `{ email, code }` | `{ user }` + sets httpOnly `admin_session` cookie |
| POST | `/auth/logout` | — | clears cookie |
| GET | `/auth/me` | — | `{ user }` or 401 |

Session: short-lived JWT (15m) + refresh (7d) in httpOnly cookies (the local store uses a 7d opaque token). `adminAuthMiddleware` validates it; every write fires the audit middleware (PRD §3.10).

## Resources
| Method | Path | Capability | Notes |
|---|---|---|---|
| GET | `/counselors?q=` | counselors.read | `{ items, total }` |
| POST | `/counselors` | counselors.write | add specialist; returns `Counselor` |
| PATCH | `/counselors/:id` | counselors.write | force availability, max clients, deactivate, edit |
| GET | `/users?q=&status=&sub=&language=` | users.read | `{ items, total }` |
| GET | `/users/:id` | users.read | `AppUser` |
| PATCH | `/users/:id` | users.write | `{ action: suspend\|unsuspend\|delete\|grantPro\|revokePro, reason?, expiry? }` |
| GET | `/model-config` | system.read | `ModelConfig` |
| POST | `/model-config` | system.write | `{ primary?, fallback?, reason }` — Super Admin; audit-logged |
| GET | `/admins` | admins.write | `{ items }` (Super Admin) |
| POST | `/admins` | admins.write | `{ email, displayName, role }` → sends invite + TOTP enrolment |
| PATCH | `/admins/:id` | admins.write | `{ role?, isActive? }` — deactivation revokes sessions |
| GET | `/articles` | content.read | `{ items }` |
| POST | `/articles` | content.write | `{ title, excerpt, body, status }` — `published` pushes to legali-lea-web |
| PATCH | `/articles/:id` | content.write | `{ status?, title?, body?, excerpt? }` |
| DELETE | `/articles/:id` | content.write | — |
| GET | `/knowledge` | resources.read | `{ items }` |
| POST | `/knowledge` | resources.write | `{ title, content, tags }` — embed + index for RAG (set `status:"pending"` until indexed) |
| DELETE | `/knowledge/:id` | resources.write | remove from index |
| GET | `/subscriptions` | subscriptions.read | `{ items, plans, metrics }` |

## Still on mock/local (next to wire)
Feedback inbox (§3.5), audit log read (§3.10 — writes are already recorded by the store), platform analytics (§3.6), error-log viewer + feature flags (§3.9), feature-data browser (§3.8), stickers/avatars/master-data (§3.7), languages (§3.3 module/lesson/badge editing). Each has a matching `// TODO:` in its page; add the endpoint + swap the page's data source to `api.*` the same way.

## RBAC
Capabilities are enforced both client-side (`src/lib/rbac.ts`) and in each route handler via `requireAdmin(cap)`. The backend MUST enforce the same matrix — the client checks are defence-in-depth only (PRD §5).
