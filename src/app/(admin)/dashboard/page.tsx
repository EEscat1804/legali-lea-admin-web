"use client";

import { useState } from "react";
import { PageHeader, StatCard, Card, ScaffoldNote, Badge, Input } from "@/components/ui";
import { fmtMoney, fmtPct } from "@/lib/format";
import { USERS, SUBSCRIPTIONS, MODULES, FEEDBACK } from "@/lib/mock-data";

// §3.6 Platform Analytics — aggregate-only dashboard cards (daily refresh).
// Numbers here are illustrative; the real values come from the analytics
// rollup endpoint (GET /api/lea/admin/analytics).

// Range presets drive the headline cards. Values are illustrative; the real
// figures come from the analytics rollup endpoint scoped to the chosen window.
type RangeKey = "7d" | "30d" | "90d" | "Custom";
interface RangeStats {
  dauMau: string;
  dauMauSub: string;
  newRegs: string;
  newRegsSub: string;
  leaSessions: string;
  leaSessionsSub: string;
  avgSessions: string;
  safetyPlans: string;
  // Illustrative new-registration trend for the sparkline (one point per period).
  regsTrend: number[];
}
const RANGE_STATS: Record<Exclude<RangeKey, "Custom">, RangeStats> = {
  "7d": {
    dauMau: "1.2k / 4.8k",
    dauMauSub: "ratio 0.25",
    newRegs: "+71",
    newRegsSub: "last 7 days",
    leaSessions: "5.9k",
    leaSessionsSub: "last 7 days",
    avgSessions: "1.1",
    safetyPlans: "14",
    regsTrend: [8, 11, 9, 13, 10, 12, 8],
  },
  "30d": {
    dauMau: "1.2k / 4.8k",
    dauMauSub: "ratio 0.25",
    newRegs: "+312",
    newRegsSub: "last 30 days",
    leaSessions: "24k",
    leaSessionsSub: "last 30 days",
    avgSessions: "3.4",
    safetyPlans: "58",
    regsTrend: [40, 52, 47, 61, 55, 57],
  },
  "90d": {
    dauMau: "1.3k / 5.1k",
    dauMauSub: "ratio 0.25",
    newRegs: "+884",
    newRegsSub: "last 90 days",
    leaSessions: "71k",
    leaSessionsSub: "last 90 days",
    avgSessions: "9.6",
    safetyPlans: "163",
    regsTrend: [118, 132, 121, 147, 140, 161, 165, 152, 168],
  },
};

// Tiny inline-SVG sparkline (no chart lib — PRD §5 keeps the bundle small).
// Renders a brand-coloured polyline scaled to the data extent.
function Sparkline({ data, width = 120, height = 32 }: { data: number[]; width?: number; height?: number }) {
  if (data.length === 0) return null;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-brand-600" aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // For "Custom" we reuse the 30d figures as an illustrative stand-in until the
  // rollup endpoint accepts an explicit window.
  const stats = RANGE_STATS[range === "Custom" ? "30d" : range];

  const activeSubs = SUBSCRIPTIONS.filter((s) => s.status === "active").length;
  const mrr = USERS.filter((u) => u.subscription.status === "active").reduce((sum, u) => {
    if (u.subscription.billingPeriod === "monthly") return sum + 9.99;
    if (u.subscription.billingPeriod === "yearly") return sum + 79.99 / 12;
    return sum;
  }, 0);
  const openBugs = FEEDBACK.filter((f) => f.type === "bug" && f.status !== "resolved" && f.status !== "closed").length;
  const avgCompletion = MODULES.filter((m) => m.published).reduce((s, m) => s + m.completionRate, 0) / Math.max(1, MODULES.filter((m) => m.published).length);

  const mood = [
    { bucket: "Great", pct: 0.18, tone: "green" as const },
    { bucket: "Good", pct: 0.27, tone: "green" as const },
    { bucket: "Okay", pct: 0.24, tone: "blue" as const },
    { bucket: "Not great", pct: 0.16, tone: "amber" as const },
    { bucket: "Bad", pct: 0.1, tone: "red" as const },
    { bucket: "Overwhelmed", pct: 0.05, tone: "red" as const },
  ];

  return (
    <div>
      <PageHeader
        title="Platform Analytics"
        prd="§3.6"
        description="Aggregate health & engagement. No individual user behaviour. Daily refresh."
        actions={<DateRangePicker range={range} onChange={setRange} />}
      />
      <ScaffoldNote>Card values are placeholders. Wire to the analytics rollup endpoint; charts are simplified bars.</ScaffoldNote>

      {range === "Custom" && (
        <Card className="mb-4 !p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">From</label>
              <div className="w-40"><Input value={customFrom} onChange={setCustomFrom} type="date" /></div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">To</label>
              <div className="w-40"><Input value={customTo} onChange={setCustomTo} type="date" /></div>
            </div>
            <p className="text-xs text-slate-400">Custom windows show illustrative figures until the rollup endpoint accepts an explicit range.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="DAU / MAU" value={stats.dauMau} sub={stats.dauMauSub} />
        <StatCard
          label={`New registrations (${range})`}
          value={
            <span className="flex items-center justify-between gap-2">
              {stats.newRegs}
              <Sparkline data={stats.regsTrend} />
            </span>
          }
          sub={stats.newRegsSub}
        />
        <StatCard label="Active subscriptions" value={activeSubs} sub={`MRR ${fmtMoney(mrr)}`} />
        <StatCard label={`Lea sessions (${range})`} value={stats.leaSessions} sub={stats.leaSessionsSub} />
        <StatCard label="Avg sessions / active user" value={stats.avgSessions} sub={stats.newRegsSub} />
        <StatCard label="Module completion" value={fmtPct(avgCompletion)} sub="overall, published" />
        <StatCard label="Safety plans created" value={stats.safetyPlans} sub={`${range} trend ↑`} />
        <StatCard label="Open bug reports" value={openBugs} sub="feedback inbox" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Mood distribution (last 30d)</h2>
          <div className="space-y-2">
            {mood.map((m) => (
              <div key={m.bucket} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-slate-500">{m.bucket}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      m.tone === "green" ? "bg-emerald-400" : m.tone === "blue" ? "bg-brand-400" : m.tone === "amber" ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${m.pct * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-slate-400">{fmtPct(m.pct)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Counselor connections (rolling 30d)</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-2xl font-semibold text-amber-700">9</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-2xl font-semibold text-emerald-700">41</p>
              <p className="text-xs text-slate-500">Accepted</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-4">
              <p className="text-2xl font-semibold text-rose-700">6</p>
              <p className="text-xs text-slate-500">Declined</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Badge tone="blue">New subscribers 7d: +18</Badge>
            <Badge tone="amber">Cancelled 30d: 7</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DateRangePicker({ range, onChange }: { range: RangeKey; onChange: (r: RangeKey) => void }) {
  const presets: RangeKey[] = ["7d", "30d", "90d", "Custom"];
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-2 py-1 font-medium ${range === p ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
