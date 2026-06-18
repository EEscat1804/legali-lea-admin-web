// Shared presentational components. Keep these dumb and reusable — feature
// pages compose them. Styling is Tailwind; no external UI lib so the bundle
// stays small (PRD §5 performance).

import { type ReactNode } from "react";

export function PageHeader({ title, prd, description, actions }: { title: string; prd?: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {prd && <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">PRD {prd}</span>}
        </div>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-brand-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700",
  blue: "bg-brand-100 text-brand-700",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const base = "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    // Lea primaryGradient (#F0AAAA→#EC9191) with warm-ink text (onPrimary).
    primary: "bg-gradient-to-b from-brand-400 to-brand-500 text-lea-ink shadow-sm hover:brightness-95",
    secondary: "border border-brand-200 bg-white text-slate-700 hover:bg-brand-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-slate-600 hover:bg-brand-50",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-brand-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-brand-200 bg-white/50 p-8 text-center text-sm text-slate-500">{children}</div>;
}

// ── Table primitives ────────────────────────────────────────────────────────
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function Thead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-brand-100 bg-brand-50/60 text-xs uppercase tracking-wide text-brand-700/80">{children}</thead>;
}
export function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={`border-b border-brand-50 last:border-0 ${onClick ? "cursor-pointer hover:bg-brand-50/50" : ""}`}>
      {children}
    </tr>
  );
}
export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 text-slate-700 ${className}`}>{children}</td>;
}

// A standard banner reminding reviewers the data is mocked.
export function ScaffoldNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <span className="font-semibold">Scaffold:</span> {children}
    </div>
  );
}
