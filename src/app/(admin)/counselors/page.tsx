"use client";

// §3.2 Counselor Management — list, filter, inline profile, and write actions.
// List + writes go through the admin API (/api/admin/counselors); the page reloads
// from the server after each mutation so changes persist.

import { useMemo, useState } from "react";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  EmptyState,
  ScaffoldNote,
  Table,
  Thead,
  Th,
  Tr,
  Td,
} from "@/components/ui";
import { fmtDate, fmtMoney } from "@/lib/format";
import { COUNSELOR_TYPES, LANGUAGES } from "@/lib/mock-data";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { Counselor, Language } from "@/lib/types";

// Self-serve onboarding link the team can share so specialists apply themselves.
// TODO: backend mints real single-use tokens (/api/lea/counselor/invite-link).
const APPLICATION_LINK = "https://admin.legali.ai/apply/specialist?token=demo-self-serve";

type AvailabilityFilter = "all" | "available" | "unavailable";
type ActiveFilter = "all" | "active" | "inactive";

function typeLabel(typeKey: string): string {
  return COUNSELOR_TYPES.find((t) => t.key === typeKey)?.displayName ?? typeKey;
}

function langLabel(code: Language): string {
  return LANGUAGES.find((l) => l.code === code)?.displayName ?? code;
}

