import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_LABELS,
  COMPLIANCE_LABELS,
  CONCERN_LABELS,
  DISBURSEMENT_LABELS,
  REQUIREMENT_LABELS,
  SCHOLAR_LABELS,
} from "@/lib/constants";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

type Tone = "green" | "amber" | "red" | "blue" | "slate" | "purple";

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export type StatusKind =
  | "account"
  | "scholar"
  | "requirement"
  | "compliance"
  | "disbursement"
  | "concern";

const statusConfig: Record<
  StatusKind,
  { labels: Record<string, string>; tones: Record<string, Tone> }
> = {
  account: {
    labels: ACCOUNT_LABELS,
    tones: { pending: "amber", active: "green", disabled: "red" },
  },
  scholar: {
    labels: SCHOLAR_LABELS,
    tones: { active: "green", inactive: "slate", graduated: "blue" },
  },
  requirement: {
    labels: REQUIREMENT_LABELS,
    tones: { pending: "amber", submitted: "blue", verified: "green", rejected: "red" },
  },
  compliance: {
    labels: COMPLIANCE_LABELS,
    tones: { pending: "amber", compliant: "green", non_compliant: "red" },
  },
  disbursement: {
    labels: DISBURSEMENT_LABELS,
    tones: { pending: "amber", processing: "blue", released: "green", on_hold: "slate" },
  },
  concern: {
    labels: CONCERN_LABELS,
    tones: { open: "amber", in_progress: "blue", resolved: "green" },
  },
};

export function StatusBadge({ kind, status }: { kind: StatusKind; status: string }) {
  const config = statusConfig[kind];
  const label = config.labels[status] ?? status;
  const tone = config.tones[status] ?? "slate";
  return <Badge tone={tone}>{label}</Badge>;
}

export function Notice({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <div
      className={cn(
        "mb-4 rounded-lg border px-4 py-3 text-sm",
        error
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
      role={error ? "alert" : "status"}
    >
      {error ?? message}
    </div>
  );
}

export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-brand-500")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
