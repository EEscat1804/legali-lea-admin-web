"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { PageHeader, Card, Badge, Button, Input, ScaffoldNote, Table, Thead, Th, Tr, Td, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { FEEDBACK } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { FeedbackItem, FeedbackStatus, FeedbackType } from "@/lib/types";

const TYPE_TONE: Record<FeedbackType, "red" | "blue"> = {
  bug: "red",
  suggestion: "blue",
};

const STATUS_TONE: Record<FeedbackStatus, "amber" | "blue" | "green" | "neutral"> = {
  open: "amber",
  in_progress: "blue",
  resolved: "green",
  closed: "neutral",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const TYPE_FILTERS: FeedbackType[] = ["bug", "suggestion"];
const STATUS_FILTERS: FeedbackStatus[] = ["open", "in_progress", "resolved", "closed"];

// §3.5 Feedback & Support Inbox — triage queue for in-app bug reports and
// suggestions. Each row opens a detail panel where ops set status, assignee,
// internal notes, and link a GitHub issue. All writes are NO-OPs in the scaffold.
export default function FeedbackPage() {
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "feedback.write");

  const [typeFilter, setTypeFilter] = useState<FeedbackType | null>(null);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Local working copy so status/assignee/note edits persist in the session.
  const [items, setItems] = useState<FeedbackItem[]>(FEEDBACK);

  const openBugCount = useMemo(
    () => items.filter((f) => f.type === "bug" && f.status === "open").length,
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((f) => {
      if (typeFilter && f.type !== typeFilter) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      const created = f.createdAt.slice(0, 10);
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  }, [items, typeFilter, statusFilter, from, to]);

  const selected = items.find((f) => f.id === selectedId) ?? null;

  // Patch a single feedback item in local state (NO-OP server-side).
  const patch = (id: string, changes: Partial<FeedbackItem>) => {
    // TODO: PATCH /api/lea/admin/feedback/:id
    setItems((cur) => cur.map((f) => (f.id === id ? { ...f, ...changes } : f)));
  };

  return (
    <div>
      <PageHeader
        title="Feedback & Support"
        prd="§3.5"
        description="Triage queue for in-app bug reports and feature suggestions. Set status, assign owners, add internal notes, and link GitHub issues."
        actions={<Badge tone={openBugCount > 0 ? "red" : "neutral"}>{openBugCount} open bug{openBugCount === 1 ? "" : "s"}</Badge>}
      />
      <ScaffoldNote>
        Feedback is mocked. In production this reads GET /api/lea/admin/feedback and writes via PATCH /api/lea/admin/feedback/:id.
      </ScaffoldNote>

      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup label="Type">
            {TYPE_FILTERS.map((t) => (
              <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter((cur) => (cur === t ? null : t))}>
                {t}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            {STATUS_FILTERS.map((s) => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter((cur) => (cur === s ? null : s))}>
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </FilterGroup>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">From</span>
            <div className="w-36">
              <Input value={from} onChange={setFrom} type="date" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">To</span>
            <div className="w-36">
              <Input value={to} onChange={setTo} type="date" />
            </div>
          </div>
          {(typeFilter || statusFilter || from || to) && (
            <Button variant="ghost" onClick={() => { setTypeFilter(null); setStatusFilter(null); setFrom(""); setTo(""); }}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState>No feedback matches the current filters.</EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Type</Th>
              <Th>Submitted by</Th>
              <Th>Message</Th>
              <Th>Created</Th>
              <Th>Status</Th>
              <Th>Assignee</Th>
            </Tr>
          </Thead>
          <tbody>
            {filtered.map((f) => (
              <Tr key={f.id} onClick={() => setSelectedId(f.id)}>
                <Td>
                  <Badge tone={TYPE_TONE[f.type]}>{f.type}</Badge>
                </Td>
                <Td>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Link href={`/users/${f.userId}`} className="font-medium text-brand-700 hover:underline">
                      {f.userName}
                    </Link>
                  </span>
                </Td>
                <Td>
                  <span className="block max-w-md truncate text-slate-700">{f.message}</span>
                </Td>
                <Td>{fmtDateTime(f.createdAt)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                </Td>
                <Td>{f.assignee ?? <span className="text-slate-400">Unassigned</span>}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {selected && (
        <DetailPanel item={selected} canWrite={canWrite} onPatch={patch} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ── Side detail panel with triage controls ────────────────────────────────────
function DetailPanel({
  item,
  canWrite,
  onPatch,
  onClose,
}: {
  item: FeedbackItem;
  canWrite: boolean;
  onPatch: (id: string, changes: Partial<FeedbackItem>) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge tone={TYPE_TONE[item.type]}>{item.type}</Badge>
            <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mb-4 text-xs text-slate-500">
          From{" "}
          <Link href={`/users/${item.userId}`} className="font-medium text-brand-700 hover:underline">
            {item.userName}
          </Link>{" "}
          · {fmtDateTime(item.createdAt)}
        </div>

        <Section label="Message">
          <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{item.message}</p>
        </Section>

        <Section label="Screenshot">
          {item.screenshotUrl ? (
            <a href={item.screenshotUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline">
              {item.screenshotUrl}
            </a>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
              No screenshot attached
            </div>
          )}
        </Section>

        <Section label="Status">
          <select
            value={item.status}
            disabled={!canWrite}
            onChange={(e) => onPatch(item.id, { status: e.target.value as FeedbackStatus })}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Section>

        <Section label="Assignee">
          {canWrite ? (
            <Input value={item.assignee ?? ""} onChange={(v) => onPatch(item.id, { assignee: v || null })} placeholder="Assign an owner…" />
          ) : (
            <p className="text-sm text-slate-600">{item.assignee ?? "Unassigned"}</p>
          )}
        </Section>

        <Section label="Internal note (not visible to user)">
          {canWrite ? (
            <textarea
              value={item.internalNote ?? ""}
              onChange={(e) => onPatch(item.id, { internalNote: e.target.value || null })}
              placeholder="Triage notes, repro steps, decisions…"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-slate-600">{item.internalNote ?? "—"}</p>
          )}
        </Section>

        <Section label="GitHub issue URL">
          {canWrite ? (
            <Input value={item.githubUrl ?? ""} onChange={(v) => onPatch(item.id, { githubUrl: v || null })} placeholder="https://github.com/…/issues/123" />
          ) : (
            <p className="text-sm text-slate-600">{item.githubUrl ?? "—"}</p>
          )}
          {item.githubUrl && (
            <a href={item.githubUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-700 hover:underline">
              Open issue ↗
            </a>
          )}
        </Section>

        {!canWrite && (
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            You have read-only access to feedback. Triage actions require the feedback.write capability.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
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
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
