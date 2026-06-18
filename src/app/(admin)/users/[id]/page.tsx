"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, Card, StatCard, Badge, Button, Input, EmptyState } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { FEEDBACK } from "@/lib/mock-data";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { AppUser, SubscriptionStatus, FeedbackType, FeedbackStatus } from "@/lib/types";

const SUB_TONE: Record<SubscriptionStatus, "green" | "amber" | "red" | "neutral"> = {
  active: "green",
  cancelled: "amber",
  expired: "red",
  free: "neutral",
};

const STATUS_TONE: Record<AppUser["status"], "green" | "amber" | "red"> = {
  active: "green",
  suspended: "amber",
  deleted: "red",
};

const FEEDBACK_TONE: Record<FeedbackType, "red" | "blue"> = {
  bug: "red",
  suggestion: "blue",
};

const FEEDBACK_STATUS_TONE: Record<FeedbackStatus, "amber" | "blue" | "green" | "neutral"> = {
  open: "amber",
  in_progress: "blue",
  resolved: "green",
  closed: "neutral",
};

type ModalKind = "pro" | "suspend" | "delete" | null;

// §3.1 User detail — full survivor profile plus account/subscription lifecycle
// controls. Lifecycle actions persist via PATCH /api/admin/users/:id and reload
// the profile on success.
export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user: admin } = useAuth();

  const { data: user, loading, error, reload } = useApi(() => api.users.get(id), [id]);
  const [modal, setModal] = useState<ModalKind>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canWrite = admin ? can(admin.role, "users.write") : false;

  if (loading) {
    return (
      <div>
        <PageHeader title="User" prd="§3.1" />
        <EmptyState>Loading user…</EmptyState>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div>
        <PageHeader title="User not found" prd="§3.1" />
        <EmptyState>
          No user with id <code className="font-mono">{id}</code>.{" "}
          <Link href="/users" className="font-medium text-brand-600 hover:underline">
            Back to users
          </Link>
        </EmptyState>
      </div>
    );
  }

  const isPro = user.subscription.status === "active";
  const userFeedback = FEEDBACK.filter((f) => f.userId === user.id);

  // ── Lifecycle action handlers — persist via API, then reload ───────────────
  const runAction = async (fn: () => Promise<AppUser>) => {
    setActionError(null);
    try {
      await fn();
      reload();
      setModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const grantOrRevokePro = (reason: string, expiry: string) =>
    runAction(() =>
      isPro
        ? api.users.patch(id, { action: "revokePro" })
        : api.users.patch(id, { action: "grantPro", reason, expiry }),
    );

  const toggleSuspend = (reason: string) =>
    runAction(() =>
      user.status === "suspended"
        ? api.users.patch(id, { action: "unsuspend" })
        : api.users.patch(id, { action: "suspend", reason }),
    );

  const deleteUser = (reason: string) =>
    runAction(() => api.users.patch(id, { action: "delete", reason }));

  return (
    <div>
      <PageHeader
        title={user.name}
        prd="§3.1"
        description={user.email}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/users" className="text-sm font-medium text-slate-500 hover:text-slate-700">
              ← Back
            </Link>
            {canWrite && (
              <>
                <Button variant="secondary" onClick={() => setModal("pro")}>
                  {isPro ? "Revoke Pro" : "Grant Pro"}
                </Button>
                <Button variant="secondary" onClick={() => setModal("suspend")} disabled={user.status === "deleted"}>
                  {user.status === "suspended" ? "Unsuspend" : "Suspend"}
                </Button>
                <Button variant="danger" onClick={() => setModal("delete")} disabled={user.status === "deleted"}>
                  Delete / anonymise
                </Button>
              </>
            )}
          </div>
        }
      />

      {!canWrite && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Your role has read-only access to users. Lifecycle actions are hidden.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Profile</h2>
          <div className="flex items-start gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={`${user.name}'s avatar`}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Name" value={user.name} />
              <Field label="Email" value={user.email} />
              <Field label="Language" value={user.language.toUpperCase()} />
              <Field label="Lea personality" value={<span className="capitalize">{user.personality}</span>} />
              <Field label="Streak" value={`🔥 ${user.streak} days`} />
              <Field label="Level" value={user.level} />
              <Field label="Joined" value={fmtDate(user.joinDate)} />
              <Field label="Account status" value={<Badge tone={STATUS_TONE[user.status]}>{user.status}</Badge>} />
              <div className="col-span-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Interests</p>
                {user.interests.length ? (
                  <div className="flex flex-wrap gap-1">
                    {user.interests.map((i) => (
                      <Badge key={i} tone="neutral">
                        {i.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Subscription */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Subscription</h2>
          <div className="space-y-3 text-sm">
            <Field label="Plan" value={user.subscription.plan} />
            <Field label="Status" value={<Badge tone={SUB_TONE[user.subscription.status]}>{user.subscription.status}</Badge>} />
            <Field label="Billing period" value={user.subscription.billingPeriod ?? "—"} />
            <Field label="Start" value={fmtDate(user.subscription.start)} />
            <Field label="Expiry" value={fmtDate(user.subscription.expiry)} />
          </div>
          {user.subscription.adminOverride && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">Admin override active</p>
              <p className="mt-1">Reason: {user.subscription.adminOverride.reason}</p>
              <p>Expires: {fmtDate(user.subscription.adminOverride.expiry)}</p>
              <p>Granted by: {user.subscription.adminOverride.grantedBy}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Engagement */}
      <div className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Engagement</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Last login" value={fmtDate(user.engagement.lastLogin)} />
          <StatCard label="Chat sessions" value={user.engagement.chatSessions} />
          <StatCard label="Modules completed" value={user.engagement.modulesCompleted} />
          <StatCard label="Mood logs" value={user.engagement.moodLogs} />
        </div>
      </div>

      {/* Submitted feedback */}
      <div className="mt-4">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Submitted feedback</h2>
          {userFeedback.length === 0 ? (
            <EmptyState>This user hasn&apos;t submitted any feedback.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {userFeedback.map((f) => (
                <li key={f.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={FEEDBACK_TONE[f.type]}>{f.type}</Badge>
                    <Badge tone={FEEDBACK_STATUS_TONE[f.status]}>{f.status.replace(/_/g, " ")}</Badge>
                    <span className="ml-auto text-xs text-slate-400">{fmtDateTime(f.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700">{f.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal === "pro" && (
        <ProModal isPro={isPro} error={actionError} onCancel={() => { setModal(null); setActionError(null); }} onConfirm={grantOrRevokePro} />
      )}
      {modal === "suspend" && (
        <SuspendModal suspended={user.status === "suspended"} error={actionError} onCancel={() => { setModal(null); setActionError(null); }} onConfirm={toggleSuspend} />
      )}
      {modal === "delete" && (
        <DeleteModal userName={user.name} error={actionError} onCancel={() => { setModal(null); setActionError(null); }} onConfirm={deleteUser} />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-slate-800">{value}</div>
    </div>
  );
}

function Modal({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-base font-semibold text-slate-900">{title}</h3>
        <div className="space-y-3 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{children}</label>;
}

function ProModal({ isPro, error, onCancel, onConfirm }: { isPro: boolean; error: string | null; onCancel: () => void; onConfirm: (reason: string, expiry: string) => void }) {
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");
  return (
    <Modal
      title={isPro ? "Revoke Pro access" : "Grant Pro access"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={(!isPro && (!reason.trim() || !expiry))} onClick={() => onConfirm(reason.trim(), expiry)}>
            {isPro ? "Revoke" : "Grant"}
          </Button>
        </>
      }
    >
      <p>{isPro ? "Revoke the current Pro override and return this account to Free." : "Grant a complimentary Pro subscription override."}</p>
      {!isPro && (
        <>
          <div>
            <FieldLabel>Reason</FieldLabel>
            <Input value={reason} onChange={setReason} placeholder="e.g. Beta tester comp" />
          </div>
          <div>
            <FieldLabel>Expiry</FieldLabel>
            <Input value={expiry} onChange={setExpiry} type="date" />
          </div>
        </>
      )}
      <ModalError error={error} />
    </Modal>
  );
}

function SuspendModal({ suspended, error, onCancel, onConfirm }: { suspended: boolean; error: string | null; onCancel: () => void; onConfirm: (reason: string, duration: string) => void }) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  return (
    <Modal
      title={suspended ? "Unsuspend account" : "Suspend account"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!suspended && !reason.trim()} onClick={() => onConfirm(reason.trim(), duration.trim())}>
            {suspended ? "Unsuspend" : "Suspend"}
          </Button>
        </>
      }
    >
      <p>{suspended ? "Restore this account to active status." : "Suspended users cannot log in until restored."}</p>
      {!suspended && (
        <>
          <div>
            <FieldLabel>Reason</FieldLabel>
            <Input value={reason} onChange={setReason} placeholder="Reason for this action" />
          </div>
          <div>
            <FieldLabel>Duration (optional)</FieldLabel>
            <Input value={duration} onChange={setDuration} placeholder="e.g. 7 days, indefinite" />
          </div>
        </>
      )}
      <ModalError error={error} />
    </Modal>
  );
}

function DeleteModal({ userName, error, onCancel, onConfirm }: { userName: string; error: string | null; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Delete / anonymise account"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            Permanently delete
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        <p className="font-semibold">This is irreversible (GDPR right to erasure).</p>
        <p className="mt-1">All personal data for {userName} will be anonymised and cannot be recovered.</p>
      </div>
      <div>
        <FieldLabel>Reason (required)</FieldLabel>
        <Input value={reason} onChange={setReason} placeholder="Document why this account is being erased" />
      </div>
      <ModalError error={error} />
    </Modal>
  );
}

function ModalError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
  );
}
