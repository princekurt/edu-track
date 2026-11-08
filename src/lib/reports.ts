import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPLIANCE_LABELS,
  DISBURSEMENT_LABELS,
} from "./constants";
import { computeRenderHourBalances } from "./render-hours";
import { formatDate, formatHours } from "./utils";
import type {
  AcademicPeriod,
  ComplianceRecord,
  Disbursement,
  DocumentSubmission,
  ProgramSettings,
  RenderHourRecord,
  Requirement,
  Scholar,
} from "./types";

export type ReportType = "compliance" | "render" | "disbursement";

export interface ReportData {
  type: ReportType;
  title: string;
  periodLabel: string;
  generatedAt: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  summary: Array<{ label: string; value: string }>;
  filename: string;
}

export function isReportType(value: string | undefined): value is ReportType {
  return value === "compliance" || value === "render" || value === "disbursement";
}

const TITLES: Record<ReportType, string> = {
  compliance: "Compliance monitoring report",
  render: "Render-hour monitoring report",
  disbursement: "Disbursement status report",
};

export async function buildReportData(
  supabase: SupabaseClient,
  type: ReportType,
  periodId?: string,
): Promise<ReportData | null> {
  let selectedPeriod: AcademicPeriod | null = null;

  if (periodId) {
    const { data } = await supabase.from("academic_periods").select("*").eq("id", periodId).maybeSingle<AcademicPeriod>();
    selectedPeriod = data ?? null;
  }
  if (!selectedPeriod) {
    const { data } = await supabase
      .from("academic_periods")
      .select("*")
      .eq("is_active", true)
      .maybeSingle<AcademicPeriod>();
    selectedPeriod = data ?? null;
  }
  if (!selectedPeriod) return null;

  const [settingsResult, periodsResult, scholarsResult, complianceResult, requirementsResult, renderResult, disbursementResult] =
    await Promise.all([
      supabase.from("program_settings").select("*").eq("id", 1).maybeSingle<ProgramSettings>(),
      supabase.from("academic_periods").select("*").returns<AcademicPeriod[]>(),
      supabase.from("scholars").select("*").eq("status", "active").order("full_name").returns<Scholar[]>(),
      supabase
        .from("compliance_records")
        .select("*")
        .eq("period_id", selectedPeriod.id)
        .returns<ComplianceRecord[]>(),
      supabase
        .from("requirements")
        .select("*")
        .eq("period_id", selectedPeriod.id)
        .eq("is_active", true)
        .returns<Requirement[]>(),
      supabase.from("render_hour_records").select("*").returns<RenderHourRecord[]>(),
      supabase
        .from("disbursements")
        .select("*")
        .eq("period_id", selectedPeriod.id)
        .order("status_date", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<Disbursement[]>(),
    ]);

  const settings = settingsResult.data ?? {
    required_render_hours: 100,
    carry_forward_enabled: true,
    deadline_warning_days: 30,
  };
  const periods = periodsResult.data ?? [];
  const scholars = scholarsResult.data ?? [];
  const compliance = complianceResult.data ?? [];
  const requirements = requirementsResult.data ?? [];
  const renderRecords = renderResult.data ?? [];
  const disbursements = disbursementResult.data ?? [];

  const requirementIds = requirements.map((item) => item.id);
  let submissions: DocumentSubmission[] = [];
  if (requirementIds.length > 0) {
    const { data } = await supabase
      .from("document_submissions")
      .select("*")
      .in("requirement_id", requirementIds)
      .returns<DocumentSubmission[]>();
    submissions = data ?? [];
  }

  const complianceByScholar = new Map(compliance.map((row) => [row.scholar_id, row]));
  const verifiedCount = new Map<string, number>();
  for (const row of submissions) {
    if (row.status === "verified") {
      verifiedCount.set(row.scholar_id, (verifiedCount.get(row.scholar_id) ?? 0) + 1);
    }
  }
  const renderByScholar = new Map<string, RenderHourRecord[]>();
  for (const row of renderRecords) {
    const list = renderByScholar.get(row.scholar_id) ?? [];
    list.push(row);
    renderByScholar.set(row.scholar_id, list);
  }
  const latestDisbursement = new Map<string, Disbursement>();
  for (const row of disbursements) {
    if (!latestDisbursement.has(row.scholar_id)) latestDisbursement.set(row.scholar_id, row);
  }

  const periodLabel = `${selectedPeriod.name} A.Y. ${selectedPeriod.school_year} (${formatDate(selectedPeriod.start_date)} – ${formatDate(selectedPeriod.end_date)})`;
  const generatedAt = new Date().toLocaleString("en-PH");

  if (type === "compliance") {
    const rows = scholars.map((scholar) => {
      const record = complianceByScholar.get(scholar.id);
      const status = record?.status ?? "pending";
      const verified = verifiedCount.get(scholar.id) ?? 0;
      return [
        scholar.scholar_ref,
        scholar.full_name,
        scholar.school ?? "",
        COMPLIANCE_LABELS[status],
        `${verified}/${requirements.length}`,
        record?.remarks ?? "",
      ];
    });

    const counts = { compliant: 0, non_compliant: 0, pending: 0 };
    for (const scholar of scholars) {
      const status = complianceByScholar.get(scholar.id)?.status ?? "pending";
      counts[status] += 1;
    }

    return {
      type,
      title: TITLES[type],
      periodLabel,
      generatedAt,
      headers: ["Scholar reference", "Scholar", "School", "Compliance status", "Verified requirements", "Remarks"],
      rows,
      summary: [
        { label: "Active scholars", value: String(scholars.length) },
        { label: "Compliant", value: String(counts.compliant) },
        { label: "Non-compliant", value: String(counts.non_compliant) },
        { label: "Pending", value: String(counts.pending) },
      ],
      filename: `compliance-report-${selectedPeriod.school_year}-${selectedPeriod.semester.replace(/\s+/g, "-")}.csv`,
    };
  }

  if (type === "render") {
    let metCount = 0;
    const rows = scholars.map((scholar) => {
      const balances = computeRenderHourBalances({
        records: renderByScholar.get(scholar.id) ?? [],
        periods,
        requiredHours: settings.required_render_hours,
        carryForwardEnabled: settings.carry_forward_enabled,
      });
      const balance = balances.find((item) => item.periodId === selectedPeriod.id);
      if (balance?.met) metCount += 1;
      return [
        scholar.scholar_ref,
        scholar.full_name,
        formatHours(balance?.carryIn ?? 0),
        formatHours(balance?.earned ?? 0),
        formatHours(balance?.applied ?? 0),
        formatHours(balance?.carryOut ?? 0),
        formatHours(balance?.remaining ?? settings.required_render_hours),
        balance?.met ? "Met" : "Not met",
      ];
    });

    return {
      type,
      title: TITLES[type],
      periodLabel,
      generatedAt,
      headers: [
        "Scholar reference",
        "Scholar",
        "Carried in",
        "Earned this period",
        "Applied",
        "Carried out",
        "Remaining",
        "Requirement",
      ],
      rows,
      summary: [
        { label: "Active scholars", value: String(scholars.length) },
        { label: "Requirement met", value: String(metCount) },
        { label: "Required hours", value: String(settings.required_render_hours) },
        { label: "Carry-forward", value: settings.carry_forward_enabled ? "Enabled" : "Disabled" },
      ],
      filename: `render-hour-report-${selectedPeriod.school_year}-${selectedPeriod.semester.replace(/\s+/g, "-")}.csv`,
    };
  }

  const counts = { pending: 0, processing: 0, released: 0, on_hold: 0 };
  const rows = scholars.map((scholar) => {
    const latest = latestDisbursement.get(scholar.id);
    if (latest) counts[latest.status] += 1;
    return [
      scholar.scholar_ref,
      scholar.full_name,
      latest?.benefit_type ?? "",
      latest ? DISBURSEMENT_LABELS[latest.status] : "No update",
      latest ? formatDate(latest.status_date) : "",
      latest?.reference ?? "",
    ];
  });

  return {
    type,
    title: TITLES[type],
    periodLabel,
    generatedAt,
    headers: ["Scholar reference", "Scholar", "Benefit type", "Reported status", "Status date", "Reference"],
    rows,
    summary: [
      { label: "Active scholars", value: String(scholars.length) },
      { label: "Pending", value: String(counts.pending) },
      { label: "Processing", value: String(counts.processing) },
      { label: "Released", value: String(counts.released) },
      { label: "On hold", value: String(counts.on_hold) },
    ],
    filename: `disbursement-report-${selectedPeriod.school_year}-${selectedPeriod.semester.replace(/\s+/g, "-")}.csv`,
  };
}