export default function CounselorsPage() {
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "counselors.write");

  // Search term drives the server query (q); the result feeds client-side filters.
  const [query, setQuery] = useState("");
  const { data, loading, error, reload } = useApi(
    () => api.counselors.list({ q: query || undefined }),
    [query],
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const filtered = useMemo(() => {
    let r = data?.items ?? [];
    if (typeFilter !== "all") r = r.filter((c) => c.typeKey === typeFilter);
    if (availability !== "all") r = r.filter((c) => c.isAvailable === (availability === "available"));
    if (activeFilter !== "all") r = r.filter((c) => c.isActive === (activeFilter === "active"));
    if (langFilter !== "all") r = r.filter((c) => c.languages.includes(langFilter as Language));
    return r;
  }, [data, typeFilter, availability, activeFilter, langFilter]);

  async function patch(id: string, changes: Partial<Counselor>) {
    await api.counselors.update(id, changes);
    reload();
  }

  async function copyApplicationLink() {
    // TODO: backend will mint real single-use tokens for self-serve applications.
    try {
      await navigator.clipboard.writeText(APPLICATION_LINK);
    } catch {
      // Clipboard may be unavailable; the link is still shareable manually.
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  }

  const editing = (data?.items ?? []).find((c) => c.id === editId) ?? null;

  return (
    <div>
      <PageHeader
        title="Counselors"
        prd="§3.2"
        description="Directory, availability, capacity, and connection requests."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={copyApplicationLink}>
              {linkCopied ? "Copied!" : "Copy application link"}
            </Button>
            <Button variant="primary" disabled={!canWrite} onClick={() => setInviteOpen(true)}>
              Add specialist
            </Button>
          </div>
        }
      />

      <ScaffoldNote>
        Counselor directory and write actions persist via the admin API (/api/admin/counselors). Connection
        request approvals are still mocked — wire to /api/lea/admin/counselor/*.
      </ScaffoldNote>

      {/* Filters */}
      <Card className="mb-4">
        <div className="mb-3 max-w-sm">
          <Input value={query} onChange={setQuery} placeholder="Search name or email…" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ key: "all", displayName: "All" }, ...COUNSELOR_TYPES.map((t) => ({ key: t.key, displayName: t.displayName }))]}
          />
          <FilterGroup
            label="Availability"
            value={availability}
            onChange={(v) => setAvailability(v as AvailabilityFilter)}
            options={[
              { key: "all", displayName: "All" },
              { key: "available", displayName: "Available" },
              { key: "unavailable", displayName: "Unavailable" },
            ]}
          />
          <FilterGroup
            label="Status"
            value={activeFilter}
            onChange={(v) => setActiveFilter(v as ActiveFilter)}
            options={[
              { key: "all", displayName: "All" },
              { key: "active", displayName: "Active" },
              { key: "inactive", displayName: "Inactive" },
            ]}
          />
          <FilterGroup
            label="Language"
            value={langFilter}
            onChange={setLangFilter}
            options={[{ key: "all", displayName: "All" }, ...LANGUAGES.map((l) => ({ key: l.code, displayName: l.displayName }))]}
          />
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <EmptyState>
          <div className="flex flex-col items-center gap-3">
            <p>No specialists here yet. Grow your network of trauma-informed specialists.</p>
            <Button variant="primary" disabled={!canWrite} onClick={() => setInviteOpen(true)}>
              Add specialist
            </Button>
          </div>
        </EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Availability</Th>
              <Th>Clients</Th>
              <Th>Languages</Th>
              <Th>Active</Th>
              <Th>Joined</Th>
            </Tr>
          </Thead>
          <tbody>
            {filtered.map((c) => (
              <CounselorRows
                key={c.id}
                counselor={c}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                canWrite={canWrite}
                onPatch={patch}
                onEdit={() => setEditId(c.id)}
              />
            ))}
          </tbody>
        </Table>
      )}

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onSaved={reload} />}
      {editing && (
        <EditModal counselor={editing} onClose={() => setEditId(null)} onSave={(ch) => patch(editing.id, ch)} />
      )}
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; displayName: string }[];
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`rounded-md px-2 py-1 font-medium ${value === o.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {o.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}

// Mock sub-lists for the expanded panel.
const MOCK_CLIENTS = [
  { id: "u_1001", name: "Maya Sari" },
  { id: "u_1004", name: "Priya Nair" },
];
const MOCK_REQUESTS = [
  { id: "req_1", name: "Alex Chen", note: "Requested 2 days ago" },
  { id: "req_2", name: "Sofia Ramirez", note: "Requested today" },
];

function CounselorRows({
  counselor: c,
  expanded,
  onToggle,
  canWrite,
  onPatch,
  onEdit,
}: {
  counselor: Counselor;
  expanded: boolean;
  onToggle: () => void;
  canWrite: boolean;
  onPatch: (id: string, changes: Partial<Counselor>) => void;
  onEdit: () => void;
}) {
  return (
    <>
      <Tr onClick={onToggle}>
        <Td>
          <div className="font-medium text-slate-900">{c.name}</div>
          <div className="text-xs text-slate-400">{c.email}</div>
        </Td>
        <Td>{typeLabel(c.typeKey)}</Td>
        <Td>
          <Badge tone={c.isAvailable ? "green" : "neutral"}>{c.isAvailable ? "Available" : "Unavailable"}</Badge>
        </Td>
        <Td>
          {c.activeClients}/{c.maxClients}
        </Td>
        <Td>
          <div className="flex flex-wrap gap-1">
            {c.languages.map((l) => (
              <Badge key={l} tone="blue">
                {l.toUpperCase()}
              </Badge>
            ))}
          </div>
        </Td>
        <Td>
          <Badge tone={c.isActive ? "green" : "red"}>{c.isActive ? "Active" : "Inactive"}</Badge>
        </Td>
        <Td>{fmtDate(c.joinDate)}</Td>
      </Tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={7} className="px-4 py-4">
            <ExpandedPanel counselor={c} canWrite={canWrite} onPatch={onPatch} onEdit={onEdit} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedPanel({
  counselor: c,
  canWrite,
  onPatch,
  onEdit,
}: {
  counselor: Counselor;
  canWrite: boolean;
  onPatch: (id: string, changes: Partial<Counselor>) => void;
  onEdit: () => void;
}) {
  const [maxInput, setMaxInput] = useState(String(c.maxClients));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Profile */}
      <Card className="lg:col-span-2">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Profile</h3>
        <p className="mb-3 text-sm text-slate-600">{c.bio}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Credentials" value={c.credentials} />
          <Field label="Response time" value={c.responseTime} />
          <Field label="Fee" value={c.fee == null ? "—" : c.fee === 0 ? "Free" : fmtMoney(c.fee)} />
          <Field label="Languages" value={c.languages.map(langLabel).join(", ")} />
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Specialisations</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {c.specialisations.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </dd>
          </div>
          <div className="col-span-2 flex gap-2">
            {c.proBono && <Badge tone="green">Pro bono</Badge>}
            {c.crisis && <Badge tone="red">Crisis support</Badge>}
          </div>
        </dl>

        {/* Write actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" disabled={!canWrite} onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="secondary"
            disabled={!canWrite}
            onClick={() => onPatch(c.id, { isAvailable: !c.isAvailable })}
          >
            Force set: {c.isAvailable ? "unavailable" : "available"}
          </Button>
          {c.isActive ? (
            <Button variant="danger" disabled={!canWrite} onClick={() => onPatch(c.id, { isActive: false })}>
              Deactivate
            </Button>
          ) : (
            <Button variant="primary" disabled={!canWrite} onClick={() => onPatch(c.id, { isActive: true })}>
              Reactivate
            </Button>
          )}
        </div>

        {/* Set max clients */}
        <div className="mt-3 flex items-end gap-2">
          <div className="w-28">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Max clients</p>
            <Input value={maxInput} onChange={setMaxInput} type="number" />
          </div>
          <Button
            variant="secondary"
            disabled={!canWrite}
            onClick={() => {
              const n = Number(maxInput);
              if (Number.isFinite(n) && n >= 0) onPatch(c.id, { maxClients: n });
            }}
          >
            Set max
          </Button>
        </div>
      </Card>

      {/* Clients + requests */}
      <div className="space-y-4">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Current clients ({c.activeClients})</h3>
          {MOCK_CLIENTS.length === 0 ? (
            <p className="text-xs text-slate-400">No active clients.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {MOCK_CLIENTS.map((cl) => (
                <li key={cl.id} className="flex items-center justify-between">
                  <span>{cl.name}</span>
                  <span className="text-xs text-slate-400">{cl.id}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Pending requests ({MOCK_REQUESTS.length})</h3>
          <ul className="space-y-2 text-sm">
            {MOCK_REQUESTS.map((req) => (
              <li key={req.id} className="rounded-lg border border-slate-100 p-2">
                <div className="font-medium text-slate-800">{req.name}</div>
                <div className="mb-2 text-xs text-slate-400">{req.note}</div>
                <div className="flex gap-2">
                  {/* TODO: POST /api/lea/admin/counselor/{id}/connection/{reqId}/approve */}
                  <Button variant="primary" disabled={!canWrite} onClick={() => {}}>
                    Approve
                  </Button>
                  {/* TODO: POST /api/lea/admin/counselor/{id}/connection/{reqId}/decline */}
                  <Button variant="ghost" disabled={!canWrite} onClick={() => {}}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value}</dd>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function InviteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [typeKey, setTypeKey] = useState(COUNSELOR_TYPES[0]?.key ?? "");
  const [languages, setLanguages] = useState("en");
  const [traumaInformed, setTraumaInformed] = useState(true);
  const [proBono, setProBono] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit() {
    const validCodes = new Set<string>(LANGUAGES.map((l) => l.code));
    const langs = languages
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => validCodes.has(s)) as Language[];
    const specialisations = traumaInformed ? ["Trauma-informed"] : [];
    setSaving(true);
    setSubmitError(null);
    try {
      await api.counselors.create({
        name: name.trim() || email.trim(),
        email: email.trim(),
        typeKey,
        languages: langs.length > 0 ? langs : ["en"],
        specialisations,
        proBono,
        crisis,
      });
      onSaved();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to add specialist");
      setSaving(false);
    }
  }

  return (
    <Modal title="Add specialist" onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Email">
          <Input value={email} onChange={setEmail} type="email" placeholder="specialist@example.com" />
        </Labeled>
        <Labeled label="Display name">
          <Input value={name} onChange={setName} placeholder="Full name" />
        </Labeled>
        <Labeled label="Counselor type">
          <select
            value={typeKey}
            onChange={(e) => setTypeKey(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {COUNSELOR_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.displayName}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Languages">
          <Input value={languages} onChange={setLanguages} placeholder="en, id, es" />
        </Labeled>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={traumaInformed}
              onChange={(e) => setTraumaInformed(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Trauma-informed
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={proBono}
              onChange={(e) => setProBono(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Pro bono
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={crisis}
              onChange={(e) => setCrisis(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Crisis support
          </label>
        </div>
      </div>
      {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={saving} onClick={submit}>
          {saving ? "Adding…" : "Add specialist"}
        </Button>
      </div>
    </Modal>
  );
}

function EditModal({
  counselor,
  onClose,
  onSave,
}: {
  counselor: Counselor;
  onClose: () => void;
  onSave: (changes: Partial<Counselor>) => Promise<void>;
}) {
  const [name, setName] = useState(counselor.name);
  const [credentials, setCredentials] = useState(counselor.credentials);
  const [responseTime, setResponseTime] = useState(counselor.responseTime);
  const [bio, setBio] = useState(counselor.bio);
  const [specialisations, setSpecialisations] = useState(counselor.specialisations.join(", "));
  const [fee, setFee] = useState(counselor.fee == null ? "" : String(counselor.fee));
  const [proBono, setProBono] = useState(counselor.proBono);
  const [crisis, setCrisis] = useState(counselor.crisis);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit() {
    const parsedFee = fee.trim() === "" ? null : Number(fee);
    setSaving(true);
    setSubmitError(null);
    try {
      await onSave({
        name,
        credentials,
        responseTime,
        bio,
        specialisations: specialisations
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        fee: parsedFee != null && Number.isFinite(parsedFee) ? parsedFee : null,
        proBono,
        crisis,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${counselor.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Display name">
          <Input value={name} onChange={setName} />
        </Labeled>
        <Labeled label="Credentials">
          <Input value={credentials} onChange={setCredentials} />
        </Labeled>
        <Labeled label="Response time">
          <Input value={responseTime} onChange={setResponseTime} />
        </Labeled>
        <Labeled label="Specialisations">
          <Input value={specialisations} onChange={setSpecialisations} placeholder="Anxiety, Trauma, Family" />
        </Labeled>
        <Labeled label="Fee">
          <Input value={fee} onChange={setFee} type="number" placeholder="Leave blank for none" />
        </Labeled>
        <Labeled label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Labeled>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={proBono}
              onChange={(e) => setProBono(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Pro bono
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={crisis}
              onChange={(e) => setCrisis(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Crisis support
          </label>
        </div>
      </div>
      {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}
