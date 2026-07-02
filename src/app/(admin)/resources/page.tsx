"use client";

// §3.7 Resource Management — sticker packs, default avatars & profile frames,
// and master-data reference tables (interest categories, counselor types, Lea
// personalities). Writes are no-ops against local state; wire to
// /api/lea/admin/resources/* and /api/lea/admin/master-data/* when the backend ships.

import { useState } from "react";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  ScaffoldNote,
  Table,
  Thead,
  Th,
  Tr,
  Td,
  EmptyState,
} from "@/components/ui";
import { STICKER_PACKS, INTEREST_CATEGORIES, COUNSELOR_TYPES, PERSONALITIES } from "@/lib/mock-data";
import { fmtDateTime } from "@/lib/format";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { StickerPack, MasterDataItem, KnowledgeEntry } from "@/lib/types";

type Tab = "stickers" | "avatars" | "master" | "knowledge";

export default function ResourcesPage() {
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "resources.write");

  const [tab, setTab] = useState<Tab>("stickers");

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "stickers", label: "Stickers" },
    { key: "avatars", label: "Avatars & Frames" },
    { key: "master", label: "Master Data" },
    { key: "knowledge", label: "AI Knowledge Base" },
  ];

  return (
    <div>
      <PageHeader
        title="Resources"
        prd="§3.7"
        description="Manage in-app assets (sticker packs, default avatars, profile frames) and the master-data reference tables that drive onboarding and matching."
        actions={tab === "stickers" ? <NewStickerPackAction canWrite={canWrite} /> : undefined}
      />

      <ScaffoldNote>
        Assets and master data are mocked. Uploads, toggles, reorders, adds, renames, and deletes update local state only —
        wire to /api/lea/admin/resources/* and /api/lea/admin/master-data/*.
      </ScaffoldNote>

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stickers" && <StickersTab canWrite={canWrite} />}
      {tab === "avatars" && <AvatarsTab canWrite={canWrite} />}
      {tab === "master" && <MasterDataTab canWrite={canWrite} />}
      {tab === "knowledge" && <KnowledgeTab canWrite={canWrite} />}
    </div>
  );
}

// ── AI Knowledge Base tab ─────────────────────────────────────────────────────
// Manager ask: feed knowledge into Lea. Wired to the real admin API
// (api.knowledge.*). The backend embeds/indexes entries for retrieval (RAG).
function KnowledgeTab({ canWrite }: { canWrite: boolean }) {
  const { data, loading, error, reload } = useApi(() => api.knowledge.list(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const entries = data?.items ?? [];

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api.knowledge.remove(id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Knowledge Base</h2>
          <p className="text-xs text-slate-400">
            Entries Lea draws on when answering. The backend embeds and indexes each entry for retrieval (RAG).
          </p>
        </div>
        <Button variant="primary" disabled={!canWrite} onClick={() => setAddOpen(true)}>
          Add knowledge
        </Button>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading knowledge entries…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="text-sm text-rose-600">Failed to load knowledge entries: {error}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        </Card>
      ) : entries.length === 0 ? (
        <EmptyState>No knowledge entries yet. Add one to expand what Lea can draw on.</EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Tags</Th>
              <Th>Status</Th>
              <Th>Added</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <tbody>
            {entries.map((e) => (
              <Tr key={e.id}>
                <Td>
                  <div className="font-medium text-slate-900">{e.title}</div>
                  <div className="text-xs text-slate-400">{e.addedBy}</div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {e.tags.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      e.tags.map((t) => (
                        <Badge key={t} tone="blue">
                          {t}
                        </Badge>
                      ))
                    )}
                  </div>
                </Td>
                <Td>
                  <Badge tone={e.status === "indexed" ? "green" : "amber"}>{e.status}</Badge>
                </Td>
                <Td>{fmtDateTime(e.addedAt)}</Td>
                <Td>
                  <Button variant="danger" disabled={!canWrite || busyId === e.id} onClick={() => remove(e.id)}>
                    Delete
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {addOpen && (
        <AddKnowledgeModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function AddKnowledgeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !content.trim()) {
      setErr("Title and content are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await api.knowledge.create({
        title,
        content,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add knowledge");
      setSaving(false);
    }
  }

  return (
    <Modal title="Add knowledge" onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Title">
          <Input value={title} onChange={setTitle} placeholder="Entry title" />
        </Labeled>
        <Labeled label="Content">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Knowledge content Lea can retrieve"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Labeled>
        <Labeled label="Tags (comma-separated)">
          <Input value={tags} onChange={setTags} placeholder="e.g. pricing, onboarding, faq" />
        </Labeled>
      </div>
      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={saving} onClick={submit}>
          Add to knowledge base
        </Button>
      </div>
    </Modal>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
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

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

// "New sticker pack" lives in the PageHeader actions, but its modal state is part
// of the stickers feature, so we keep a tiny wrapper that owns the open state.
function NewStickerPackAction({ canWrite }: { canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" disabled={!canWrite} onClick={() => setOpen(true)}>
        New sticker pack
      </Button>
      {open && <NewStickerPackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NewStickerPackModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Modal title="New sticker pack" onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Name">
          <Input value={name} onChange={setName} placeholder="Pack name" />
        </Labeled>
        <Labeled label="Description">
          <Input value={description} onChange={setDescription} placeholder="Short description" />
        </Labeled>
        <Labeled label="Cover image">
          <div className="flex items-center gap-2">
            {/* SCAFFOLD: upload is stubbed — disabled file input + stub button. */}
            <input type="file" disabled className="text-xs text-slate-400" />
            <Button variant="secondary" disabled onClick={() => { /* TODO: POST cover to /api/lea/admin/resources/upload */ }}>
              Upload
            </Button>
          </div>
        </Labeled>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            // TODO: POST /api/lea/admin/resources/sticker-pack
            onClose();
          }}
        >
          Create
        </Button>
      </div>
    </Modal>
  );
}

