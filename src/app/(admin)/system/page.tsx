"use client";

// §3.9 System & Configuration — error logs, feature flags, AI model config,
// notification templates. Promotes the existing GET /api/lea/admin/logs endpoint
// and surfaces operational knobs. All writes are no-ops (local state + TODO) and
// audit-logged in production.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader, Card, Badge, Button, Input, ScaffoldNote, EmptyState, Table, Thead, Th, Tr, Td } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ERROR_LOGS, FEATURE_FLAGS } from "@/lib/mock-data";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { ErrorLogEntry, FeatureFlag } from "@/lib/types";

type Tab = "logs" | "flags" | "ai" | "templates";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "logs", label: "Error logs" },
  { key: "flags", label: "Feature flags" },
  { key: "ai", label: "AI model config" },
  { key: "templates", label: "Notification templates" },
];

export default function SystemPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("logs");

  const canSystemWrite = !!user && can(user.role, "system.write");

  return (
    <div>
      <PageHeader
        title="System & Configuration"
        prd="§3.9"
        description="Operational visibility and runtime configuration — error logs, feature flags, and AI model settings."
      />
      <ScaffoldNote>
        Error logs and flags are mocked (production reads GET /api/lea/admin/logs and the flags table). Every write is gated by
        <span className="font-medium"> system.write</span> and recorded in the audit log (§3.10).
      </ScaffoldNote>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {tab === "logs" && <ErrorLogsTab canWrite={canSystemWrite} />}
      {tab === "flags" && <FeatureFlagsTab canWrite={canSystemWrite} />}
      {tab === "ai" && <AiModelTab canWrite={canSystemWrite} isSuperAdmin={user?.role === "super_admin"} />}
      {tab === "templates" && <TemplatesTab />}
    </div>
  );
}

// ── Error logs ───────────────────────────────────────────────────────────────
const N_OPTIONS = [10, 25, 50, 100, 200];
const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "5xx", label: "5xx" },
  { key: "4xx", label: "4xx" },
  { key: "other", label: "Other" },
];
const WINDOW_FILTERS: Array<{ key: string; label: string; hours: number | null }> = [
  { key: "1h", label: "Last hour", hours: 1 },
  { key: "24h", label: "Last 24h", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "all", label: "All", hours: null },
];

function statusTone(status: number): "red" | "amber" | "neutral" {
  if (status >= 500) return "red";
  if (status >= 400) return "amber";
  return "neutral";
}

function statusBucket(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  return "other";
}

