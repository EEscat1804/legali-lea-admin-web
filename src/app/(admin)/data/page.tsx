"use client";

// §3.8 Feature Data Management — read/manage every feature's DB records so
// support/debugging needs no raw DB access. Most sub-features are per-user, so a
// user scope selector drives all per-user tabs; the Connections tab is global.
//
// NOTE: shared mock-data has no feature-data fixtures, so every row below is a
// LOCAL MOCK defined in this file (clearly commented). All destructive ops are
// gated by "data.write" (Super Admin only in practice) and require a typed reason;
// on confirm they update local state, console.log, and carry a TODO for the real
// DELETE /api/lea/admin/* call. Overrides write an audit-log entry.

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { PageHeader, Card, Badge, Button, Input, ScaffoldNote, EmptyState, Table, Thead, Th, Tr, Td } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { USERS, COUNSELORS, search } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { AppUser } from "@/lib/types";

// ── Local mock fixtures (no shared mock-data exists for these features) ─────────
interface VaultEntry { id: string; title: string; createdAt: string; updatedAt: string; encrypted: boolean }
interface ChatMessage { role: "user" | "assistant"; timestamp: string; content: string }
interface ChatSession { id: string; startedAt: string; messageCount: number; lastActive: string; messages: ChatMessage[] }
interface JournalEntry { id: string; title: string; createdAt: string; wordCount: number; content: string }
interface MoodLog { id: string; date: string; bucket: "great" | "ok" | "low" | "crisis"; note: string }
interface SafetyPlan { id: string; createdAt: string; updatedAt: string; content: string }
interface ScrapbookItem { id: string; type: "photo" | "note" | "audio"; createdAt: string }
interface NotifPref { channel: string; optedIn: boolean }
interface ConnectionRequest { id: string; userId: string; userName: string; counselorId: string; counselorName: string; status: "pending" | "accepted" | "declined"; createdAt: string }

const MOCK_VAULT: VaultEntry[] = [
  { id: "v_1", title: "ID document scan", createdAt: "2026-05-01T09:00:00Z", updatedAt: "2026-05-01T09:00:00Z", encrypted: true },
  { id: "v_2", title: "Incident notes", createdAt: "2026-05-12T14:20:00Z", updatedAt: "2026-06-01T11:00:00Z", encrypted: true },
  { id: "v_3", title: "Lawyer contact", createdAt: "2026-06-10T08:30:00Z", updatedAt: "2026-06-10T08:30:00Z", encrypted: true },
];

const MOCK_SESSIONS: ChatSession[] = [
  {
    id: "s_a1", startedAt: "2026-06-16T18:00:00Z", messageCount: 4, lastActive: "2026-06-16T18:12:00Z",
    messages: [
      { role: "user", timestamp: "2026-06-16T18:00:00Z", content: "I had a hard day." },
      { role: "assistant", timestamp: "2026-06-16T18:00:30Z", content: "I'm here with you. Want to tell me what happened?" },
      { role: "user", timestamp: "2026-06-16T18:05:00Z", content: "An argument at home." },
      { role: "assistant", timestamp: "2026-06-16T18:05:40Z", content: "That sounds stressful. Are you safe right now?" },
    ],
  },
  {
    id: "s_a2", startedAt: "2026-06-10T09:00:00Z", messageCount: 2, lastActive: "2026-06-10T09:03:00Z",
    messages: [
      { role: "user", timestamp: "2026-06-10T09:00:00Z", content: "How do I set a boundary?" },
      { role: "assistant", timestamp: "2026-06-10T09:00:25Z", content: "Let's start with what feels okay and not okay for you." },
    ],
  },
];

const MOCK_JOURNAL: JournalEntry[] = [
  { id: "j_1", title: "Small wins", createdAt: "2026-06-14T20:00:00Z", wordCount: 132, content: "Today I managed to call the helpline. It felt huge." },
  { id: "j_2", title: "Reflection", createdAt: "2026-06-08T07:30:00Z", wordCount: 88, content: "I keep replaying the conversation. Trying to let it go." },
];

