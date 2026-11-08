import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDisbursement } from "@/app/actions/disbursements";
import { DISBURSEMENT_LABELS, DISBURSEMENT_STATUS_OPTIONS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, Empty, Field, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { AcademicPeriod, Disbursement, Scholar } from "@/lib/types";

export const metadata = { title: "Disbursements" };

type DisbursementRow = Disbursement & {
  scholar: { full_name: string; scholar_ref: string } | null;
  period: { name: string; school_year: string } | null;
};

export default async function DisbursementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; scholar?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireRole("administrator", "scholarship_staff", "compliance", "disbursement");
  const canRecord = ["administrator", "disbursement"].includes(profile.role);

  const supabase = await createClient();
  const [periodsResult, scholarsResult] = await Promise.all([
    supabase.from("academic_periods").select("*").order("start_date", { ascending: false }).returns<AcademicPeriod[]>(),
    supabase.from("scholars").select("id, full_name, scholar_ref, status").eq("status", "active").order("full_name").returns<Scholar[]>(),
  ]);
  const periods = periodsResult.data ?? [];
  const scholars = scholarsResult.data ?? [];
  const selectedPeriod =
    periods.find((period) => period.id === params.period) ??
    periods.find((period) => period.is_active) ??
    periods[0] ??
    null;

  let query = supabase
    .from("disbursements")
    .select("*, scholar:scholars(full_name, scholar_ref), period:academic_periods(name, school_year)")
    .order("status_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (selectedPeriod) query = query.eq("period_id", selectedPeriod.id);
  if (params.status && DISBURSEMENT_STATUS_OPTIONS.includes(params.status as Disbursement["status"])) {
    query = query.eq("status", params.status);
  }
  if (params.scholar) query = query.eq("scholar_id", params.scholar);

  const { data } = await query.returns<DisbursementRow[]>();
  const rows = data ?? [];

  return (
    <div>
      <PageHeader
        title="Disbursements"
        description="Reported disbursement status and history. This system does not transfer funds; actual release follows the LGU financial process."
      />
      <Notice error={params.error} message={params.message} />

      <Card className="mb-6">
        <form method="get" className="card-body flex flex-wrap items-end gap-3">
          <Field label="Reporting period">
            <select className="select" name="period" defaultValue={selectedPeriod?.id ?? ""}>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} A.Y. {period.school_year}{period.is_active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="select" name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {DISBURSEMENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{DISBURSEMENT_LABELS[status]}</option>
              ))}
            </select>
          </Field>
          <Field label="Scholar">
            <select className="select" name="scholar" defaultValue={params.scholar ?? ""}>
              <option value="">All scholars</option>
              {scholars.map((scholar) => (
                <option key={scholar.id} value={scholar.id}>{scholar.full_name}</option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn-secondary">Apply</button>
          <Link className="btn-ghost" href="/disbursements">Reset</Link>
        </form>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Disbursement status history"
            description={`${rows.length} status update(s) recorded${selectedPeriod ? ` for ${selectedPeriod.name}` : ""}.`}
          />
          <div className="overflow-x-auto">
            {rows.length === 0 ? (
              <div className="p-5">
                <Empty title="No disbursement updates" description="Status updates recorded by disbursement personnel will appear here." />
              </div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Scholar</th>
                    <th className="th">Benefit</th>
                    <th className="th">Status</th>
                    <th className="th">Status date</th>
                    <th className="th">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="row">
                      <td className="td">
                        <Link className="font-medium text-brand-700 hover:underline" href={`/scholars/${row.scholar_id}`}>
                          {row.scholar?.full_name ?? "Unknown scholar"}
                        </Link>
                        <p className="text-xs text-slate-500">{row.scholar?.scholar_ref}</p>
                      </td>
                      <td className="td">
                        <p>{row.benefit_type}</p>
                        {row.amount ? <p className="text-xs text-slate-500">{formatCurrency(row.amount)}</p> : null}
                      </td>
                      <td className="td"><StatusBadge kind="disbursement" status={row.status} /></td>
                      <td className="td text-slate-500">{formatDate(row.status_date)}</td>
                      <td className="td text-slate-500">{row.reference || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Record status update"
            description={canRecord ? "Append a new status entry to the scholar's history." : "Only disbursement personnel or an administrator can record updates."}
          />
          {canRecord && selectedPeriod ? (
            <form action={addDisbursement} className="card-body space-y-3">
              <input type="hidden" name="period_id" value={selectedPeriod.id} />
              <Field label="Scholar">
                <select className="select" name="scholar_id" required defaultValue="">
                  <option value="" disabled>Select a scholar</option>
                  {scholars.map((scholar) => (
                    <option key={scholar.id} value={scholar.id}>
                      {scholar.full_name} ({scholar.scholar_ref})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Benefit type">
                <input className="input" name="benefit_type" defaultValue="Allowance" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (optional)">
                  <input className="input" type="number" name="amount" min="0" step="0.01" />
                </Field>
                <Field label="Status date">
                  <input className="input" type="date" name="status_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </Field>
              </div>
              <Field label="Status">
                <select className="select" name="status" defaultValue="pending">
                  {DISBURSEMENT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{DISBURSEMENT_LABELS[status]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Reference">
                <input className="input" name="reference" placeholder="DV number or tracking reference" />
              </Field>
              <Field label="Remarks">
                <input className="input" name="remarks" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton pendingText="Recording…">Record status</SubmitButton>
              </div>
            </form>
          ) : !selectedPeriod ? (
            <div className="card-body"><Empty title="No reporting period configured" /></div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
