import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeRenderHourBalances } from "@/lib/render-hours";
import { daysUntil, formatDate, formatHours } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, Notice, PageHeader, ProgressBar, Stat, StatusBadge } from "@/components/ui";
import type {
  AcademicPeriod,
  AppNotification,
  ComplianceRecord,
  ConcernTicket,
  Disbursement,
  DocumentSubmission,
  ProgramSettings,
  RenderHourRecord,
  Requirement,
  Scholar,
} from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [settingsResult, periodsResult] = await Promise.all([
    supabase.from("program_settings").select("*").eq("id", 1).maybeSingle<ProgramSettings>(),
    supabase.from("academic_periods").select("*").order("start_date", { ascending: true }).returns<AcademicPeriod[]>(),
  ]);

  const settings: ProgramSettings = settingsResult.data ?? {
    id: 1,
    required_render_hours: 100,
    carry_forward_enabled: true,
    deadline_warning_days: 30,
    updated_at: new Date().toISOString(),
  };
  const periods = periodsResult.data ?? [];
  const activePeriod = periods.find((period) => period.is_active) ?? null;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile.full_name || profile.email}`}
        description={
          activePeriod
            ? `Active reporting period: ${activePeriod.name} A.Y. ${activePeriod.school_year} (ends ${formatDate(activePeriod.end_date)}).`
            : "No active reporting period is configured yet."
        }
      />
      <Notice error={params.error} message={params.message} />

      {profile.role === "scholar" ? (
        <ScholarDashboard
          profileId={profile.id}
          settings={settings}
          periods={periods}
          activePeriod={activePeriod}
        />
      ) : (
        <StaffDashboard
          settings={settings}
          periods={periods}
          activePeriod={activePeriod}
          role={profile.role}
        />
      )}
    </div>
  );
}

async function ScholarDashboard({
  profileId,
  settings,
  periods,
  activePeriod,
}: {
  profileId: string;
  settings: ProgramSettings;
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod | null;
}) {
  const supabase = await createClient();
  const { data: scholar } = await supabase
    .from("scholars")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle<Scholar>();

  if (!scholar) {
    return (
      <Empty
        title="No scholar record is linked to your account yet"
        description="The scholarship office will link and activate your scholar record. Please contact the office if this takes longer than expected."
      />
    );
  }

  const [renderResult, complianceResult, disbursementResult, submissionResult, concernResult, notificationResult] =
    await Promise.all([
      supabase.from("render_hour_records").select("*").eq("scholar_id", scholar.id).returns<RenderHourRecord[]>(),
      activePeriod
        ? supabase
            .from("compliance_records")
            .select("*")
            .eq("scholar_id", scholar.id)
            .eq("period_id", activePeriod.id)
            .maybeSingle<ComplianceRecord>()
        : Promise.resolve({ data: null }),
      supabase
        .from("disbursements")
        .select("*")
        .eq("scholar_id", scholar.id)
        .order("status_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6)
        .returns<Disbursement[]>(),
      supabase
        .from("document_submissions")
        .select("*, requirement:requirements(*)")
        .eq("scholar_id", scholar.id)
        .returns<Array<DocumentSubmission & { requirement: Requirement | null }>>(),
      supabase
        .from("concern_tickets")
        .select("*")
        .eq("scholar_id", scholar.id)
        .neq("status", "resolved")
        .returns<ConcernTicket[]>(),
      supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", profileId)
        .eq("status", "unread")
        .order("created_at", { ascending: false })
        .limit(4)
        .returns<AppNotification[]>(),
    ]);

  const balances = computeRenderHourBalances({
    records: renderResult.data ?? [],
    periods,
    requiredHours: settings.required_render_hours,
    carryForwardEnabled: settings.carry_forward_enabled,
  });
  const current = activePeriod
    ? balances.find((balance) => balance.periodId === activePeriod.id) ?? null
    : balances[balances.length - 1] ?? null;

  const submissions = (submissionResult.data ?? []).filter(
    (row) => row.requirement && row.requirement.period_id === activePeriod?.id,
  );
  const verifiedCount = submissions.filter((row) => row.status === "verified").length;
  const disbursements = disbursementResult.data ?? [];
  const latestDisbursement = disbursements[0] ?? null;
  const openConcerns = concernResult.data ?? [];
  const notifications = notificationResult.data ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Render hours"
          value={`${formatHours(current?.applied ?? 0)} / ${settings.required_render_hours}`}
          hint={current?.met ? "Requirement met for this period" : `${formatHours(current?.remaining ?? settings.required_render_hours)} hour(s) remaining`}
        />
        <Stat
          label="Requirements verified"
          value={`${verifiedCount} / ${submissions.length}`}
          hint={activePeriod ? `For ${activePeriod.name}` : "No active period"}
        />
        <Stat
          label="Compliance"
          value={<StatusBadge kind="compliance" status={complianceResult.data?.status ?? "pending"} />}
          hint="Recorded by authorized staff"
        />
        <Stat
          label="Open concerns"
          value={openConcerns.length}
          hint="Concern tickets not yet resolved"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Render-hour balance"
            description="Hours are computed with the office-approved carry-forward rule."
          />
          <div className="card-body">
            {current ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {current.periodName} A.Y. {current.schoolYear}
                  </span>
                  <span className="text-slate-500">
                    {formatHours(current.applied)} of {current.required} hours
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={current.applied} max={current.required} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Carried in</dt>
                    <dd className="font-semibold text-slate-800">{formatHours(current.carryIn)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Earned this term</dt>
                    <dd className="font-semibold text-slate-800">{formatHours(current.earned)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Carried out</dt>
                    <dd className="font-semibold text-slate-800">{formatHours(current.carryOut)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Remaining</dt>
                    <dd className="font-semibold text-slate-800">{formatHours(current.remaining)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <Empty title="No render-hour record yet" description="Recorded hours will appear here once staff log them." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Unread notifications" />
          <div className="card-body space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No unread notifications.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{notification.message}</p>
                </div>
              ))
            )}
            <Link className="text-sm font-semibold text-brand-700 hover:underline" href="/notifications">
              View all notifications →
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Requirements for the active period"
            description={activePeriod ? `${activePeriod.name} A.Y. ${activePeriod.school_year}` : undefined}
            actions={
              <Link className="btn-secondary" href="/concerns">
                My concerns
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {submissions.length === 0 ? (
              <div className="p-5">
                <Empty title="No requirements recorded" description="Requirements defined by the office will appear here." />
              </div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Requirement</th>
                    <th className="th">Status</th>
                    <th className="th">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((row) => (
                    <tr key={row.id} className="row">
                      <td className="td font-medium text-slate-800">{row.requirement?.name}</td>
                      <td className="td"><StatusBadge kind="requirement" status={row.status} /></td>
                      <td className="td text-slate-500">{row.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Disbursement status"
            description="Reported status only. Actual fund release follows the LGU financial process."
          />
          <div className="card-body">
            {latestDisbursement ? (
              <div className="mb-4 rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">Latest status</span>
                  <StatusBadge kind="disbursement" status={latestDisbursement.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {latestDisbursement.benefit_type} · {formatDate(latestDisbursement.status_date)}
                  {latestDisbursement.reference ? ` · Ref ${latestDisbursement.reference}` : ""}
                </p>
              </div>
            ) : null}
            {disbursements.length === 0 ? (
              <Empty title="No disbursement updates yet" />
            ) : (
              <ol className="space-y-3">
                {disbursements.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{row.benefit_type}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(row.status_date)}
                        {row.reference ? ` · Ref ${row.reference}` : ""}
                      </p>
                    </div>
                    <StatusBadge kind="disbursement" status={row.status} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

async function StaffDashboard({
  settings,
  periods,
  activePeriod,
  role,
}: {
  settings: ProgramSettings;
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod | null;
  role: string;
}) {
  const supabase = await createClient();

  const [scholarsResult, pendingResult, concernsResult, complianceResult, renderResult, submissionsResult, requirementsResult] =
    await Promise.all([
      supabase.from("scholars").select("*").eq("status", "active").returns<Scholar[]>(),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("concern_tickets")
        .select("*")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .returns<ConcernTicket[]>(),
      activePeriod
        ? supabase.from("compliance_records").select("*").eq("period_id", activePeriod.id).returns<ComplianceRecord[]>()
        : Promise.resolve({ data: [] as ComplianceRecord[] }),
      supabase.from("render_hour_records").select("*").returns<RenderHourRecord[]>(),
      activePeriod
        ? supabase
            .from("document_submissions")
            .select("*, requirement:requirements!inner(period_id, is_active)")
            .eq("requirements.period_id", activePeriod.id)
            .returns<Array<DocumentSubmission & { requirement: { period_id: string; is_active: boolean } }>>()
        : Promise.resolve({ data: [] as Array<DocumentSubmission & { requirement: { period_id: string; is_active: boolean } }> }),
      activePeriod
        ? supabase
            .from("requirements")
            .select("*")
            .eq("period_id", activePeriod.id)
            .eq("is_active", true)
            .returns<Requirement[]>()
        : Promise.resolve({ data: [] as Requirement[] }),
    ]);

  const scholars = scholarsResult.data ?? [];
  const pendingCount = pendingResult.count ?? 0;
  const concerns = concernsResult.data ?? [];
  const compliance = complianceResult.data ?? [];
  const requirements = requirementsResult.data ?? [];
  const submissions = submissionsResult.data ?? [];

  const compliantCount = compliance.filter((row) => row.status === "compliant").length;
  const nonCompliantCount = compliance.filter((row) => row.status === "non_compliant").length;

  const renderByScholar = new Map<string, RenderHourRecord[]>();
  for (const record of renderResult.data ?? []) {
    const list = renderByScholar.get(record.scholar_id) ?? [];
    list.push(record);
    renderByScholar.set(record.scholar_id, list);
  }

  const verifiedByScholar = new Map<string, Set<string>>();
  for (const row of submissions) {
    if (row.status !== "verified") continue;
    const set = verifiedByScholar.get(row.scholar_id) ?? new Set<string>();
    set.add(row.requirement_id);
    verifiedByScholar.set(row.scholar_id, set);
  }

  const complianceByScholar = new Map(compliance.map((row) => [row.scholar_id, row]));
  const daysLeft = daysUntil(activePeriod?.end_date);

  const flags = scholars
    .map((scholar) => {
      const balances = computeRenderHourBalances({
        records: renderByScholar.get(scholar.id) ?? [],
        periods,
        requiredHours: settings.required_render_hours,
        carryForwardEnabled: settings.carry_forward_enabled,
      });
      const balance = activePeriod
        ? balances.find((item) => item.periodId === activePeriod.id) ?? null
        : balances[balances.length - 1] ?? null;
      const verified = verifiedByScholar.get(scholar.id) ?? new Set<string>();
      const missing = requirements.filter((item) => !verified.has(item.id)).length;
      const complianceStatus = complianceByScholar.get(scholar.id)?.status ?? "pending";
      return {
        scholar,
        remaining: balance?.remaining ?? settings.required_render_hours,
        missing,
        complianceStatus,
      };
    })
    .filter((row) => row.remaining > 0 || row.missing > 0 || row.complianceStatus !== "compliant")
    .sort((a, b) => b.remaining + b.missing * 10 - (a.remaining + a.missing * 10));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active scholars" value={scholars.length} hint="Linked and active scholar records" />
        <Stat label="Pending accounts" value={pendingCount} hint="Awaiting administrator approval" />
        <Stat label="Open concerns" value={concerns.length} hint="Tickets not yet resolved" />
        <Stat
          label="Compliance this period"
          value={`${compliantCount} compliant`}
          hint={`${nonCompliantCount} non-compliant · ${Math.max(compliance.length - compliantCount - nonCompliantCount, 0)} pending`}
        />
      </div>

      {activePeriod ? (
        <Card>
          <div className="card-body flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {activePeriod.name} A.Y. {activePeriod.school_year}
              </p>
              <p className="text-sm text-slate-500">
                {formatDate(activePeriod.start_date)} – {formatDate(activePeriod.end_date)}
                {daysLeft !== null
                  ? ` · ${daysLeft >= 0 ? `${daysLeft} day(s) until the deadline` : `${Math.abs(daysLeft)} day(s) past the deadline`}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={daysLeft !== null && daysLeft <= settings.deadline_warning_days ? "amber" : "slate"}>
                Deadline warning: {settings.deadline_warning_days} days
              </Badge>
              <Link className="btn-secondary" href="/reports">
                Open reports
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Scholars needing follow-up"
            description="Derived from render-hour balance, unverified requirements, and recorded compliance status."
            actions={
              <Link className="btn-secondary" href="/scholars">
                View scholars
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {flags.length === 0 ? (
              <div className="p-5">
                <Empty title="No scholars currently flagged" description="All active scholars meet the recorded checks for this period." />
              </div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Scholar</th>
                    <th className="th">Hours remaining</th>
                    <th className="th">Unverified requirements</th>
                    <th className="th">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.slice(0, 8).map((row) => (
                    <tr key={row.scholar.id} className="row">
                      <td className="td">
                        <Link className="font-medium text-brand-700 hover:underline" href={`/scholars/${row.scholar.id}`}>
                          {row.scholar.full_name}
                        </Link>
                        <p className="text-xs text-slate-500">{row.scholar.scholar_ref}</p>
                      </td>
                      <td className="td">{formatHours(row.remaining)}</td>
                      <td className="td">{row.missing}</td>
                      <td className="td"><StatusBadge kind="compliance" status={row.complianceStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent concerns"
            actions={
              <Link className="text-sm font-semibold text-brand-700 hover:underline" href="/concerns">
                All
              </Link>
            }
          />
          <div className="card-body space-y-3">
            {concerns.length === 0 ? (
              <p className="text-sm text-slate-500">No open concern tickets.</p>
            ) : (
              concerns.slice(0, 5).map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/concerns/${ticket.id}`}
                  className="block rounded-lg border border-slate-200 p-3 hover:border-brand-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{ticket.subject}</p>
                    <StatusBadge kind="concern" status={ticket.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{ticket.ticket_no}</p>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {role === "administrator" && pendingCount > 0 ? (
        <Card>
          <div className="card-body flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {pendingCount} account(s) are waiting for approval.
            </p>
            <Link className="btn-primary" href="/admin/users">
              Review accounts
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
