"use client";

// §3.10 Admin Audit Log — read-only, append-only trace of every admin write.
// There are intentionally NO edit/delete controls here: entries are immutable and
// retained ≥1 year. Export builds a CSV from the in-memory rows; replace AUDIT with
// GET /api/lea/admin/audit (filtered, paginated) when the backend ships.

import { useMemo, useState } from "react";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  ScaffoldNote,
  EmptyState,
  Table,
  Thead,
  Th,
  Tr,
  Td,
} from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { AUDIT, paginate } from "@/lib/mock-data";
import type { AuditEntry, AuditAction } from "@/lib/types";

const ACTION_TONE: Record<AuditAction, "green" | "blue" | "red" | "amber" | "neutral"> = {
  create: "green",
  update: "blue",
  delete: "red",
  override: "amber",
  login: "neutral",
};

const ACTIONS: AuditAction[] = ["create", "update", "delete", "login", "override"];
const PAGE_SIZE = 25;

function toCsv(rows: AuditEntry[]): string {
  const header = ["id", "timestamp", "actor", "action", "entityType", "entityId", "reason", "diff"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.id,
      r.timestamp,
      r.actor,
      r.action,
      r.entityType,
      r.entityId,
      r.reason ?? "",
      r.diff ? JSON.stringify(r.diff) : "",
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function AuditPage() {
  const [actor, setActor] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actors = useMemo(() => Array.from(new Set(AUDIT.map((a) => a.actor))).sort(), []);

  const filtered = useMemo(() => {
    return AUDIT.filter((e) => {
      if (actor && e.actor !== actor) return false;
      if (actionFilter && e.action !== actionFilter) return false;
      const ts = new Date(e.timestamp).getTime();
      if (from && ts < new Date(from).getTime()) return false;
      // include the whole "to" day by treating it as end-of-day
      if (to && ts > new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [actor, actionFilter, from, to]);

  const pageData = paginate(filtered, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(pageData.total / PAGE_SIZE));

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setActor("");
    setActionFilter(null);
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        prd="§3.10"
        description="Every admin write is traced here. The log is append-only and immutable — entries cannot be edited or deleted, and are retained for ≥1 year."
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <ScaffoldNote>
        Audit data is mocked. This view is read-only and append-only — there are no edit or delete controls. Export builds
        a CSV from the currently filtered rows; wire to GET /api/lea/admin/audit when the backend ships.
      </ScaffoldNote>

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Actor</p>
            <select
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All actors</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">From</p>
            <Input
              value={from}
              onChange={(v) => {
                setFrom(v);
                setPage(1);
              }}
              type="date"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">To</p>
            <Input
              value={to}
              onChange={(v) => {
                setTo(v);
                setPage(1);
              }}
              type="date"
            />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Action</span>
          {ACTIONS.map((act) => (
            <button
              key={act}
              onClick={() => {
                setActionFilter((cur) => (cur === act ? null : act));
                setPage(1);
              }}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                actionFilter === act
                  ? "ring-2 ring-brand-500 ring-offset-1"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Badge tone={ACTION_TONE[act]}>{act}</Badge>
            </button>
          ))}
        </div>
      </Card>

      {pageData.items.length === 0 ? (
        <EmptyState>No audit entries match the current filters.</EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Timestamp</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Reason</Th>
            </Tr>
          </Thead>
          <tbody>
            {pageData.items.map((e) => (
              <AuditRow
                key={e.id}
                entry={e}
                expanded={expandedId === e.id}
                onToggle={() => setExpandedId((cur) => (cur === e.id ? null : e.id))}
              />
            ))}
          </tbody>
        </Table>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {pageData.total} entr{pageData.total === 1 ? "y" : "ies"} · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function AuditRow({ entry, expanded, onToggle }: { entry: AuditEntry; expanded: boolean; onToggle: () => void }) {
  const diffFields = entry.diff ? Object.entries(entry.diff) : [];
  return (
    <>
      <Tr onClick={onToggle}>
        <Td>{fmtDateTime(entry.timestamp)}</Td>
        <Td>{entry.actor}</Td>
        <Td>
          <Badge tone={ACTION_TONE[entry.action]}>{entry.action}</Badge>
        </Td>
        <Td>
          <div className="text-slate-700">{entry.entityType}</div>
          <div className="font-mono text-xs text-slate-400">{entry.entityId}</div>
        </Td>
        <Td>{entry.reason ?? "—"}</Td>
      </Tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={5} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Change detail</p>
            {diffFields.length === 0 ? (
              <p className="text-sm text-slate-500">—</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Before</th>
                      <th className="px-3 py-2 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffFields.map(([field, change]) => (
                      <tr key={field} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">{field}</td>
                        <td className="px-3 py-2 font-mono text-xs text-rose-700">{fmtValue(change.before)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-emerald-700">{fmtValue(change.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function fmtValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
