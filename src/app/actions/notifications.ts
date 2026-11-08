"use server";

import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirectWith, str } from "@/lib/forms";
import { computeRenderHourBalances } from "@/lib/render-hours";
import type {
  AcademicPeriod,
  ComplianceRecord,
  DocumentSubmission,
  ProgramSettings,
  RenderHourRecord,
  Requirement,
  Scholar,
} from "@/lib/types";

async function requireSignedIn() {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });
  return profile;
}

export async function markNotificationRead(formData: FormData) {
  const profile = await requireSignedIn();
  const id = str(formData, "id");
  if (!id) redirectWith("/notifications", { error: "Missing notification identifier." });

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("id", id)
    .eq("recipient_id", profile.id);

  redirectWith("/notifications");
}

export async function markAllNotificationsRead() {
  const profile = await requireSignedIn();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ status: "read" })
    .eq("recipient_id", profile.id)
    .eq("status", "unread");

  redirectWith("/notifications", { message: "All notifications marked as read." });
}

export async function deleteNotification(formData: FormData) {
  const profile = await requireSignedIn();
  const id = str(formData, "id");
  if (!id) redirectWith("/notifications", { error: "Missing notification identifier." });

  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("id", id).eq("recipient_id", profile.id);

  redirectWith("/notifications", { message: "Notification removed." });
}

/**
 * FR-09: derive non-compliance flags for the active period and deliver them as
 * in-app reminders to linked scholar accounts.
 */
export async function generateReminders() {
  const profile = await requireSignedIn();
  if (!["administrator", "scholarship_staff", "compliance"].includes(profile.role)) {
    redirectWith("/notifications", {
      error: "Only scholarship staff or compliance personnel can generate reminders.",
    });
  }

  const supabase = await createClient();

  const { data: period } = await supabase
    .from("academic_periods")
    .select("*")
    .eq("is_active", true)
    .maybeSingle<AcademicPeriod>();

  if (!period) {
    redirectWith("/notifications", { error: "No active reporting period is configured." });
  }

  const [settingsResult, scholarsResult, periodsResult, renderResult, requirementsResult, complianceResult] =
    await Promise.all([
      supabase.from("program_settings").select("*").eq("id", 1).maybeSingle<ProgramSettings>(),
      supabase.from("scholars").select("*").eq("status", "active").returns<Scholar[]>(),
      supabase.from("academic_periods").select("*").returns<AcademicPeriod[]>(),
      supabase.from("render_hour_records").select("*").returns<RenderHourRecord[]>(),
      supabase
        .from("requirements")
        .select("*")
        .eq("period_id", period.id)
        .eq("is_active", true)
        .returns<Requirement[]>(),
      supabase
        .from("compliance_records")
        .select("*")
        .eq("period_id", period.id)
        .returns<ComplianceRecord[]>(),
    ]);

  const settings = settingsResult.data ?? {
    required_render_hours: 100,
    carry_forward_enabled: true,
    deadline_warning_days: 30,
  };
  const scholars = scholarsResult.data ?? [];
  const periods = periodsResult.data ?? [];
  const renderRecords = renderResult.data ?? [];
  const requirements = requirementsResult.data ?? [];
  const compliance = complianceResult.data ?? [];

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

  const unreadResult = await supabase
    .from("notifications")
    .select("recipient_id, title, related_id")
    .eq("type", "reminder")
    .eq("status", "unread")
    .eq("related_id", period.id);
  const existing = new Set(
    (unreadResult.data ?? []).map(
      (row: { recipient_id: string; title: string }) => `${row.recipient_id}:${row.title}`,
    ),
  );

  const complianceByScholar = new Map(compliance.map((row) => [row.scholar_id, row]));
  const title = `Compliance reminder — ${period.name} A.Y. ${period.school_year}`;
  const rows: Array<{
    recipient_id: string;
    title: string;
    message: string;
    type: "reminder";
    related_type: string;
    related_id: string;
  }> = [];

  for (const scholar of scholars) {
    if (!scholar.profile_id) continue;

    const scholarRecords = renderRecords.filter((row) => row.scholar_id === scholar.id);
    const balances = computeRenderHourBalances({
      records: scholarRecords,
      periods,
      requiredHours: settings.required_render_hours,
      carryForwardEnabled: settings.carry_forward_enabled,
    });
    const current = balances.find((balance) => balance.periodId === period.id);
    const remaining = current ? current.remaining : settings.required_render_hours;

    const verified = new Set(
      submissions
        .filter((row) => row.scholar_id === scholar.id && row.status === "verified")
        .map((row) => row.requirement_id),
    );
    const missing = requirements.filter((item) => !verified.has(item.id));
    const complianceStatus = complianceByScholar.get(scholar.id)?.status ?? "pending";

    const flagged = missing.length > 0 || remaining > 0 || complianceStatus !== "compliant";
    if (!flagged) continue;

    const key = `${scholar.profile_id}:${title}`;
    if (existing.has(key)) continue;
    existing.add(key);

    const parts: string[] = [];
    if (remaining > 0) parts.push(`${remaining} render hour(s) remaining`);
    if (missing.length > 0) parts.push(`${missing.length} requirement(s) not yet verified`);
    if (complianceStatus !== "compliant") {
      parts.push(`compliance status is ${complianceStatus.replace(/_/g, " ")}`);
    }

    rows.push({
      recipient_id: scholar.profile_id,
      title,
      message: `Your ${period.name} record currently shows: ${parts.join("; ")}. Please coordinate with the Scholarship Coordinating Office.`,
      type: "reminder",
      related_type: "period",
      related_id: period.id,
    });
  }

  if (rows.length === 0) {
    redirectWith("/notifications", {
      message: "No new reminders are needed — flagged scholars already have unread reminders.",
    });
  }

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    redirectWith("/notifications", { error: error.message });
  }

  redirectWith("/notifications", { message: `${rows.length} reminder(s) generated.` });
}