const MOCK_MOOD: MoodLog[] = [
  { id: "md_1", date: "2026-06-16", bucket: "low", note: "Tired and anxious." },
  { id: "md_2", date: "2026-06-15", bucket: "ok", note: "Better after a walk." },
  { id: "md_3", date: "2026-06-14", bucket: "great", note: "Good therapy session." },
];

const MOCK_SAFETY: SafetyPlan[] = [
  { id: "sp_1", createdAt: "2026-04-01T10:00:00Z", updatedAt: "2026-06-02T16:00:00Z", content: "Warning signs: raised voices. Safe places: sister's house. Contacts: 112, helpline." },
];

const MOCK_SCRAPBOOK: ScrapbookItem[] = [
  { id: "sk_1", type: "photo", createdAt: "2026-06-12T12:00:00Z" },
  { id: "sk_2", type: "note", createdAt: "2026-06-05T09:00:00Z" },
  { id: "sk_3", type: "audio", createdAt: "2026-05-28T19:00:00Z" },
];

const MOCK_NOTIF_PREFS: NotifPref[] = [
  { channel: "Push", optedIn: true },
  { channel: "Email", optedIn: false },
  { channel: "Daily check-in", optedIn: true },
  { channel: "Counselor messages", optedIn: true },
];

const MOCK_CONNECTIONS: ConnectionRequest[] = [
  { id: "cn_1", userId: "u_1001", userName: "Maya Sari", counselorId: "c_01", counselorName: "Dr. Lena Fischer", status: "accepted", createdAt: "2026-05-20T10:00:00Z" },
  { id: "cn_2", userId: "u_1002", userName: "Alex Chen", counselorId: "c_02", counselorName: "Marcus Webb", status: "pending", createdAt: "2026-06-14T08:00:00Z" },
  { id: "cn_3", userId: "u_1004", userName: "Priya Nair", counselorId: "c_02", counselorName: "Marcus Webb", status: "declined", createdAt: "2026-06-01T15:00:00Z" },
];

// ── Tabs ───────────────────────────────────────────────────────────────────────
type Tab = "vault" | "chat" | "journal" | "mood" | "safety" | "scrapbook" | "starter" | "notif" | "connections";
const PER_USER_TABS: Array<{ key: Tab; label: string }> = [
  { key: "vault", label: "Vault" },
  { key: "chat", label: "Lea chat" },
  { key: "journal", label: "Journal" },
  { key: "mood", label: "Mood logs" },
  { key: "safety", label: "Safety plans" },
  { key: "scrapbook", label: "Scrapbook" },
  { key: "starter", label: "Starter path" },
  { key: "notif", label: "Notifications" },
];

const STATUS_TONE: Record<ConnectionRequest["status"], "amber" | "green" | "red"> = {
  pending: "amber",
  accepted: "green",
  declined: "red",
};
const MOOD_TONE: Record<MoodLog["bucket"], "green" | "neutral" | "amber" | "red"> = {
  great: "green",
  ok: "neutral",
  low: "amber",
  crisis: "red",
};

// A confirm payload: which entity to delete and a human label.
interface ConfirmState { kind: string; id: string; label: string }

