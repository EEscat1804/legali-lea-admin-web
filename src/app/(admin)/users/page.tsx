"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card, Badge, Button, Input, ScaffoldNote, Table, Thead, Th, Tr, Td, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { LANGUAGES, paginate } from "@/lib/mock-data";
import { api, useApi } from "@/lib/api";
import type { SubscriptionStatus, AppUser, Language } from "@/lib/types";

const PAGE_SIZE = 10;

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

const SUB_FILTERS: Array<SubscriptionStatus> = ["active", "cancelled", "expired", "free"];
const STATUS_FILTERS: Array<AppUser["status"]> = ["active", "suspended", "deleted"];

// §3.1 Users list — survivor account lifecycle control.
// Search/filter/pagination are client-side here; in production the list endpoint
// (GET /api/lea/admin/users) paginates and filters server-side.
export default function UsersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [subFilter, setSubFilter] = useState<SubscriptionStatus | null>(null);
  const [statusFilter, setStatusFilter] = useState<AppUser["status"] | null>(null);
  const [langFilter, setLangFilter] = useState<Language | null>(null);
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [page, setPage] = useState(1);

  // Search/subscription/account/language filtering happens server-side via the
  // list endpoint. Registration-date filtering has no API param, so it stays
  // client-side over the returned items.
  const { data, loading, error } = useApi(
    () =>
      api.users.list({
        q: q || undefined,
        status: statusFilter || undefined,
        sub: subFilter || undefined,
        language: langFilter || undefined,
      }),
    [q, statusFilter, subFilter, langFilter],
  );

  const filtered = useMemo(() => {
    let rows = data?.items ?? [];
    if (joinedFrom) rows = rows.filter((u) => u.joinDate >= joinedFrom);
    if (joinedTo) {
      // Make the "to" bound inclusive of the whole day.
      const end = `${joinedTo}T23:59:59.999Z`;
      rows = rows.filter((u) => u.joinDate <= end);
    }
    return rows;
  }, [data, joinedFrom, joinedTo]);

  // Clamp page if filters shrank the result set.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const { items, total } = paginate(filtered, safePage, PAGE_SIZE);

  const onSearch = (v: string) => {
    setQ(v);
    setPage(1);
  };

  const toggleSub = (s: SubscriptionStatus) => {
    setSubFilter((cur) => (cur === s ? null : s));
    setPage(1);
  };

  const toggleStatus = (s: AppUser["status"]) => {
    setStatusFilter((cur) => (cur === s ? null : s));
    setPage(1);
  };

  const toggleLang = (code: Language) => {
    setLangFilter((cur) => (cur === code ? null : code));
    setPage(1);
  };

  const onJoinedFrom = (v: string) => {
    setJoinedFrom(v);
    setPage(1);
  };

  const onJoinedTo = (v: string) => {
    setJoinedTo(v);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Users"
        prd="§3.1"
        description="Survivor accounts — search, inspect, and manage account & subscription lifecycle."
      />
      <ScaffoldNote>Search, subscription, account, and language filters are applied server-side via GET /api/admin/users. Registration-date filtering is applied client-side.</ScaffoldNote>

      <Card className="mb-4 !p-4">
        <div className="mb-3 max-w-sm">
          <Input value={q} onChange={onSearch} placeholder="Search by name or email…" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup label="Subscription">
            {SUB_FILTERS.map((s) => (
              <Chip key={s} active={subFilter === s} onClick={() => toggleSub(s)}>
                {s}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Account">
            {STATUS_FILTERS.map((s) => (
              <Chip key={s} active={statusFilter === s} onClick={() => toggleStatus(s)}>
                {s}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Language">
            {LANGUAGES.map((l) => (
              <Chip key={l.code} active={langFilter === l.code} onClick={() => toggleLang(l.code)}>
                {l.displayName}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Joined">
            <div className="w-40">
              <Input value={joinedFrom} onChange={onJoinedFrom} type="date" />
            </div>
            <span className="text-xs text-slate-400">to</span>
            <div className="w-40">
              <Input value={joinedTo} onChange={onJoinedTo} type="date" />
            </div>
          </FilterGroup>
          {(subFilter || statusFilter || langFilter || joinedFrom || joinedTo) && (
            <Button variant="ghost" onClick={() => { setSubFilter(null); setStatusFilter(null); setLangFilter(null); setJoinedFrom(""); setJoinedTo(""); setPage(1); }}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <EmptyState>Loading users…</EmptyState>
      ) : error ? (
        <EmptyState>Failed to load users: {error}</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>No users match the current search and filters.</EmptyState>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Language</Th>
              <Th>Subscription</Th>
              <Th>Status</Th>
              <Th>Streak / Level</Th>
              <Th>Joined</Th>
            </Tr>
          </Thead>
          <tbody>
            {items.map((u) => (
              <Tr key={u.id} onClick={() => router.push(`/users/${u.id}`)}>
                <Td>
                  <div className="font-medium text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </Td>
                <Td>{u.language.toUpperCase()}</Td>
                <Td>
                  <Badge tone={SUB_TONE[u.subscription.status]}>{u.subscription.status}</Badge>
                  <span className="ml-2 text-xs text-slate-400">{u.subscription.plan}</span>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                </Td>
                <Td>
                  🔥 {u.streak} · Lv {u.level}
                </Td>
                <Td>{fmtDate(u.joinDate)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          Showing {items.length} of {total} user{total === 1 ? "" : "s"}
          {data && filtered.length !== data.items.length ? ` (filtered from ${data.items.length})` : ""}
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
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
