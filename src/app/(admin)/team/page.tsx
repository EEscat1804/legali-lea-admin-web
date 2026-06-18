"use client";

import { useState } from "react";
import { PageHeader, Card, Badge, Button, Input, Table, Thead, Th, Tr, Td, EmptyState, ScaffoldNote } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { api, useApi } from "@/lib/api";
import { ROLES } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import type { AdminRole } from "@/lib/types";

// Team — admin account management (PRD §2 "Role assignment is done by Super
// Admin only" + §4.2 admin_users table). Super Admin only. Adding a teammate
// here is the "connect with Apple" flow: invite by email, pick a role.
const ROLE_TONE: Record<AdminRole, "blue" | "green" | "amber" | "neutral"> = {
  super_admin: "blue",
  operator: "green",
  content_editor: "amber",
  viewer: "neutral",
};

export default function TeamPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const { data, loading, error, reload } = useApi(() => api.admins.list(), []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // Deep-link guard: the nav already hides this for non–Super-Admins, but
  // protect the route too. The backend enforces this as the real gate.
  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Team" prd="§2" />
        <EmptyState>Only a Super Admin can manage admin accounts.</EmptyState>
      </div>
    );
  }

  const rows = data?.items ?? [];

  const toggleActive = async (id: string, isActive: boolean) => {
    setRowError(null);
    try {
      await api.admins.update(id, { isActive });
      reload();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to update account");
    }
  };

  const setRole = async (id: string, role: AdminRole) => {
    setRowError(null);
    try {
      await api.admins.update(id, { role });
      reload();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  return (
    <div>
      <PageHeader
        title="Team"
        prd="§2"
        description="Manage who can sign into the admin panel. Super Admin only — every change is audit-logged and 2FA is required for all accounts."
        actions={<Button onClick={() => setInviteOpen(true)}>Add teammate</Button>}
      />
      <ScaffoldNote>Admin accounts live in the <code>admin_users</code> table (§4.2); invites send an email + TOTP enrolment.</ScaffoldNote>

      {rowError && <p className="mb-3 text-sm text-red-600">{rowError}</p>}

      {loading ? (
        <Card><p className="text-sm text-slate-500">Loading admin accounts…</p></Card>
      ) : error ? (
        <EmptyState>Failed to load admin accounts: {error}</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>No admin accounts yet.</EmptyState>
      ) : (
      <Table>
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>2FA</Th>
            <Th>Last login</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <tbody>
          {rows.map((a) => (
            <Tr key={a.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {a.displayName.charAt(0)}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900">{a.displayName}</div>
                    <div className="text-xs text-slate-500">{a.email}</div>
                  </div>
                </div>
              </Td>
              <Td>
                <select
                  value={a.role}
                  onChange={(e) => setRole(a.id, e.target.value as AdminRole)}
                  disabled={a.id === user?.id}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                >
                  {(Object.keys(ROLES) as AdminRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r].label}
                    </option>
                  ))}
                </select>
              </Td>
              <Td>{a.totpEnabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="amber">Pending</Badge>}</Td>
              <Td>{fmtDateTime(a.lastLogin)}</Td>
              <Td>{a.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</Td>
              <Td>
                {a.id === user?.id ? (
                  <span className="text-xs text-slate-400">You</span>
                ) : (
                  <Button variant={a.isActive ? "secondary" : "primary"} onClick={() => toggleActive(a.id, !a.isActive)}>
                    {a.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      )}

      {inviteOpen && <InviteAdminModal onClose={() => setInviteOpen(false)} onCreated={reload} />}
    </div>
  );
}

function InviteAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // POST /api/admin/admins — sends invite email + TOTP enrolment, audit-logged.
      await api.admins.create({
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        role,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add teammate");
      setSubmitting(false);
    }
  };

  const valid = /\S+@\S+\.\S+/.test(email) && displayName.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-base font-semibold text-slate-900">Add teammate</h2>
        <p className="mb-4 text-xs text-slate-500">They&apos;ll get an email invite and set up 2FA (TOTP) on first sign-in.</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <Input value={email} onChange={setEmail} placeholder="name@legali.ai" type="email" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Display name</label>
            <Input value={displayName} onChange={setDisplayName} placeholder="Full name" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {(Object.keys(ROLES) as AdminRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].label} — {ROLES[r].description}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