export default function DataPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("vault");
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const canDestroy = !!user && can(user.role, "data.write"); // Super Admin only in practice

  const selectedUser = useMemo<AppUser | undefined>(() => USERS.find((u) => u.id === selectedUserId), [selectedUserId]);
  const userMatches = useMemo(() => search(USERS, userQuery, ["name", "email"]), [userQuery]);

  const needsUser = tab !== "connections";

  return (
    <div>
      <PageHeader
        title="Feature Data"
        prd="§3.8"
        description="Read and manage every feature's DB records so support and debugging need no raw database access."
      />
      <ScaffoldNote>
        All rows on this page are mocked locally (no backend fixtures yet). Destructive operations are Super-Admin-gated
        (<span className="font-medium">data.write</span>), require a typed reason, and are written to the audit log (§3.10).
      </ScaffoldNote>

      {/* User scope selector */}
      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">User scope</label>
            <Input value={userQuery} onChange={setUserQuery} placeholder="Search a user by name or email…" />
            {userQuery && (
              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200">
                {userMatches.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">No users match.</p>
                ) : (
                  userMatches.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedUserId(u.id); setUserQuery(""); }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{u.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{u.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="text-sm">
            {selectedUser ? (
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium text-slate-900">{selectedUser.name}</div>
                  <div className="text-xs text-slate-500">{selectedUser.email}</div>
                </div>
                <Link href={`/users/${selectedUser.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                  View profile →
                </Link>
                <Button variant="ghost" onClick={() => setSelectedUserId(null)}>Clear</Button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">No user selected (Connections tab works globally).</span>
            )}
          </div>
        </div>
      </Card>

      {/* Tab switcher */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {PER_USER_TABS.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</TabButton>
        ))}
        <TabButton active={tab === "connections"} onClick={() => setTab("connections")}>
          Connections <span className="ml-1 text-[10px] text-slate-400">(global)</span>
        </TabButton>
      </div>

      {needsUser && !selectedUser ? (
        <EmptyState>Pick a user above to inspect their feature data. The Connections tab is global and works without a selection.</EmptyState>
      ) : (
        <>
          {tab === "vault" && <VaultTab canDestroy={canDestroy} />}
          {tab === "chat" && <ChatTab canDestroy={canDestroy} />}
          {tab === "journal" && <JournalTab canDestroy={canDestroy} />}
          {tab === "mood" && <MoodTab canDestroy={canDestroy} />}
          {tab === "safety" && <SafetyTab canDestroy={canDestroy} />}
          {tab === "scrapbook" && <ScrapbookTab canDestroy={canDestroy} />}
          {tab === "starter" && <StarterTab />}
          {tab === "notif" && <NotifTab canDestroy={canDestroy} />}
        </>
      )}
      {tab === "connections" && <ConnectionsTab canDestroy={canDestroy} />}
    </div>
  );
}

// ── Vault ────────────────────────────────────────────────────────────────────
function VaultTab({ canDestroy }: { canDestroy: boolean }) {
  const [rows, setRows] = useState<VaultEntry[]>(MOCK_VAULT);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const doDelete = (id: string) => {
    // TODO: DELETE /api/lea/admin/vault/:id
    console.log(`[data] delete vault entry ${id}`);
    setRows((cur) => cur.filter((r) => r.id !== id));
  };

  return (
    <div>
      <SectionNote>Content is E2E encrypted; only metadata is visible here.</SectionNote>
      <Table>
        <Thead>
          <Tr><Th>Title</Th><Th>Created</Th><Th>Updated</Th><Th>Encrypted</Th><Th>Action</Th></Tr>
        </Thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-medium text-slate-900">{r.title}</Td>
              <Td>{fmtDate(r.createdAt)}</Td>
              <Td>{fmtDate(r.updatedAt)}</Td>
              <Td><Badge tone={r.encrypted ? "green" : "neutral"}>{r.encrypted ? "encrypted" : "plain"}</Badge></Td>
              <Td><DestroyButton canDestroy={canDestroy} onClick={() => setConfirm({ kind: "vault entry", id: r.id, label: r.title })} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ReasonModal confirm={confirm} onClose={() => setConfirm(null)} onConfirm={(id) => { doDelete(id); setConfirm(null); }} />
    </div>
  );
}

// ── Lea chat sessions ───────────────────────────────────────────────────────────
function ChatTab({ canDestroy }: { canDestroy: boolean }) {
  const [rows, setRows] = useState<ChatSession[]>(MOCK_SESSIONS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const doDelete = (id: string) => {
    // TODO: DELETE /api/lea/admin/chat-sessions/:id
    console.log(`[data] delete chat session ${id}`);
    setRows((cur) => cur.filter((r) => r.id !== id));
  };

  return (
    <div>
      <SectionNote>Click a row to expand the message history (mock).</SectionNote>
      <Table>
        <Thead>
          <Tr><Th>Session</Th><Th>Started</Th><Th>Messages</Th><Th>Last active</Th><Th>Action</Th></Tr>
        </Thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <Tr onClick={() => setExpanded((cur) => (cur === r.id ? null : r.id))}>
                <Td className="font-mono text-xs">{r.id}</Td>
                <Td>{fmtDateTime(r.startedAt)}</Td>
                <Td>{r.messageCount}</Td>
                <Td>{fmtDateTime(r.lastActive)}</Td>
                <Td><DestroyButton canDestroy={canDestroy} onClick={() => setConfirm({ kind: "chat session", id: r.id, label: r.id })} /></Td>
              </Tr>
              {expanded === r.id && (
                <tr className="border-b border-slate-100">
                  <td colSpan={5} className="bg-slate-50 px-4 py-3">
                    <div className="space-y-2">
                      {r.messages.map((m, i) => (
                        <div key={i} className="text-sm">
                          <span className="mr-2 inline-flex"><Badge tone={m.role === "assistant" ? "blue" : "neutral"}>{m.role}</Badge></span>
                          <span className="text-slate-700">{m.content}</span>
                          <span className="ml-2 text-xs text-slate-400">{fmtDateTime(m.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </Table>
      <ReasonModal confirm={confirm} onClose={() => setConfirm(null)} onConfirm={(id) => { doDelete(id); setConfirm(null); }} />
    </div>
  );
}

// ── Journal ──────────────────────────────────────────────────────────────────
function JournalTab({ canDestroy }: { canDestroy: boolean }) {
  const [rows, setRows] = useState<JournalEntry[]>(MOCK_JOURNAL);
  const [viewing, setViewing] = useState<JournalEntry | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const doDelete = (id: string) => {
    // TODO: DELETE /api/lea/admin/journal/:id
    console.log(`[data] delete journal entry ${id}`);
    setRows((cur) => cur.filter((r) => r.id !== id));
  };

  return (
    <div>
      <Table>
        <Thead>
          <Tr><Th>Title</Th><Th>Created</Th><Th>Words</Th><Th>Action</Th></Tr>
        </Thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-medium text-slate-900">{r.title}</Td>
              <Td>{fmtDateTime(r.createdAt)}</Td>
              <Td>{r.wordCount}</Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setViewing(r)}>View</Button>
                  <DestroyButton canDestroy={canDestroy} onClick={() => setConfirm({ kind: "journal entry", id: r.id, label: r.title })} />
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)}>
          <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{viewing.content}</p>
          <div className="flex justify-end"><Button variant="secondary" onClick={() => setViewing(null)}>Close</Button></div>
        </Modal>
      )}
      <ReasonModal confirm={confirm} onClose={() => setConfirm(null)} onConfirm={(id) => { doDelete(id); setConfirm(null); }} />
    </div>
  );
}

// ── Mood logs ─────────────────────────────────────────────────────────────────
function MoodTab({ canDestroy }: { canDestroy: boolean }) {
  const [rows, setRows] = useState<MoodLog[]>(MOCK_MOOD);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const doDelete = (id: string) => {
    // TODO: DELETE /api/lea/admin/mood-logs/:id
    console.log(`[data] delete mood log ${id}`);
    setRows((cur) => cur.filter((r) => r.id !== id));
  };

  return (
    <div>
      <Table>
        <Thead>
          <Tr><Th>Date</Th><Th>Mood</Th><Th>Note</Th><Th>Action</Th></Tr>
        </Thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td>{fmtDate(r.date)}</Td>
              <Td><Badge tone={MOOD_TONE[r.bucket]}>{r.bucket}</Badge></Td>
              <Td>{r.note}</Td>
              <Td><DestroyButton canDestroy={canDestroy} onClick={() => setConfirm({ kind: "mood log", id: r.id, label: `${r.date} (${r.bucket})` })} /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <ReasonModal confirm={confirm} onClose={() => setConfirm(null)} onConfirm={(id) => { doDelete(id); setConfirm(null); }} />
    </div>
  );
}

// ── Safety plans ────────────────────────────────────────────────────────────────
function SafetyTab({ canDestroy }: { canDestroy: boolean }) {
  const [rows, setRows] = useState<SafetyPlan[]>(MOCK_SAFETY);
  const [viewing, setViewing] = useState<SafetyPlan | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const doDelete = (id: string) => {
    // TODO: DELETE /api/lea/admin/safety-plans/:id
    console.log(`[data] delete safety plan ${id}`);
    setRows((cur) => cur.filter((r) => r.id !== id));
  };

  return (
    <div>
      <Table>
        <Thead>
          <Tr><Th>Plan</Th><Th>Created</Th><Th>Last updated</Th><Th>Action</Th></Tr>
        </Thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="font-mono text-xs">{r.id}</Td>
              <Td>{fmtDate(r.createdAt)}</Td>
              <Td>{fmtDate(r.updatedAt)}</Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setViewing(r)}>View</Button>
                  <DestroyButton canDestroy={canDestroy} onClick={() => setConfirm({ kind: "safety plan", id: r.id, label: r.id })} />
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {viewing && (
        <Modal title="Safety plan" onClose={() => setViewing(null)}>
          <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{viewing.content}</p>
          <div className="flex justify-end"><Button variant="secondary" onClick={() => setViewing(null)}>Close</Button></div>
        </Modal>
      )}
      <ReasonModal confirm={confirm} onClose={() => setConfirm(null)} onConfirm={(id) => { doDelete(id); setConfirm(null); }} />
    </div>
  );
}

// ── Scrapbook ─────────────────────────────────────────────────────────────────
function ScrapbookTab({ canDestroy }: { canDestroy: boolean }) {
  const [rows, setRows] = useState<ScrapbookItem[]>(MOCK_SCRAPBOOK);
  const [viewing, setViewing] = useState<ScrapbookItem | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const doDelete = (id: string) => {
    // TODO: DELETE /api/lea/admin/scrapbook/:id
    console.log(`[data] delete scrapbook item ${id}`);
    setRows((cur) => cur.filter((r) => r.id !== id));
  };

  return (
    <div>
      <Table>
        <Thead>
          <Tr><Th>Type</Th><Th>Created</Th><Th>Thumbnail</Th><Th>Action</Th></Tr>
        </Thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td><Badge tone="neutral">{r.type}</Badge></Td>
              <Td>{fmtDateTime(r.createdAt)}</Td>
              <Td><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">img</div></Td>
              <Td>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setViewing(r)}>View</Button>
                  <DestroyButton canDestroy={canDestroy} onClick={() => setConfirm({ kind: "scrapbook item", id: r.id, label: `${r.type} ${r.id}` })} />
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {viewing && (
        <Modal title={`Scrapbook ${viewing.type}`} onClose={() => setViewing(null)}>
          <div className="mb-4 flex h-40 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">
            {viewing.type} preview placeholder
          </div>
          <div className="flex justify-end"><Button variant="secondary" onClick={() => setViewing(null)}>Close</Button></div>
        </Modal>
      )}
      <ReasonModal confirm={confirm} onClose={() => setConfirm(null)} onConfirm={(id) => { doDelete(id); setConfirm(null); }} />
    </div>
  );
}

// ── Starter path (small card, not a table) ──────────────────────────────────────
function StarterTab() {
  // Local mock assignment.
  const assigned = [
    { name: "Know Your Rights", progress: "Lesson 4 of 6", state: "in_progress" as const },
    { name: "Setting Boundaries", progress: "Completed", state: "complete" as const },
  ];
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned starter path</h3>
      <div className="space-y-2">
        {assigned.map((p) => (
          <div key={p.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">{p.name}</span>
            <span className="flex items-center gap-2 text-slate-500">
              {p.progress}
              <Badge tone={p.state === "complete" ? "green" : "amber"}>{p.state === "complete" ? "complete" : "in progress"}</Badge>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Notification preferences ────────────────────────────────────────────────────
function NotifTab({ canDestroy }: { canDestroy: boolean }) {
  const [prefs, setPrefs] = useState<NotifPref[]>(MOCK_NOTIF_PREFS);
  const [overriding, setOverriding] = useState<NotifPref | null>(null);

  const applyOverride = (channel: string, reason: string) => {
    // TODO: POST /api/lea/admin/users/:id/notification-prefs (audit-logged)
    console.log(`[data] override notification preference: ${channel} (reason: ${reason})`);
    setPrefs((cur) => cur.map((p) => (p.channel === channel ? { ...p, optedIn: !p.optedIn } : p)));
  };

  return (
    <div>
      <SectionNote>Each override writes an audit log entry (§3.10).</SectionNote>
      <Table>
        <Thead>
          <Tr><Th>Channel</Th><Th>Status</Th><Th>Action</Th></Tr>
        </Thead>
        <tbody>
          {prefs.map((p) => (
            <Tr key={p.channel}>
              <Td className="font-medium text-slate-900">{p.channel}</Td>
              <Td><Badge tone={p.optedIn ? "green" : "neutral"}>{p.optedIn ? "opted in" : "opted out"}</Badge></Td>
              <Td>
                <Button variant="secondary" disabled={!canDestroy} onClick={() => setOverriding(p)}>
                  Override ({p.optedIn ? "opt out" : "opt in"})
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {!canDestroy && <p className="mt-2 text-xs text-slate-400">Overriding preferences requires data.write (Super Admin only).</p>}

      {overriding && (
        <OverridePrefModal
          pref={overriding}
          onClose={() => setOverriding(null)}
          onConfirm={(reason) => {
            applyOverride(overriding.channel, reason);
            setOverriding(null);
          }}
        />
      )}
    </div>
  );
}

// Typed-reason confirm before overriding a notification preference (audit-logged, §3.10).
function OverridePrefModal({
  pref,
  onClose,
  onConfirm,
}: {
  pref: NotifPref;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const target = pref.optedIn ? "opt out" : "opt in";
  return (
    <Modal title="Override notification preference?" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">
        You are about to override <span className="font-medium text-slate-900">{pref.channel}</span> (currently{" "}
        <Badge tone={pref.optedIn ? "green" : "neutral"}>{pref.optedIn ? "opted in" : "opted out"}</Badge> → <span className="font-medium text-slate-900">{target}</span>).
        This is recorded in the audit log.
      </p>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Reason (required, audit-logged)</label>
      <div className="mb-4"><Input value={reason} onChange={setReason} placeholder="Why override this preference?" /></div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Override</Button>
      </div>
    </Modal>
  );
}

// ── Connections (GLOBAL) ─────────────────────────────────────────────────────────
const CONN_STATUS_FILTERS: Array<ConnectionRequest["status"]> = ["pending", "accepted", "declined"];

function ConnectionsTab({ canDestroy }: { canDestroy: boolean }) {
  const [rows, setRows] = useState<ConnectionRequest[]>(MOCK_CONNECTIONS);
  const [statusFilter, setStatusFilter] = useState<ConnectionRequest["status"] | null>(null);
  const [counselorFilter, setCounselorFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [forcing, setForcing] = useState<ConnectionRequest | null>(null);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (statusFilter) r = r.filter((c) => c.status === statusFilter);
    if (counselorFilter) r = r.filter((c) => c.counselorId === counselorFilter);
    if (dateFrom) {
      const cutoff = new Date(dateFrom).getTime();
      if (!Number.isNaN(cutoff)) r = r.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
    }
    return r;
  }, [rows, statusFilter, counselorFilter, dateFrom]);

  return (
    <div>
      <SectionNote>Global view across all users. Admin-force status changes are Super Admin only and audit-logged.</SectionNote>
      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup label="Status">
            {CONN_STATUS_FILTERS.map((s) => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter((cur) => (cur === s ? null : s))}>{s}</Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Counselor">
            {COUNSELORS.map((c) => (
              <Chip key={c.id} active={counselorFilter === c.id} onClick={() => setCounselorFilter((cur) => (cur === c.id ? null : c.id))}>{c.name}</Chip>
            ))}
          </FilterGroup>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">From</span>
            <div className="w-40"><Input value={dateFrom} onChange={setDateFrom} type="date" /></div>
          </div>
          {(statusFilter || counselorFilter || dateFrom) && (
            <Button variant="ghost" onClick={() => { setStatusFilter(null); setCounselorFilter(null); setDateFrom(""); }}>Clear filters</Button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState>No connection requests match the current filters.</EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr><Th>User</Th><Th>Counselor</Th><Th>Status</Th><Th>Created</Th><Th>Action</Th></Tr>
          </Thead>
          <tbody>
            {filtered.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <Link href={`/users/${c.userId}`} className="font-medium text-brand-700 hover:underline">{c.userName}</Link>
                </Td>
                <Td>{c.counselorName}</Td>
                <Td><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></Td>
                <Td>{fmtDate(c.createdAt)}</Td>
                <Td>
                  <Button variant="secondary" disabled={!canDestroy} onClick={() => setForcing(c)}>Force status</Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {!canDestroy && <p className="mt-2 text-xs text-slate-400">Admin-force status changes require data.write (Super Admin only).</p>}

      {forcing && (
        <ForceStatusModal
          request={forcing}
          onClose={() => setForcing(null)}
          onConfirm={(status, reason) => {
            // TODO: POST /api/lea/admin/connections/:id/force-status (data.write) — audit-logged.
            console.log(`[data] force connection ${forcing.id} → ${status} (reason: ${reason})`);
            setRows((cur) => cur.map((r) => (r.id === forcing.id ? { ...r, status } : r)));
            setForcing(null);
          }}
        />
      )}
    </div>
  );
}

function ForceStatusModal({
  request,
  onClose,
  onConfirm,
}: {
  request: ConnectionRequest;
  onClose: () => void;
  onConfirm: (status: ConnectionRequest["status"], reason: string) => void;
}) {
  const [status, setStatus] = useState<ConnectionRequest["status"]>(request.status);
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length > 0 && status !== request.status;
  return (
    <Modal title="Admin-force connection status" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">
        {request.userName} ↔ {request.counselorName} (currently <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>)
      </p>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">New status</label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as ConnectionRequest["status"])}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {CONN_STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Reason (required, audit-logged)</label>
      <div className="mb-4"><Input value={reason} onChange={setReason} placeholder="Why force this change?" /></div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!canSubmit} onClick={() => onConfirm(status, reason.trim())}>Force status</Button>
      </div>
    </Modal>
  );
}

// ── Shared local helpers ────────────────────────────────────────────────────────
function DestroyButton({ canDestroy, onClick }: { canDestroy: boolean; onClick: () => void }) {
  return (
    <Button variant="danger" disabled={!canDestroy} onClick={onClick}>
      {canDestroy ? "Delete" : "Super Admin only"}
    </Button>
  );
}

// Confirm modal requiring a typed reason before a destructive op proceeds.
function ReasonModal({
  confirm,
  onClose,
  onConfirm,
}: {
  confirm: ConfirmState | null;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  if (!confirm) return null;
  const submit = () => {
    if (!reason.trim()) return;
    onConfirm(confirm.id, reason.trim());
    setReason("");
  };
  return (
    <Modal title={`Delete ${confirm.kind}?`} onClose={() => { setReason(""); onClose(); }}>
      <p className="mb-3 text-sm text-slate-600">
        You are about to delete <span className="font-medium text-slate-900">{confirm.label}</span>. This is recorded in the
        audit log and cannot be undone.
      </p>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Reason (required)</label>
      <div className="mb-4"><Input value={reason} onChange={setReason} placeholder="Why is this deletion needed?" /></div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setReason(""); onClose(); }}>Cancel</Button>
        <Button variant="danger" disabled={!reason.trim()} onClick={submit}>Delete</Button>
      </div>
    </Modal>
  );
}

function SectionNote({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs text-slate-500">{children}</p>;
}

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
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition ${
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