// ── Stickers tab ────────────────────────────────────────────────────────────
function StickersTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<StickerPack[]>([...STICKER_PACKS].sort((a, b) => a.order - b.order));
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function toggleEnabled(id: string) {
    // TODO: PATCH /api/lea/admin/resources/sticker-pack/{id} { enabled }
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  }

  function move(id: string, dir: -1 | 1) {
    // TODO: PATCH /api/lea/admin/resources/sticker-pack/reorder
    setRows((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= sorted.length) return prev;
      const a = sorted[i];
      const b = sorted[j];
      return prev.map((p) => {
        if (p.id === a.id) return { ...p, order: b.order };
        if (p.id === b.id) return { ...p, order: a.order };
        return p;
      });
    });
  }

  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const editing = rows.find((p) => p.id === editId) ?? null;
  const deleting = rows.find((p) => p.id === deleteId) ?? null;

  return (
    <>
      <Table>
        <Thead>
          <Tr>
            <Th>Order</Th>
            <Th>Cover</Th>
            <Th>Name</Th>
            <Th>Stickers</Th>
            <Th>Enabled</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <tbody>
          {sorted.map((p, idx) => (
            <Tr key={p.id}>
              <Td>
                <div className="flex items-center gap-1">
                  <span className="w-5 text-slate-500">{p.order}</span>
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(p.id, -1)}
                      disabled={!canWrite || idx === 0}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(p.id, 1)}
                      disabled={!canWrite || idx === sorted.length - 1}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </Td>
              <Td>
                {/* Cover thumbnail placeholder — no asset URLs in scaffold. */}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
              </Td>
              <Td>
                <div className="font-medium text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-400">{p.description}</div>
              </Td>
              <Td>{p.stickerCount}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Badge tone={p.enabled ? "green" : "neutral"}>{p.enabled ? "Enabled" : "Disabled"}</Badge>
                  <Button variant="ghost" disabled={!canWrite} onClick={() => toggleEnabled(p.id)}>
                    {p.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Button variant="secondary" disabled={!canWrite} onClick={() => setEditId(p.id)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!canWrite}
                    onClick={() => { /* TODO: bulk upload stickers → /api/lea/admin/resources/sticker-pack/{id}/stickers */ }}
                  >
                    Upload stickers
                  </Button>
                  <Button variant="danger" disabled={!canWrite} onClick={() => setDeleteId(p.id)}>
                    Delete
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      {editing && <EditStickerPackModal pack={editing} onClose={() => setEditId(null)} />}
      {deleting && <DeleteStickerPackModal pack={deleting} onClose={() => setDeleteId(null)} />}
    </>
  );
}

function EditStickerPackModal({ pack, onClose }: { pack: StickerPack; onClose: () => void }) {
  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState(pack.description);

  return (
    <Modal title={`Edit ${pack.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Name">
          <Input value={name} onChange={setName} />
        </Labeled>
        <Labeled label="Description">
          <Input value={description} onChange={setDescription} />
        </Labeled>
        <Labeled label="Cover image">
          <div className="flex items-center gap-2">
            <input type="file" disabled className="text-xs text-slate-400" />
            <Button variant="secondary" disabled>
              Upload
            </Button>
          </div>
        </Labeled>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            // TODO: PATCH /api/lea/admin/resources/sticker-pack/{id}
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}

function DeleteStickerPackModal({ pack, onClose }: { pack: StickerPack; onClose: () => void }) {
  return (
    <Modal title={`Delete ${pack.name}?`} onClose={onClose}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Stickers from this pack may already be used in chat messages and scrapbook entries. Deleting the pack removes it
        from the picker; existing usages may render as missing. Consider disabling instead.
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            // TODO: DELETE /api/lea/admin/resources/sticker-pack/{id}
            onClose();
          }}
        >
          Delete pack
        </Button>
      </div>
    </Modal>
  );
}

// ── Avatars & Frames tab ──────────────────────────────────────────────────────
// LOCAL MOCK — the shared mock-data has no avatar/frame collections, so we define
// small in-file arrays here purely so the tab is navigable. Replace with
// /api/lea/admin/resources/avatars and .../frames when the backend ships.
interface LocalAsset {
  key: string;
  label: string;
  color: string; // tailwind bg-* class for the placeholder swatch
  enabled: boolean;
}

const LOCAL_AVATARS: LocalAsset[] = [
  { key: "av_rose", label: "Rose", color: "bg-rose-300", enabled: true },
  { key: "av_amber", label: "Amber", color: "bg-amber-300", enabled: true },
  { key: "av_emerald", label: "Emerald", color: "bg-emerald-300", enabled: true },
  { key: "av_sky", label: "Sky", color: "bg-sky-300", enabled: true },
  { key: "av_violet", label: "Violet", color: "bg-violet-300", enabled: false },
  { key: "av_slate", label: "Slate", color: "bg-slate-300", enabled: true },
];

const LOCAL_FRAMES: LocalAsset[] = [
  { key: "fr_classic", label: "Classic", color: "bg-slate-200", enabled: true },
  { key: "fr_gold", label: "Gold", color: "bg-amber-200", enabled: true },
  { key: "fr_aurora", label: "Aurora", color: "bg-violet-200", enabled: false },
];

function AvatarsTab({ canWrite }: { canWrite: boolean }) {
  const [avatars, setAvatars] = useState<LocalAsset[]>(LOCAL_AVATARS);
  const [frames, setFrames] = useState<LocalAsset[]>(LOCAL_FRAMES);

  function toggleAvatar(key: string) {
    // TODO: PATCH /api/lea/admin/resources/avatar/{key} { enabled }
    setAvatars((prev) => prev.map((a) => (a.key === key ? { ...a, enabled: !a.enabled } : a)));
  }

  function toggleFrame(key: string) {
    // TODO: PATCH /api/lea/admin/resources/frame/{key} { enabled }
    setFrames((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Default avatars</h2>
            <p className="text-xs text-slate-400">Avatar options offered to users who have not uploaded their own.</p>
          </div>
          <Button
            variant="secondary"
            disabled={!canWrite}
            onClick={() => { /* TODO: upload new default avatar → /api/lea/admin/resources/avatar */ }}
          >
            Upload new avatar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {avatars.map((a) => (
            <div key={a.key} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-3">
              <div className={`h-14 w-14 rounded-full ${a.color} ${a.enabled ? "" : "opacity-30"}`} />
              <div className="text-sm font-medium text-slate-700">{a.label}</div>
              <Badge tone={a.enabled ? "green" : "neutral"}>{a.enabled ? "Enabled" : "Disabled"}</Badge>
              <Button variant="ghost" disabled={!canWrite} onClick={() => toggleAvatar(a.key)}>
                {a.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Profile frames</h2>
            <p className="text-xs text-slate-400">Decorative frames users can apply around their avatar.</p>
          </div>
          <Button
            variant="secondary"
            disabled={!canWrite}
            onClick={() => { /* TODO: upload new frame → /api/lea/admin/resources/frame */ }}
          >
            Upload new frame
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {frames.map((f) => (
            <div key={f.key} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <div className={`h-12 w-12 shrink-0 rounded-full border-4 ${f.enabled ? "" : "opacity-30"}`} style={{ borderColor: "currentColor" }}>
                <div className={`h-full w-full rounded-full ${f.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-700">{f.label}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={f.enabled ? "green" : "neutral"}>{f.enabled ? "Enabled" : "Disabled"}</Badge>
                  <Button variant="ghost" disabled={!canWrite} onClick={() => toggleFrame(f.key)}>
                    {f.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Master Data tab ────────────────────────────────────────────────────────────
function MasterDataTab({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="space-y-6">
      <InterestCategoriesCard canWrite={canWrite} />
      <CounselorTypesCard canWrite={canWrite} />
      <PersonalitiesCard canWrite={canWrite} />
    </div>
  );
}

function InterestCategoriesCard({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<MasterDataItem[]>([...INTEREST_CATEGORIES]);
  const [renameKey, setRenameKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [adding, setAdding] = useState("");

  function toggle(key: string) {
    // TODO: PATCH /api/lea/admin/master-data/interest/{key} { enabled }
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)));
  }

  function startRename(r: MasterDataItem) {
    setRenameKey(r.key);
    setRenameValue(r.displayName);
  }

  function commitRename() {
    // TODO: PATCH /api/lea/admin/master-data/interest/{key} { displayName }
    setRows((prev) => prev.map((r) => (r.key === renameKey ? { ...r, displayName: renameValue } : r)));
    setRenameKey(null);
    setRenameValue("");
  }

  function add() {
    const name = adding.trim();
    if (!name) return;
    // TODO: POST /api/lea/admin/master-data/interest { displayName }
    const key = name.toLowerCase().replace(/\s+/g, "_");
    setRows((prev) => [...prev, { key, displayName: name, enabled: true }]);
    setAdding("");
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Interest categories</h2>
      <p className="mb-3 text-xs text-slate-400">
        Drive onboarding interest selection. Disabling hides a category from onboarding without losing users&apos; existing
        preferences.
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              {renameKey === r.key ? (
                <div className="flex w-64 items-center gap-2">
                  <Input value={renameValue} onChange={setRenameValue} />
                  <Button variant="primary" onClick={commitRename}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setRenameKey(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-slate-900">{r.displayName}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{r.key}</span>
                </>
              )}
            </div>
            {renameKey !== r.key && (
              <div className="flex items-center gap-2">
                <Badge tone={r.enabled ? "green" : "neutral"}>{r.enabled ? "Enabled" : "Disabled"}</Badge>
                <Button variant="ghost" disabled={!canWrite} onClick={() => startRename(r)}>
                  Rename
                </Button>
                <Button variant="ghost" disabled={!canWrite} onClick={() => toggle(r.key)}>
                  {r.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-64">
          <Input value={adding} onChange={setAdding} placeholder="New interest category" />
        </div>
        <Button variant="secondary" disabled={!canWrite || !adding.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </Card>
  );
}

function CounselorTypesCard({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<MasterDataItem[]>([...COUNSELOR_TYPES]);
  const [renameKey, setRenameKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [adding, setAdding] = useState("");

  function startRename(r: MasterDataItem) {
    setRenameKey(r.key);
    setRenameValue(r.displayName);
  }

  function commitRename() {
    // TODO: PATCH /api/lea/admin/master-data/counselor-type/{key} { displayName }
    setRows((prev) => prev.map((r) => (r.key === renameKey ? { ...r, displayName: renameValue } : r)));
    setRenameKey(null);
    setRenameValue("");
  }

  function add() {
    const name = adding.trim();
    if (!name) return;
    // TODO: POST /api/lea/admin/master-data/counselor-type { displayName }
    const key = name.toLowerCase().replace(/\s+/g, "_");
    setRows((prev) => [...prev, { key, displayName: name, enabled: true }]);
    setAdding("");
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Counselor types</h2>
      <p className="mb-3 text-xs text-slate-400">
        Categories assigned to counselors. The <span className="font-mono">key</span> is immutable once assigned to a
        counselor — only the display name can be renamed.
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              {renameKey === r.key ? (
                <div className="flex w-64 items-center gap-2">
                  <Input value={renameValue} onChange={setRenameValue} />
                  <Button variant="primary" onClick={commitRename}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setRenameKey(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-slate-900">{r.displayName}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{r.key}</span>
                </>
              )}
            </div>
            {renameKey !== r.key && (
              <Button variant="ghost" disabled={!canWrite} onClick={() => startRename(r)}>
                Rename
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-64">
          <Input value={adding} onChange={setAdding} placeholder="New counselor type" />
        </div>
        <Button variant="secondary" disabled={!canWrite || !adding.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </Card>
  );
}

function PersonalitiesCard({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<Array<MasterDataItem & { description: string }>>([...PERSONALITIES]);

  function toggle(key: string) {
    // TODO: PATCH /api/lea/admin/master-data/personality/{key} { enabled }
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)));
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Lea personalities</h2>
      <p className="mb-3 text-xs text-slate-400">
        Conversational tones users can pick for Lea. Disabling removes a tone from the picker for new selections.
      </p>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-900">
                {r.displayName}
                <span className="ml-2 font-mono text-xs text-slate-400">{r.key}</span>
              </div>
              <div className="text-xs text-slate-400">{r.description}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={r.enabled ? "green" : "neutral"}>{r.enabled ? "Enabled" : "Disabled"}</Badge>
              <Button variant="ghost" disabled={!canWrite} onClick={() => toggle(r.key)}>
                {r.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