function ErrorLogsTab({ canWrite }: { canWrite: boolean }) {
  const [n, setN] = useState(50);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Local copy so "Clear buffer" can empty it without touching shared mock-data.
  const [logs, setLogs] = useState<ErrorLogEntry[]>(ERROR_LOGS);

  // Auto-refresh: in production this re-fetches GET /api/lea/admin/logs every 30s.
  // Here it is a clean no-op interval so the toggle reflects real behaviour.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      // TODO: re-fetch GET /api/lea/admin/logs?n=<n>
      console.log("[system] auto-refresh tick — would re-fetch error logs");
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    let rows = [...logs];
    if (statusFilter) rows = rows.filter((r) => statusBucket(r.status) === statusFilter);
    const win = WINDOW_FILTERS.find((w) => w.key === windowKey);
    if (win?.hours != null) {
      const cutoff = Date.now() - win.hours * 3_600_000;
      rows = rows.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    }
    return rows.slice(0, n);
  }, [logs, statusFilter, windowKey, n]);

  const clearBuffer = () => {
    // TODO: POST /api/lea/admin/logs/clear (system.write) — audit-logged.
    console.log("[system] clear error log buffer");
    setLogs([]);
    setConfirmClear(false);
  };

  return (
    <div>
      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup label="Show">
            {N_OPTIONS.map((opt) => (
              <Chip key={opt} active={n === opt} onClick={() => setN(opt)}>
                {opt}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            {STATUS_FILTERS.map((s) => (
              <Chip key={s.key} active={statusFilter === s.key} onClick={() => setStatusFilter((cur) => (cur === s.key ? null : s.key))}>
                {s.label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Window">
            {WINDOW_FILTERS.map((w) => (
              <Chip key={w.key} active={windowKey === w.key} onClick={() => setWindowKey(w.key)}>
                {w.label}
              </Chip>
            ))}
          </FilterGroup>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Auto-refresh (30s) {autoRefresh && <Badge tone="green">on</Badge>}
          </label>
          <div className="ml-auto">
            <Button variant="danger" disabled={!canWrite || logs.length === 0} onClick={() => setConfirmClear(true)}>
              Clear buffer
            </Button>
            {!canWrite && <p className="mt-1 text-right text-xs text-slate-400">Requires system.write</p>}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState>No error log entries match the current filters{logs.length === 0 ? " — buffer is empty." : "."}</EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Timestamp</Th>
              <Th>Status</Th>
              <Th>Method</Th>
              <Th>Path</Th>
              <Th>Message</Th>
            </Tr>
          </Thead>
          <tbody>
            {filtered.map((e) => (
              <Tr key={e.id}>
                <Td>{fmtDateTime(e.timestamp)}</Td>
                <Td>
                  <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                </Td>
                <Td>{e.method}</Td>
                <Td className="font-mono text-xs">{e.path}</Td>
                <Td>{e.message}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {confirmClear && (
        <Modal title="Clear error log buffer?" onClose={() => setConfirmClear(false)}>
          <p className="mb-4 text-sm text-slate-600">
            This clears the in-memory error log buffer. This action is recorded in the audit log. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button variant="danger" onClick={clearBuffer}>Clear buffer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Feature flags ──────────────────────────────────────────────────────────────
function FeatureFlagsTab({ canWrite }: { canWrite: boolean }) {
  // Local copy so toggles do not mutate shared mock-data.
  const [flags, setFlags] = useState<FeatureFlag[]>(FEATURE_FLAGS);

  const toggle = (key: string) => {
    // TODO: POST /api/lea/admin/flags/:key (system.write) — each change audit-logged.
    setFlags((cur) => cur.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)));
    console.log(`[system] toggle feature flag ${key}`);
  };

  return (
    <div>
      <Card className="mb-4 !p-4">
        <p className="text-sm text-slate-600">
          Toggling a flag takes effect at the next request. Each change is written to the audit log (§3.10).
        </p>
      </Card>
      <Table>
        <Thead>
          <Tr>
            <Th>Key</Th>
            <Th>Description</Th>
            <Th>Created</Th>
            <Th>Enabled</Th>
            <Th>Action</Th>
          </Tr>
        </Thead>
        <tbody>
          {flags.map((f) => (
            <Tr key={f.key}>
              <Td className="font-mono text-xs">{f.key}</Td>
              <Td>{f.description}</Td>
              <Td>{fmtDate(f.createdAt)}</Td>
              <Td>
                <Badge tone={f.enabled ? "green" : "neutral"}>{f.enabled ? "enabled" : "disabled"}</Badge>
              </Td>
              <Td>
                <Button variant="secondary" disabled={!canWrite} onClick={() => toggle(f.key)}>
                  {f.enabled ? "Disable" : "Enable"}
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {!canWrite && <p className="mt-2 text-xs text-slate-400">Toggling requires system.write.</p>}
    </div>
  );
}

// ── AI model config (relates to Issue #85 Gemini fallback) ──────────────────────
function AiModelTab({ canWrite, isSuperAdmin }: { canWrite: boolean; isSuperAdmin: boolean }) {
  // Live config from the admin API (GET /api/admin/model-config).
  const { data, loading, error, reload } = useApi(() => api.modelConfig.get(), []);

  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const candidates = data?.candidates ?? [];

  // Default the candidate picker to the current primary once data arrives.
  useEffect(() => {
    if (data) setSelected((cur) => (cur && candidates.includes(cur) ? cur : data.primary));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Override is Super Admin only in practice; gate by system.write too.
  const canOverride = canWrite && isSuperAdmin;
  const canSubmit = canOverride && !submitting && reason.trim().length > 0 && !!data && selected !== data.primary;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.modelConfig.override({ primary: selected, reason: reason.trim() });
      setReason("");
      reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to apply override");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card><p className="text-sm text-slate-500">Loading model configuration…</p></Card>;
  if (error) return <Card><EmptyState>Failed to load model configuration: {error}</EmptyState></Card>;
  if (!data) return <Card><EmptyState>No model configuration available.</EmptyState></Card>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Current configuration</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Primary model</dt>
            <dd className="font-mono text-xs text-slate-900">{data.primary}</dd>
          </div>
        </dl>
        <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Fallback chain</p>
        {data.fallback.length === 0 ? (
          <p className="text-sm text-slate-400">No fallback models configured.</p>
        ) : (
          <ol className="space-y-1">
            {data.fallback.map((m, i) => (
              <li key={m} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">{i + 1}</span>
                <span className="font-mono text-xs">{m}</span>
              </li>
            ))}
          </ol>
        )}
        {(data.updatedBy || data.updatedAt || data.reason) && (
          <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {data.updatedBy && (
              <div className="flex items-center justify-between gap-2">
                <dt>Last updated by</dt>
                <dd className="text-slate-700">{data.updatedBy}</dd>
              </div>
            )}
            {data.updatedAt && (
              <div className="flex items-center justify-between gap-2">
                <dt>Updated at</dt>
                <dd className="text-slate-700">{fmtDateTime(data.updatedAt)}</dd>
              </div>
            )}
            {data.reason && (
              <div className="flex items-start justify-between gap-2">
                <dt>Reason</dt>
                <dd className="text-right text-slate-700">{data.reason}</dd>
              </div>
            )}
          </dl>
        )}
        <p className="mt-4 text-xs text-slate-400">
          Gemini fallback (Issue #85) engages on primary-model error when ENABLE_GEMINI_FALLBACK is on.
        </p>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Override primary model</h3>
        <p className="mb-4 text-xs text-slate-500">Super Admin only. Overrides are audit-logged.</p>
        {!canOverride ? (
          <EmptyState>Overriding the primary model is Super Admin only (requires system.write).</EmptyState>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Candidate model</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {candidates.map((m) => (
                  <option key={m} value={m}>{m}{m === data.primary ? " (current)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Reason (required)</label>
              <Input value={reason} onChange={setReason} placeholder="Why is this override needed?" />
            </div>
            {submitError && <p className="text-xs text-red-600">{submitError}</p>}
            <Button variant="primary" disabled={!canSubmit} onClick={submit}>
              {submitting ? "Applying…" : "Apply override"}
            </Button>
            <p className="text-xs text-amber-700">
              Open question: the Cloudflare Worker caches the model config with a TTL, so an override may not hot-reload
              until the cache expires.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Notification templates (v2 placeholder) ─────────────────────────────────────
function TemplatesTab() {
  return (
    <Card>
      <EmptyState>
        Out of scope for v1 — nav slot reserved (PRD §3.9). Editable notification templates land in v2.
      </EmptyState>
    </Card>
  );
}

// ── Local helpers ────────────────────────────────────────────────────────────
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
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
