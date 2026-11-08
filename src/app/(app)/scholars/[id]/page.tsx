import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addRenderHours, deleteRenderHours, setSubmissionStatus, upsertCompliance } from "@/app/actions/compliance";
import { updateScholar } from "@/app/actions/scholars";
import { addDisbursement } from "@/app/actions/disbursements";
import {
  COMPLIANCE_STATUS_OPTIONS,
  DISBURSEMENT_STATUS_OPTIONS,
  REQUIREMENT_STATUS_OPTIONS,
  SCHOLAR_LABELS,
  SCHOLAR_STATUS_OPTIONS,
  DISBURSEMENT_LABELS,
} from "@/lib/constants";
import { computeRenderHourBalances } from "@/lib/render-hours";
import { formatCurrency, formatDate, formatDateTime, formatHours } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, Field, Notice, PageHeader, ProgressBar, Stat, StatusBadge } from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/submit-button";
import type {
  AcademicPeriod,
  ComplianceRecord,
  ConcernTicket,
  Disbursement,
  DocumentSubmission,
  ProgramSettings,
  RenderHourRecord,
  Requirement,
  Scholar,
} from "@/lib/types";

export default async function ScholarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; error?: string; message?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const profile = await requireRole("administrator", "scholarship_staff", "compliance", "disbursement");
  const supabase = await createClient();

  const { data: scholar } = await supabase.from("scholars").select("*").eq("id", id).maybeSingle<Scholar>();
  if (!scholar) notFound();

  const [periodsResult, settingsResult] = await Promise.all([
    supabase.from("academic_periods").select("*").order("start_date", { ascending: false }).returns<AcademicPeriod[]>(),
    supabase.from("program_settings").select("*").eq("id", 1).maybeSingle<ProgramSettings>(),
  ]);

  const periods = periodsResult.data ?? [];
  const settings = settingsResult.data ?? {
    required_render_hours: 100,
    carry_forward_enabled: true,
    deadline_warning_days: 30,
  };
  const selectedPeriod =
    periods.find((period) => period.id === sp.period) ??
    periods.find((period) => period.is_active) ??
    periods[0] ??
    null;

  const [requirementsResult, submissionsResult, complianceResult, renderResult, disbursementResult, concernResult] =
    await Promise.all([
      selectedPeriod
        ? supabase
            .from("requirements")
            .select("*")
            .eq("period_id", selectedPeriod.id)
            .order("name", { ascending: true })
            .returns<Requirement[]>()
        : Promise.resolve({ data: [] as Requirement[] }),
      supabase
        .from("document_submissions")
        .select("*")
        .eq("scholar_id", scholar.id)
        .returns<DocumentSubmission[]>(),
      selectedPeriod
        ? supabase
            .from("compliance_records")
            .select("*")
            .eq("scholar_id", scholar.id)
            .eq("period_id", selectedPeriod.id)
            .maybeSingle<ComplianceRecord>()
        : Promise.resolve({ data: null }),
      supabase.from("render_hour_records").select("*").eq("scholar_id", scholar.id).returns<RenderHourRecord[]>(),
      supabase
        .from("disbursements")
        .select("*")
        .eq("scholar_id", scholar.id)
        .order("status_date", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<Disbursement[]>(),
      supabase
        .from("concern_tickets")
        .select("*")
        .eq("scholar_id", scholar.id)
        .order("created_at", { ascending: false })
        .returns<ConcernTicket[]>(),
    ]);

  const requirements = requirementsResult.data ?? [];
  const submissions = submissionsResult.data ?? [];
  const submissionByRequirement = new Map(submissions.map((row) => [row.requirement_id, row]));
  const compliance = complianceResult.data ?? null;
  const renderRecords = renderResult.data ?? [];
  const disbursements = disbursementResult.data ?? [];
  const concerns = concernResult.data ?? [];

  const balances = computeRenderHourBalances({
    records: renderRecords,
    periods: [...periods].reverse(),
    requiredHours: settings.required_render_hours,
    carryForwardEnabled: settings.carry_forward_enabled,
  });
  const selectedBalance = selectedPeriod
    ? balances.find((balance) => balance.periodId === selectedPeriod.id) ?? null
    : null;
  const selectedRenderRecords = selectedPeriod
    ? renderRecords.filter((row) => row.period_id === selectedPeriod.id)
    : [];

  const unverified = requirements.filter((item) => submissionByRequirement.get(item.id)?.status !== "verified").length;
  const latestDisbursement = disbursements[0] ?? null;

  const canRecord = ["administrator", "scholarship_staff", "compliance"].includes(profile.role);
  const canEditProfile = ["administrator", "scholarship_staff"].includes(profile.role);
  const canDisburse = ["administrator", "disbursement"].includes(profile.role);

  return (
    <div>
      <PageHeader
        title={scholar.full_name}
        description={`${scholar.scholar_ref} · ${scholar.school ?? "No school"} · ${scholar.program ?? "No program"}`}
        actions={
          <>
            <Link className="btn-secondary" href="/scholars">Back to scholars</Link>
            <Link className="btn-secondary" href="/concerns">Concerns</Link>
          </>
        }
      />
      <Notice error={sp.error} message={sp.message} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Render hours"
          value={`${formatHours(selectedBalance?.applied ?? 0)} / ${settings.required_render_hours}`}
          hint={`${formatHours(selectedBalance?.remaining ?? settings.required_render_hours)} remaining`}
        />
        <Stat label="Unverified requirements" value={unverified} hint={`${requirements.length} requirement(s) this period`} />
        <Stat
          label="Compliance"
          value={<StatusBadge kind="compliance" status={compliance?.status ?? "pending"} />}
          hint={selectedPeriod ? selectedPeriod.name : "No period selected"}
        />
        <Stat
          label="Latest disbursement"
          value={latestDisbursement ? DISBURSEMENT_LABELS[latestDisbursement.status] : "—"}
          hint={latestDisbursement ? formatDate(latestDisbursement.status_date) : "No status recorded"}
        />
      </div>

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
          <button type="submit" className="btn-secondary">View period</button>
          <span className="ml-auto text-sm text-slate-500">
            Scholar status: <StatusBadge kind="scholar" status={scholar.status} />
          </span>
        </form>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Requirements and document verification"
            description="Physical submission and authenticity checks remain office procedures. This records their outcome."
          />
          <div className="overflow-x-auto">
            {requirements.length === 0 ? (
              <div className="p-5">
                <Empty title="No requirements defined for this period" description="Add requirements under the Requirements page." />
              </div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Requirement</th>
                    <th className="th">Current status</th>
                    <th className="th">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((requirement) => {
                    const submission = submissionByRequirement.get(requirement.id);
                    return (
                      <tr key={requirement.id} className="row">
                        <td className="td">
                          <p className="font-medium text-slate-800">{requirement.name}</p>
                          {requirement.description ? (
                            <p className="text-xs text-slate-500">{requirement.description}</p>
                          ) : null}
                          {submission?.remarks ? (
                            <p className="mt-1 text-xs text-amber-700">Remarks: {submission.remarks}</p>
                          ) : null}
                        </td>
                        <td className="td">
                          <StatusBadge kind="requirement" status={submission?.status ?? "pending"} />
                          {submission?.verified_at ? (
                            <p className="mt-1 text-xs text-slate-500">{formatDate(submission.verified_at)}</p>
                          ) : null}
                        </td>
                        <td className="td">
                          {canRecord ? (
                            <form action={setSubmissionStatus} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="scholar_id" value={scholar.id} />
                              <input type="hidden" name="requirement_id" value={requirement.id} />
                              <input type="hidden" name="period_id" value={selectedPeriod?.id ?? ""} />
                              <select className="select w-32" name="status" defaultValue={submission?.status ?? "pending"}>
                                {REQUIREMENT_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input w-44"
                                name="remarks"
                                placeholder="Remarks"
                                defaultValue={submission?.remarks ?? ""}
                              />
                              <SubmitButton className="btn-secondary" pendingText="Saving…">Save</SubmitButton>
                            </form>
                          ) : (
                            <span className="text-sm text-slate-500">{submission?.remarks || "—"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Compliance status" description="Official status recorded by authorized staff." />
          <form action={upsertCompliance} className="card-body space-y-3">
            <input type="hidden" name="scholar_id" value={scholar.id} />
            <input type="hidden" name="period_id" value={selectedPeriod?.id ?? ""} />
            <Field label="Status">
              <select className="select" name="status" defaultValue={compliance?.status ?? "pending"}>
                {COMPLIANCE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "non_compliant" ? "Non-compliant" : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Remarks">
              <textarea className="textarea" name="remarks" defaultValue={compliance?.remarks ?? ""} />
            </Field>
            {canRecord ? (
              <div className="flex justify-end">
                <SubmitButton pendingText="Saving…">Save compliance</SubmitButton>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Only compliance personnel, scholarship staff, or an administrator can update this.</p>
            )}
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Render hours"
          description={`${selectedPeriod ? `${selectedPeriod.name} A.Y. ${selectedPeriod.school_year}` : "Selected period"} — carry-forward is computed from the approved rule.`}
        />
        <div className="card-body">
          {selectedBalance ? (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {formatHours(selectedBalance.applied)} of {selectedBalance.required} hours applied
                </span>
                <span className="text-slate-500">
                  Carried in {formatHours(selectedBalance.carryIn)} · Carried out {formatHours(selectedBalance.carryOut)}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar value={selectedBalance.applied} max={selectedBalance.required} />
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            {selectedRenderRecords.length === 0 ? (
              <Empty title="No render hours recorded for this period" />
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Activity</th>
                    <th className="th">Hours</th>
                    <th className="th">Remarks</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody>
                  {selectedRenderRecords.map((record) => (
                    <tr key={record.id} className="row">
                      <td className="td whitespace-nowrap text-slate-500">{formatDate(record.created_at)}</td>
                      <td className="td font-medium text-slate-800">{record.activity}</td>
                      <td className="td">{formatHours(record.hours)}</td>
                      <td className="td text-slate-500">{record.remarks || "—"}</td>
                      <td className="td text-right">
                        {canRecord ? (
                          <form action={deleteRenderHours}>
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="scholar_id" value={scholar.id} />
                            <input type="hidden" name="period_id" value={selectedPeriod?.id ?? ""} />
                            <ConfirmSubmitButton className="btn-ghost text-rose-600" confirmMessage="Remove this render-hour entry?">
                              Remove
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {canRecord && selectedPeriod ? (
            <form action={addRenderHours} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
              <input type="hidden" name="scholar_id" value={scholar.id} />
              <input type="hidden" name="period_id" value={selectedPeriod.id} />
              <Field label="Activity" className="sm:col-span-2">
                <input className="input" name="activity" placeholder="Community or office service" required />
              </Field>
              <Field label="Hours">
                <input className="input" type="number" name="hours" min="0.25" step="0.25" required />
              </Field>
              <Field label="Remarks">
                <input className="input" name="remarks" />
              </Field>
              <div className="sm:col-span-4 flex justify-end">
                <SubmitButton pendingText="Recording…">Record render hours</SubmitButton>
              </div>
            </form>
          ) : null}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Render-hour balance history" description="Computed across all recorded periods." />
          <div className="overflow-x-auto">
            {balances.length === 0 ? (
              <div className="p-5"><Empty title="No periods configured" /></div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Period</th>
                    <th className="th">Carried in</th>
                    <th className="th">Earned</th>
                    <th className="th">Applied</th>
                    <th className="th">Carried out</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((balance) => (
                    <tr key={balance.periodId} className="row">
                      <td className="td">
                        <p className="font-medium text-slate-800">{balance.periodName}</p>
                        <p className="text-xs text-slate-500">A.Y. {balance.schoolYear}</p>
                      </td>
                      <td className="td">{formatHours(balance.carryIn)}</td>
                      <td className="td">{formatHours(balance.earned)}</td>
                      <td className="td">{formatHours(balance.applied)}</td>
                      <td className="td">{formatHours(balance.carryOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Disbursement history"
            description="Reported status only. Amounts are informational when provided."
          />
          <div className="card-body">
            {disbursements.length === 0 ? (
              <Empty title="No disbursement updates recorded" />
            ) : (
              <ol className="mb-4 space-y-3">
                {disbursements.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{row.benefit_type}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(row.status_date)}
                        {row.amount ? ` · ${formatCurrency(row.amount)}` : ""}
                        {row.reference ? ` · Ref ${row.reference}` : ""}
                      </p>
                      {row.remarks ? <p className="text-xs text-slate-500">{row.remarks}</p> : null}
                    </div>
                    <StatusBadge kind="disbursement" status={row.status} />
                  </li>
                ))}
              </ol>
            )}

            {canDisburse && selectedPeriod ? (
              <form action={addDisbursement} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <input type="hidden" name="scholar_id" value={scholar.id} />
                <input type="hidden" name="period_id" value={selectedPeriod.id} />
                <Field label="Benefit type">
                  <input className="input" name="benefit_type" defaultValue="Allowance" required />
                </Field>
                <Field label="Amount (optional)">
                  <input className="input" type="number" name="amount" min="0" step="0.01" />
                </Field>
                <Field label="Status">
                  <select className="select" name="status" defaultValue="pending">
                    {DISBURSEMENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{DISBURSEMENT_LABELS[status]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status date">
                  <input className="input" type="date" name="status_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </Field>
                <Field label="Reference">
                  <input className="input" name="reference" />
                </Field>
                <Field label="Remarks">
                  <input className="input" name="remarks" />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <SubmitButton pendingText="Recording…">Record status update</SubmitButton>
                </div>
              </form>
            ) : !canDisburse ? (
              <p className="text-xs text-slate-500">
                Disbursement updates are recorded by disbursement personnel or an administrator.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Concerns" description="Concern tickets linked to this scholar." />
        <div className="card-body">
          {concerns.length === 0 ? (
            <Empty title="No concern tickets" description="Concerns submitted by the scholar will appear here." />
          ) : (
            <ul className="space-y-2">
              {concerns.map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div>
                    <Link className="text-sm font-medium text-brand-700 hover:underline" href={`/concerns/${ticket.id}`}>
                      {ticket.subject}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {ticket.ticket_no} · {formatDateTime(ticket.created_at)}
                    </p>
                  </div>
                  <StatusBadge kind="concern" status={ticket.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Scholar record" description="Profile details used across monitoring reports." />
        {canEditProfile ? (
          <details className="card-body">
            <summary className="cursor-pointer text-sm font-semibold text-brand-700">Edit scholar details</summary>
            <form action={updateScholar} className="mt-4 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={scholar.id} />
              <Field label="Full name" className="sm:col-span-2">
                <input className="input" name="full_name" defaultValue={scholar.full_name} required />
              </Field>
              <Field label="Email">
                <input className="input" type="email" name="email" defaultValue={scholar.email ?? ""} />
              </Field>
              <Field label="Contact number">
                <input className="input" name="contact_number" defaultValue={scholar.contact_number ?? ""} />
              </Field>
              <Field label="School">
                <input className="input" name="school" defaultValue={scholar.school ?? ""} required />
              </Field>
              <Field label="Program">
                <input className="input" name="program" defaultValue={scholar.program ?? ""} required />
              </Field>
              <Field label="Year level">
                <input className="input" name="year_level" defaultValue={scholar.year_level ?? ""} required />
              </Field>
              <Field label="Status">
                <select className="select" name="status" defaultValue={scholar.status}>
                  {SCHOLAR_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{SCHOLAR_LABELS[status]}</option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <SubmitButton pendingText="Saving…">Save scholar details</SubmitButton>
              </div>
            </form>
          </details>
        ) : (
          <div className="card-body">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-800">{scholar.email || "—"}</dd></div>
              <div><dt className="text-slate-500">Contact</dt><dd className="font-medium text-slate-800">{scholar.contact_number || "—"}</dd></div>
              <div><dt className="text-slate-500">School</dt><dd className="font-medium text-slate-800">{scholar.school || "—"}</dd></div>
              <div><dt className="text-slate-500">Program</dt><dd className="font-medium text-slate-800">{scholar.program || "—"}</dd></div>
              <div><dt className="text-slate-500">Year level</dt><dd className="font-medium text-slate-800">{scholar.year_level || "—"}</dd></div>
              <div><dt className="text-slate-500">Linked account</dt><dd className="font-medium text-slate-800">{scholar.profile_id ? "Linked" : "Not linked"}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Only scholarship staff or an administrator can edit scholar details.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
