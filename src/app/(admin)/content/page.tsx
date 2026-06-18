"use client";

// §3.3 Content Management — Learn modules list with publish toggle, reorder,
// and edit/manage entry points. Writes are no-ops against local state; wire to
// /api/lea/admin/module/* when the backend ships.

import { useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  StatCard,
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
import { fmtPct, fmtDateTime } from "@/lib/format";
import { MODULES, getLessons, getBadges } from "@/lib/mock-data";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { LearnModule, Lesson, LearnBadge, Article } from "@/lib/types";

const DIFFICULTY_TONE: Record<LearnModule["difficulty"], "green" | "amber" | "red"> = {
  beginner: "green",
  intermediate: "amber",
  advanced: "red",
};

export default function ContentPage() {
  const { user } = useAuth();
  const canWrite = !!user && can(user.role, "content.write");

  const [rows, setRows] = useState<LearnModule[]>([...MODULES].sort((a, b) => a.order - b.order));
  const [newOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);

  const totalModules = rows.length;
  const publishedCount = rows.filter((m) => m.published).length;
  const totalLessons = rows.reduce((s, m) => s + m.lessonCount, 0);
  const totalBadges = rows.reduce((s, m) => s + m.badgeCount, 0);

  function togglePublish(id: string) {
    // TODO: PATCH /api/lea/admin/module/{id} { published } — unpublish hides from users immediately
    setRows((prev) => prev.map((m) => (m.id === id ? { ...m, published: !m.published } : m)));
  }

  function move(id: string, dir: -1 | 1) {
    // TODO: PATCH /api/lea/admin/module/reorder
    setRows((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= sorted.length) return prev;
      const a = sorted[i];
      const b = sorted[j];
      return prev.map((m) => {
        if (m.id === a.id) return { ...m, order: b.order };
        if (m.id === b.id) return { ...m, order: a.order };
        return m;
      });
    });
  }

  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const editing = rows.find((m) => m.id === editId) ?? null;
  const managing = rows.find((m) => m.id === manageId) ?? null;

  return (
    <div>
      <PageHeader
        title="Content — Learn"
        prd="§3.3"
        description="Learn modules, lessons, and badges. Reorder controls module sequence in the app."
        actions={
          <>
            <Link href="/content/languages">
              <Button variant="secondary">Languages</Button>
            </Link>
            <Button variant="primary" disabled={!canWrite} onClick={() => setNewOpen(true)}>
              New module
            </Button>
          </>
        }
      />

      <ScaffoldNote>
        Module data is mocked. Publish/reorder/edit update local state only — wire to /api/lea/admin/module/*.
      </ScaffoldNote>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total modules" value={totalModules} />
        <StatCard label="Published" value={publishedCount} sub={`${totalModules - publishedCount} draft`} />
        <StatCard label="Total lessons" value={totalLessons} />
        <StatCard label="Total badges" value={totalBadges} />
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>Order</Th>
            <Th>Title</Th>
            <Th>Lessons</Th>
            <Th>Badges</Th>
            <Th>Difficulty</Th>
            <Th>Est. time</Th>
            <Th>Published</Th>
            <Th>Progress</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <tbody>
          {sorted.map((m, idx) => (
            <Tr key={m.id}>
              <Td>
                <div className="flex items-center gap-1">
                  <span className="w-5 text-slate-500">{m.order}</span>
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(m.id, -1)}
                      disabled={!canWrite || idx === 0}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(m.id, 1)}
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
                <div className="flex items-center gap-3">
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-brand-50 object-contain p-0.5" />
                  )}
                  <div>
                    <div className="font-medium text-slate-900">{m.title}</div>
                    <div className="text-xs text-slate-400">{m.description}</div>
                  </div>
                </div>
              </Td>
              <Td>{m.lessonCount}</Td>
              <Td>{m.badgeCount}</Td>
              <Td>
                <Badge tone={DIFFICULTY_TONE[m.difficulty]}>{m.difficulty}</Badge>
              </Td>
              <Td>{m.estimatedMinutes} min</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Badge tone={m.published ? "green" : "neutral"}>{m.published ? "Published" : "Draft"}</Badge>
                  <Button variant="ghost" disabled={!canWrite} onClick={() => togglePublish(m.id)}>
                    {m.published ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </Td>
              <Td>
                <div className="text-slate-700">{m.enrolment.toLocaleString()} enrolled</div>
                <div className="text-xs text-slate-400">{fmtPct(m.completionRate)} completion</div>
                <div className="text-xs text-slate-400">avg score {fmtPct(m.avgScore)}</div>
              </Td>
              <Td>
                <div className="flex gap-1">
                  <Button variant="secondary" disabled={!canWrite} onClick={() => setEditId(m.id)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setManageId(m.id)}>
                    Lessons / badges
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <ArticlesSection canWrite={canWrite} />

      {newOpen && <NewModuleModal onClose={() => setNewOpen(false)} />}
      {editing && <EditModuleModal module={editing} onClose={() => setEditId(null)} />}
      {managing && <ManageModal module={managing} canWrite={canWrite} onClose={() => setManageId(null)} />}
    </div>
  );
}

// ── Website articles ──────────────────────────────────────────────────────────
// Manager ask: push articles straight onto the marketing site. Wired to the real
// admin API (api.articles.*) — publishing pushes to legali-lea-web via the backend.
function ArticlesSection({ canWrite }: { canWrite: boolean }) {
  const { data, loading, error, reload } = useApi(() => api.articles.list(), []);
  const [newOpen, setNewOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const articles = data?.items ?? [];

  async function setStatus(a: Article, status: Article["status"]) {
    setBusyId(a.id);
    try {
      await api.articles.update(a.id, { status });
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api.articles.remove(id);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Website articles</h2>
          <p className="text-xs text-slate-400">
            Publishing pushes the article to the marketing site (legali-lea-web) via the backend.
          </p>
        </div>
        <Button variant="primary" disabled={!canWrite} onClick={() => setNewOpen(true)}>
          New article
        </Button>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading articles…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="text-sm text-rose-600">Failed to load articles: {error}</p>
          <div className="mt-3">
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        </Card>
      ) : articles.length === 0 ? (
        <EmptyState>No articles yet. Create one to publish to the website.</EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th>Author</Th>
              <Th>Updated</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <tbody>
            {articles.map((a) => (
              <Tr key={a.id}>
                <Td>
                  <div className="font-medium text-slate-900">{a.title}</div>
                  <div className="text-xs text-slate-400">{a.excerpt}</div>
                </Td>
                <Td>
                  <Badge tone={a.status === "published" ? "green" : "neutral"}>
                    {a.status === "published" ? "Published" : "Draft"}
                  </Badge>
                </Td>
                <Td>{a.author}</Td>
                <Td>{fmtDateTime(a.updatedAt)}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button
                      variant="secondary"
                      disabled={!canWrite || busyId === a.id}
                      onClick={() => setStatus(a, a.status === "published" ? "draft" : "published")}
                    >
                      {a.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Button variant="danger" disabled={!canWrite || busyId === a.id} onClick={() => remove(a.id)}>
                      Delete
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {newOpen && (
        <NewArticleModal
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function NewArticleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(status: Article["status"]) {
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await api.articles.create({ title, excerpt, body, status });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create article");
      setSaving(false);
    }
  }

  return (
    <Modal title="New article" onClose={onClose} wide>
      <div className="space-y-3">
        <Labeled label="Title">
          <Input value={title} onChange={setTitle} placeholder="Article title" />
        </Labeled>
        <Labeled label="Excerpt">
          <Input value={excerpt} onChange={setExcerpt} placeholder="Short summary shown on the website" />
        </Labeled>
        <Labeled label="Body">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Article body"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </Labeled>
      </div>
      {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="secondary" disabled={saving} onClick={() => submit("draft")}>
          Save draft
        </Button>
        <Button variant="primary" disabled={saving} onClick={() => submit("published")}>
          Publish to website
        </Button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-xl border border-slate-200 bg-white p-5 shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
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

function DifficultySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="beginner">Beginner</option>
      <option value="intermediate">Intermediate</option>
      <option value="advanced">Advanced</option>
    </select>
  );
}

function NewModuleModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [estimated, setEstimated] = useState("");
  const [order, setOrder] = useState("");

  return (
    <Modal title="New module" onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Title">
          <Input value={title} onChange={setTitle} placeholder="Module title" />
        </Labeled>
        <Labeled label="Description">
          <Input value={description} onChange={setDescription} placeholder="Short description" />
        </Labeled>
        <Labeled label="Difficulty">
          <DifficultySelect value={difficulty} onChange={setDifficulty} />
        </Labeled>
        <Labeled label="Estimated time (min)">
          <Input value={estimated} onChange={setEstimated} type="number" />
        </Labeled>
        <Labeled label="Order">
          <Input value={order} onChange={setOrder} type="number" />
        </Labeled>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            // TODO: POST /api/lea/admin/module
            onClose();
          }}
        >
          Create
        </Button>
      </div>
    </Modal>
  );
}

function EditModuleModal({ module: m, onClose }: { module: LearnModule; onClose: () => void }) {
  const [title, setTitle] = useState(m.title);
  const [description, setDescription] = useState(m.description);
  const [difficulty, setDifficulty] = useState<string>(m.difficulty);
  const [estimated, setEstimated] = useState(String(m.estimatedMinutes));

  return (
    <Modal title={`Edit ${m.title}`} onClose={onClose}>
      {m.badgeCount > 0 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This module has {m.badgeCount} badge{m.badgeCount === 1 ? "" : "s"}. Editing lessons or deleting the module may
          affect badges users have already earned — proceed with care.
        </div>
      )}
      <div className="space-y-3">
        <Labeled label="Title">
          <Input value={title} onChange={setTitle} />
        </Labeled>
        <Labeled label="Description">
          <Input value={description} onChange={setDescription} />
        </Labeled>
        <Labeled label="Difficulty">
          <DifficultySelect value={difficulty} onChange={setDifficulty} />
        </Labeled>
        <Labeled label="Estimated time (min)">
          <Input value={estimated} onChange={setEstimated} type="number" />
        </Labeled>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            // TODO: PATCH /api/lea/admin/module/{id}
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}

const LESSON_TYPE_TONE: Record<Lesson["type"], "blue" | "amber" | "neutral"> = {
  quiz: "amber",
  read: "neutral",
  video: "blue",
};

function LessonTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="quiz">Quiz</option>
      <option value="read">Read</option>
      <option value="video">Video</option>
    </select>
  );
}

// §3.3 Lessons & badges manager for a single module. All writes are local-state
// only — wire to /api/lea/admin/modules/:id/lessons and .../badges when ready.
function ManageModal({ module: m, canWrite, onClose }: { module: LearnModule; canWrite: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"lessons" | "badges">("lessons");

  const [lessons, setLessons] = useState<Lesson[]>(() => [...getLessons(m.id)].sort((a, b) => a.order - b.order));
  const [badges, setBadges] = useState<LearnBadge[]>(() => getBadges(m.id));

  const [lessonForm, setLessonForm] = useState<Lesson | null>(null); // null = closed
  const [badgeForm, setBadgeForm] = useState<LearnBadge | null>(null);
  const [badgeDelete, setBadgeDelete] = useState<LearnBadge | null>(null);

  function moveLesson(id: string, dir: -1 | 1) {
    // TODO: PATCH /api/lea/admin/modules/:id/lessons/reorder
    setLessons((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= sorted.length) return prev;
      const a = sorted[i];
      const b = sorted[j];
      return prev.map((l) => {
        if (l.id === a.id) return { ...l, order: b.order };
        if (l.id === b.id) return { ...l, order: a.order };
        return l;
      });
    });
  }

  function saveLesson(draft: Lesson) {
    setLessons((prev) => {
      if (prev.some((l) => l.id === draft.id)) {
        // TODO: PATCH /api/lea/admin/modules/:id/lessons/:lessonId
        return prev.map((l) => (l.id === draft.id ? draft : l));
      }
      // TODO: POST /api/lea/admin/modules/:id/lessons
      return [...prev, draft];
    });
    setLessonForm(null);
  }

  function deleteLesson(id: string) {
    // TODO: DELETE /api/lea/admin/modules/:id/lessons/:lessonId
    setLessons((prev) => prev.filter((l) => l.id !== id));
  }

  function saveBadge(draft: LearnBadge) {
    setBadges((prev) => {
      if (prev.some((b) => b.id === draft.id)) {
        // TODO: PATCH /api/lea/admin/modules/:id/badges/:badgeId
        return prev.map((b) => (b.id === draft.id ? draft : b));
      }
      // TODO: POST /api/lea/admin/modules/:id/badges
      return [...prev, draft];
    });
    setBadgeForm(null);
  }

  function deleteBadge(id: string) {
    // TODO: DELETE /api/lea/admin/modules/:id/badges/:badgeId
    setBadges((prev) => prev.filter((b) => b.id !== id));
    setBadgeDelete(null);
  }

  const sortedLessons = [...lessons].sort((a, b) => a.order - b.order);

  return (
    <Modal title={`Manage — ${m.title}`} onClose={onClose} wide>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(["lessons", "badges"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium capitalize ${
              tab === t ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "lessons" ? (
        <div>
          <div className="mb-3 flex justify-end">
            <Button
              variant="primary"
              disabled={!canWrite}
              onClick={() =>
                setLessonForm({
                  id: `l_new_${Date.now()}`,
                  moduleId: m.id,
                  title: "",
                  order: sortedLessons.length + 1,
                  type: "read",
                  status: "draft",
                })
              }
            >
              Create lesson
            </Button>
          </div>
          {sortedLessons.length === 0 ? (
            <EmptyState>No lessons yet. Create the first lesson for this module.</EmptyState>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <tbody>
                {sortedLessons.map((l, idx) => (
                  <Tr key={l.id}>
                    <Td>
                      <div className="flex items-center gap-1">
                        <span className="w-5 text-slate-500">{l.order}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveLesson(l.id, -1)}
                            disabled={!canWrite || idx === 0}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Move up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveLesson(l.id, 1)}
                            disabled={!canWrite || idx === sortedLessons.length - 1}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            aria-label="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-900">{l.title}</span>
                    </Td>
                    <Td>
                      <Badge tone={LESSON_TYPE_TONE[l.type]}>{l.type}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={l.status === "published" ? "green" : "neutral"}>{l.status}</Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button variant="secondary" disabled={!canWrite} onClick={() => setLessonForm(l)}>
                          Edit
                        </Button>
                        <Button variant="ghost" disabled={!canWrite} onClick={() => deleteLesson(l.id)}>
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex justify-end">
            <Button
              variant="primary"
              disabled={!canWrite}
              onClick={() =>
                setBadgeForm({ id: `b_new_${Date.now()}`, moduleId: m.id, name: "", description: "", iconUrl: null, earnedCount: 0 })
              }
            >
              Create badge
            </Button>
          </div>
          {badges.length === 0 ? (
            <EmptyState>No badges yet. Create a badge to reward learners for this module.</EmptyState>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Icon</Th>
                  <Th>Name</Th>
                  <Th>Description</Th>
                  <Th>Earned</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <tbody>
                {badges.map((b) => (
                  <Tr key={b.id}>
                    <Td>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
                        {b.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.iconUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          "🏅"
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-900">{b.name}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-400">{b.description}</span>
                    </Td>
                    <Td>{b.earnedCount.toLocaleString()}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button variant="secondary" disabled={!canWrite} onClick={() => setBadgeForm(b)}>
                          Edit
                        </Button>
                        <Button variant="ghost" disabled={!canWrite} onClick={() => setBadgeDelete(b)}>
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {lessonForm && <LessonFormModal lesson={lessonForm} onSave={saveLesson} onClose={() => setLessonForm(null)} />}
      {badgeForm && <BadgeFormModal badge={badgeForm} onSave={saveBadge} onClose={() => setBadgeForm(null)} />}
      {badgeDelete && (
        <DeleteBadgeModal badge={badgeDelete} onConfirm={() => deleteBadge(badgeDelete.id)} onClose={() => setBadgeDelete(null)} />
      )}
    </Modal>
  );
}

function LessonFormModal({ lesson, onSave, onClose }: { lesson: Lesson; onSave: (l: Lesson) => void; onClose: () => void }) {
  const isNew = lesson.title === "";
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState<string>(lesson.type);

  return (
    <Modal title={isNew ? "New lesson" : `Edit ${lesson.title}`} onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Title">
          <Input value={title} onChange={setTitle} placeholder="Lesson title" />
        </Labeled>
        <Labeled label="Type">
          <LessonTypeSelect value={type} onChange={setType} />
        </Labeled>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSave({ ...lesson, title, type: type as Lesson["type"] })}>
          {isNew ? "Create" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function BadgeFormModal({ badge, onSave, onClose }: { badge: LearnBadge; onSave: (b: LearnBadge) => void; onClose: () => void }) {
  const isNew = badge.name === "";
  const [name, setName] = useState(badge.name);
  const [description, setDescription] = useState(badge.description);

  return (
    <Modal title={isNew ? "New badge" : `Edit ${badge.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Labeled label="Name">
          <Input value={name} onChange={setName} placeholder="Badge name" />
        </Labeled>
        <Labeled label="Description">
          <Input value={description} onChange={setDescription} placeholder="Short description" />
        </Labeled>
        <Labeled label="Icon">
          {/* Upload stub — file handling/storage is a no-op until the assets API ships. */}
          <input
            type="file"
            accept="image/*"
            disabled
            className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-400">Icon upload is not wired up yet.</p>
        </Labeled>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSave({ ...badge, name, description })}>
          {isNew ? "Create" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

function DeleteBadgeModal({ badge, onConfirm, onClose }: { badge: LearnBadge; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={`Delete ${badge.name}`} onClose={onClose}>
      {badge.earnedCount > 0 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {badge.earnedCount.toLocaleString()} user{badge.earnedCount === 1 ? " has" : "s have"} earned this badge — deleting is
          destructive and will remove it from their profiles.
        </div>
      )}
      <p className="text-sm text-slate-600">Are you sure you want to delete this badge? This cannot be undone.</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete badge
        </Button>
      </div>
    </Modal>
  );
}
