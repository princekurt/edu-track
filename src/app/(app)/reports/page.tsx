import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildReportData, isReportType, type ReportType } from "@/lib/reports";
import { Card, Empty, Notice, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import type { AcademicPeriod } from "@/lib/types";

export const metadata = { title: "Reports" };

const TABS: Array<{ type: ReportType; label: string }> = [
  { type: "compliance", label: "Compliance" },
  { type: "render", label: "Render hours" },
  { type: "disbursement", label: "Disbursements" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; period?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  await requireRole("administrator", "scholarship_staff", "compliance", "disbursement");
  const supabase = await createClient();

  const { data: periodsData } = await supabase
    .from("academic_periods")
    .select("*")
    .order("start_date", { ascending: false })
    .returns<AcademicPeriod[]>();
  const periods = periodsData ?? [];

  const type: ReportType = isReportType(params.type) ? params.type : "compliance";
  const data = await buildReportData(supabase, type, params.period);

  return (
    <div>
      <PageHeader
        title="Monitoring reports"
        description="Generate compliance, render-hour, and disbursement reports that reconcile with the stored records for the selected period."
        actions={
          data ? (
            <>
              <PrintButton label="Print report" />
              <a className="btn-secondary no-print" href={`/api/reports/${type}?period=${params.period ?? ""}`}>
                Download CSV
              </a>
            </>
          ) : undefined
        }
      />
      <Notice error={params.error} message={params.message} />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.type}
            href={`/reports?type=${tab.type}${params.period ? `&period=${params.period}` : ""}`}
            className={tab.type === type ? "btn-primary" : "btn-secondary"}
          >
            {tab.label}
          </Link>
        ))}
        <form method="get" className="ml-auto flex items-end gap-2">
          <input type="hidden" name="type" value={type} />
          <label>
            <span className="label">Reporting period</span>
            <select className="select min-w-[240px]" name="period" defaultValue={params.period ?? ""}>
              <option value="">Active period</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} A.Y. {period.school_year}{period.is_active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-secondary">View</button>
        </form>
      </div>

      {!data ? (
        <Empty title="No reporting period available" description="Create and activate a reporting period first." />
      ) : (
        <div className="card print-area p-6">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">EduTrack · EduKar Scholarship Program</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{data.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{data.periodLabel}</p>
            <p className="mt-1 text-xs text-slate-400">Generated {data.generatedAt}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.summary.map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="table">
              <thead className="thead">
                <tr>
                  {data.headers.map((header) => (
                    <th key={header} className="th">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td className="td text-slate-500" colSpan={data.headers.length}>
                      No records for this period.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, index) => (
                    <tr key={index} className="row">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="td">{cell}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Reports reflect recorded system data only. They do not authorize fund release or replace official office records.
      </p>
    </div>
  );
}
