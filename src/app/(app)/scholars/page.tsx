import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SCHOLAR_LABELS, SCHOLAR_STATUS_OPTIONS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Card, Empty, Notice, PageHeader, StatusBadge } from "@/components/ui";
import type { AcademicPeriod, ComplianceRecord, Scholar } from "@/lib/types";

export const metadata = { title: "Scholars" };

export default async function ScholarsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; period?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireRole("administrator", "scholarship_staff", "compliance", "disbursement");
  const canManage = ["administrator", "scholarship_staff"].includes(profile.role);

  const supabase = await createClient();

  let query = supabase.from("scholars").select("*").order("full_name", { ascending: true });
  if (params.q) {
    const term = params.q.replace(/[,%()]/g, " ").trim();
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,scholar_ref.ilike.%${term}%,school.ilike.%${term}%,program.ilike.%${term}%`);
    }
  }
  if (params.status && SCHOLAR_STATUS_OPTIONS.includes(params.status as Scholar["status"])) {
    query = query.eq("status", params.status);
  }

  const [scholarsResult, periodsResult] = await Promise.all([
    query.returns<Scholar[]>(),
    supabase.from("academic_periods").select("*").order("start_date", { ascending: false }).returns<AcademicPeriod[]>(),
  ]);

  const scholars = scholarsResult.data ?? [];
  const periods = periodsResult.data ?? [];
  const activePeriod = periods.find((period) => period.is_active) ?? periods[0] ?? null;

  let compliance: ComplianceRecord[] = [];
  if (activePeriod) {
    const { data } = await supabase
      .from("compliance_records")
      .select("*")
      .eq("period_id", activePeriod.id)
      .returns<ComplianceRecord[]>();
    compliance = data ?? [];
  }
  const complianceByScholar = new Map(compliance.map((row) => [row.scholar_id, row.status]));

  return (
    <div>
      <PageHeader
        title="Scholars"
        description={
          activePeriod
            ? `Active monitoring period: ${activePeriod.name} A.Y. ${activePeriod.school_year}.`
            : "No reporting period configured."
        }
        actions={
          canManage ? (
            <Link className="btn-primary" href="/scholars/new">
              Add scholar
            </Link>
          ) : undefined
        }
      />
      <Notice error={params.error} message={params.message} />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3 p-4" method="get">
          <label className="min-w-[240px] flex-1">
            <span className="label">Search</span>
            <input
              className="input"
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Name, scholar reference, school, or program"
            />
          </label>
          <label>
            <span className="label">Status</span>
            <select className="select" name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {SCHOLAR_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {SCHOLAR_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">Apply filters</button>
          <Link className="btn-secondary" href="/scholars">Reset</Link>
        </form>
      </Card>

      <Card>
        <div className="card-header">
          <p className="text-sm text-slate-500">
            {scholars.length} scholar record(s){params.q ? ` matching “${params.q}”` : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          {scholars.length === 0 ? (
            <div className="p-5">
              <Empty
                title="No scholar records found"
                description={canManage ? "Add a scholar record or adjust the filters." : "Adjust the search filters."}
              />
            </div>
          ) : (
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">Scholar</th>
                  <th className="th">School / program</th>
                  <th className="th">Year</th>
                  <th className="th">Status</th>
                  <th className="th">Compliance</th>
                  <th className="th">Created</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {scholars.map((scholar) => (
                  <tr key={scholar.id} className="row">
                    <td className="td">
                      <p className="font-medium text-slate-900">{scholar.full_name}</p>
                      <p className="text-xs text-slate-500">{scholar.scholar_ref}</p>
                    </td>
                    <td className="td">
                      <p>{scholar.school || "—"}</p>
                      <p className="text-xs text-slate-500">{scholar.program || "—"}</p>
                    </td>
                    <td className="td">{scholar.year_level || "—"}</td>
                    <td className="td"><StatusBadge kind="scholar" status={scholar.status} /></td>
                    <td className="td">
                      <StatusBadge kind="compliance" status={complianceByScholar.get(scholar.id) ?? "pending"} />
                    </td>
                    <td className="td text-slate-500">{formatDate(scholar.created_at)}</td>
                    <td className="td text-right">
                      <Link className="text-sm font-semibold text-brand-700 hover:underline" href={`/scholars/${scholar.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
