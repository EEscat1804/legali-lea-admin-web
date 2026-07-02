"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PageHeader, Card, StatCard, Badge, Button, Input, ScaffoldNote, Table, Thead, Th, Tr, Td, EmptyState } from "@/components/ui";
import { fmtDate, fmtMoney } from "@/lib/format";
import { paginate, search } from "@/lib/mock-data";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { AppUser, PricingPlan, SubscriptionRow, SubscriptionStatus } from "@/lib/types";

const PAGE_SIZE = 10;

const SUB_TONE: Record<SubscriptionStatus, "green" | "amber" | "red" | "neutral"> = {
  active: "green",
  cancelled: "amber",
  expired: "red",
  free: "neutral",
};

const PLAN_TONE: Record<PricingPlan["type"], "green" | "blue" | "neutral" | "amber"> = {
  free: "neutral",
  pro: "blue",
  other: "amber",
};

const STATUS_FILTERS: SubscriptionStatus[] = ["active", "cancelled", "expired", "free"];

// §3.4 Subscriptions & Billing — read-mostly visibility into Stripe state plus a
// thin manual-override surface. This is NOT a Stripe replacement; the source of
// truth is Stripe + lea-be-core webhooks. Plan create/edit is Super Admin only
// (subscriptions.write); Operators get read-only billing per the RBAC matrix.
export default function SubscriptionsPage() {
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "subscriptions.write");

  // Real admin API: subscription rows, pricing plans and aggregate metrics.
  const { data, loading, error, reload } = useApi(() => api.subscriptions.get(), []);
  const rows = useMemo<SubscriptionRow[]>(() => data?.items ?? [], [data]);
  const plans = useMemo<PricingPlan[]>(() => data?.plans ?? [], [data]);
  const metrics = data?.metrics;

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | null>(null);
  const [page, setPage] = useState(1);

  // Local modal state. Plan create/edit is still a NO-OP (no plan endpoint yet);
  // Grant Pro persists via the users endpoint.
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<PricingPlan | null>(null);
  const [grantProOpen, setGrantProOpen] = useState(false);

  // ── Subscriptions list (search + status filter + paginate) ──────────────────
  const filtered = useMemo(() => {
    let result = search(rows, q, ["userName", "plan"]);
    if (statusFilter) result = result.filter((s) => s.status === statusFilter);
    return result;
  }, [rows, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const { items, total } = paginate(filtered, safePage, PAGE_SIZE);

  // ── CSV export (real, client-side download via Blob) ────────────────────────
  const exportCsv = () => {
    const header = ["id", "userId", "userName", "plan", "status", "start", "expiry"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((s) =>
      [s.id, s.userId, s.userName, s.plan, s.status, s.start ?? "", s.expiry ?? ""].map((v) => escape(String(v))).join(","),
    );
    const csv = [header.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Subscriptions & Billing"
        prd="§3.4"
        description="Visibility into subscription state plus manual overrides — not a Stripe replacement. Stripe + webhooks remain the source of truth."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
            {canWrite && (
              <Button variant="secondary" onClick={() => setGrantProOpen(true)}>
                Grant Pro
              </Button>
            )}
            {canWrite && (
              <Button variant="primary" onClick={() => setNewPlanOpen(true)}>
                New plan
              </Button>
            )}
          </>
        }
      />
      <ScaffoldNote>
        Billing mirrors Stripe via GET /api/admin/subscriptions and webhook-synced state. Operators have read-only billing; plan config is Super Admin only.
      </ScaffoldNote>

      {error && (
        <Card className="mb-6 !p-4">
          <EmptyState>Failed to load subscriptions: {error}</EmptyState>
        </Card>
      )}

      {loading && !data ? (
        <Card className="!p-4">
          <EmptyState>Loading subscriptions…</EmptyState>
        </Card>
      ) : (
        <>
      {/* ── Metrics ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active subscribers" value={metrics?.activeSubscribers ?? 0} sub="updated daily" />
        <StatCard label="Free users" value={metrics?.free ?? 0} sub="updated daily" />
        <StatCard label="Cancelled" value={metrics?.cancelled ?? 0} sub="updated daily" />
        <StatCard label="Expired" value={metrics?.expired ?? 0} sub="updated daily" />
      </div>

      {/* ── Pricing plans ── */}
      <Card className="mb-6 !p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Pricing plans</h2>
          <span className="text-xs text-slate-400">Synced from Stripe products & prices</span>
        </div>
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Price</Th>
              <Th>Billing period</Th>
              <Th>Stripe product</Th>
              <Th>Stripe price</Th>
              <Th>{canWrite ? "Actions" : ""}</Th>
            </Tr>
          </Thead>
          <tbody>
            {plans.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <span className="font-medium text-slate-900">{p.name}</span>
                </Td>
                <Td>
                  <Badge tone={PLAN_TONE[p.type]}>{p.type}</Badge>
                </Td>
                <Td>{fmtMoney(p.price, p.currency)}</Td>
                <Td className="capitalize">{p.billingPeriod}</Td>
                <Td>
                  <span className="font-mono text-xs text-slate-500">{p.stripeProductId ?? "—"}</span>
                </Td>
                <Td>
                  <span className="font-mono text-xs text-slate-500">{p.stripePriceId ?? "—"}</span>
                </Td>
                <Td>
                  {canWrite && (
                    <Button variant="secondary" onClick={() => setEditPlan(p)}>
                      Edit
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ── Subscriptions list ── */}
      <Card className="!p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Subscriptions</h2>
        <div className="mb-3 max-w-sm">
          <Input value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by user or plan…" />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((s) => (
            <Chip key={s} active={statusFilter === s} onClick={() => { setStatusFilter((cur) => (cur === s ? null : s)); setPage(1); }}>
              {s}
            </Chip>
          ))}
          {statusFilter && (
            <Button variant="ghost" onClick={() => { setStatusFilter(null); setPage(1); }}>
              Clear
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState>No subscriptions match the current search and filters.</EmptyState>
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Start</Th>
                <Th>Expiry</Th>
              </Tr>
            </Thead>
            <tbody>
              {items.map((s: SubscriptionRow) => (
                <Tr key={s.id}>
                  <Td>
                    <span className="font-medium text-slate-900">{s.userName}</span>
                  </Td>
                  <Td>{s.plan}</Td>
                  <Td>
                    <Badge tone={SUB_TONE[s.status]}>{s.status}</Badge>
                  </Td>
                  <Td>{fmtDate(s.start)}</Td>
                  <Td>{fmtDate(s.expiry)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {items.length} of {total} subscription{total === 1 ? "" : "s"}
            {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <span className="text-xs">
              Page {safePage} of {totalPages}
            </span>
            <Button variant="secondary" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      </Card>
        </>
      )}

      {newPlanOpen && <PlanModal onClose={() => setNewPlanOpen(false)} />}
      {editPlan && <PlanModal plan={editPlan} onClose={() => setEditPlan(null)} />}
      {grantProOpen && <GrantProModal onClose={() => setGrantProOpen(false)} onGranted={reload} />}
    </div>
  );
}

// ── Plan create/edit modal (local state, write is NO-OP) ──────────────────────
function PlanModal({ plan, onClose }: { plan?: PricingPlan; onClose: () => void }) {
  const editing = !!plan;
  const [name, setName] = useState(plan?.name ?? "");
  const [type, setType] = useState<PricingPlan["type"]>(plan?.type ?? "pro");
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [currency, setCurrency] = useState(plan?.currency ?? "USD");
  const [billingPeriod, setBillingPeriod] = useState<PricingPlan["billingPeriod"]>(plan?.billingPeriod ?? "monthly");
  const [stripeProductId, setStripeProductId] = useState(plan?.stripeProductId ?? "");
  const [stripePriceId, setStripePriceId] = useState(plan?.stripePriceId ?? "");

  const save = () => {
    // TODO: POST /api/lea/admin/plans  (or PATCH /api/lea/admin/plans/:id when editing)
    // NO-OP in scaffold — changes apply to new checkouts only and cannot
    // retroactively modify existing active subscriptions.
    onClose();
  };

  return (
    <Modal title={editing ? `Edit plan — ${plan!.name}` : "New plan"} onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Name">
          <Input value={name} onChange={setName} placeholder="Pro Monthly" />
        </Labeled>
        <Labeled label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PricingPlan["type"])}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="other">other</option>
          </select>
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Price">
            <Input value={price} onChange={setPrice} type="number" placeholder="9.99" />
          </Labeled>
          <Labeled label="Currency">
            <Input value={currency} onChange={setCurrency} placeholder="USD" />
          </Labeled>
        </div>
        <Labeled label="Billing period">
          <select
            value={billingPeriod}
            onChange={(e) => setBillingPeriod(e.target.value as PricingPlan["billingPeriod"])}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
          </select>
        </Labeled>
        <Labeled label="Stripe product ID">
          <Input value={stripeProductId} onChange={setStripeProductId} placeholder="prod_…" />
        </Labeled>
        <Labeled label="Stripe price ID">
          <Input value={stripePriceId} onChange={setStripePriceId} placeholder="price_…" />
        </Labeled>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Changes apply to <span className="font-semibold">new checkouts only</span> and cannot retroactively modify existing active subscriptions.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save}>
          {editing ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Manual "Grant Pro" override modal ─────────────────────────────────────────
// Admin-issued override, separate from Stripe (cross-refs §3.1). Persists via the
// users endpoint (action: "grantPro") and reloads the subscriptions table.
function GrantProModal({ onClose, onGranted }: { onClose: () => void; onGranted: () => void }) {
  const { data: usersData, loading: usersLoading } = useApi(() => api.users.list(), []);
  const users: AppUser[] = usersData?.items ?? [];

  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canConfirm = userId.trim() !== "" && reason.trim() !== "" && !submitting;

  const grant = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api.users.patch(userId, { action: "grantPro", reason, expiry: expiry || undefined });
      onGranted();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to grant Pro");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Grant Pro access" onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="User">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={usersLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">{usersLoading ? "Loading users…" : "Select a user…"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.email}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Reason">
          <Input value={reason} onChange={setReason} placeholder="Why is this override being issued?" />
        </Labeled>
        <Labeled label="Expiry">
          <Input value={expiry} onChange={setExpiry} type="date" />
        </Labeled>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This creates an <span className="font-semibold">admin-issued override</span> separate from Stripe (see §3.1). It does not create or modify a Stripe subscription.
        </p>
        {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={grant} disabled={!canConfirm}>
          {submitting ? "Granting…" : "Grant Pro"}
        </Button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
