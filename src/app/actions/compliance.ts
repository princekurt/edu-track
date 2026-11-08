"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bool, messageFrom, num, optionalStr, redirectWith, str } from "@/lib/forms";
import type { Role } from "@/lib/types";

const RECORD_STAFF: Role[] = ["administrator", "scholarship_staff", "compliance"];

async function requireRecordStaff() {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });
  if (!RECORD_STAFF.includes(profile.role)) {
    redirectWith("/dashboard", { error: "You are not authorized to manage compliance records." });
  }
  return profile;
}

const requirementSchema = z.object({
  period_id: z.string().uuid("Select a reporting period."),
  name: z.string().trim().min(2, "Enter the requirement name."),
});

export async function createRequirement(formData: FormData) {
  await requireRecordStaff();
  const parsed = requirementSchema.safeParse({
    period_id: str(formData, "period_id"),
    name: str(formData, "name"),
  });
  if (!parsed.success) {
    redirectWith("/requirements", { error: parsed.error.issues[0]?.message });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("requirements").insert({
    period_id: parsed.data.period_id,
    name: parsed.data.name,
    description: optionalStr(formData, "description"),
    is_active: true,
  });

  redirectWith("/requirements", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Requirement added.",
    period: parsed.data.period_id,
  });
}

export async function toggleRequirement(formData: FormData) {
  await requireRecordStaff();
  const id = str(formData, "id");
  const active = bool(formData, "is_active");
  if (!id) redirectWith("/requirements", { error: "Missing requirement identifier." });

  const supabase = await createClient();
  const { error } = await supabase.from("requirements").update({ is_active: active }).eq("id", id);

  redirectWith("/requirements", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : active ? "Requirement enabled." : "Requirement disabled.",
    period: str(formData, "period_id") || undefined,
  });
}

export async function setSubmissionStatus(formData: FormData) {
  const profile = await requireRecordStaff();
  const scholarId = str(formData, "scholar_id");
  const requirementId = str(formData, "requirement_id");
  const status = str(formData, "status");
  const remarks = optionalStr(formData, "remarks");
  const periodId = str(formData, "period_id");

  if (!scholarId || !requirementId) {
    redirectWith("/scholars", { error: "Missing submission identifiers." });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("document_submissions").upsert(
    {
      scholar_id: scholarId,
      requirement_id: requirementId,
      status,
      remarks,
      reviewer_id: profile.id,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    },
    { onConflict: "scholar_id,requirement_id" },
  );

  redirectWith(`/scholars/${scholarId}`, {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Document status saved.",
    period: periodId || undefined,
  });
}

export async function addRenderHours(formData: FormData) {
  const profile = await requireRecordStaff();
  const scholarId = str(formData, "scholar_id");
  const periodId = str(formData, "period_id");
  const activity = str(formData, "activity");
  const hours = num(formData, "hours");

  if (!scholarId || !periodId || !activity || hours === null || hours <= 0) {
    redirectWith(`/scholars/${scholarId || ""}`, {
      error: "Enter an activity and a positive number of hours.",
      period: periodId || undefined,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("render_hour_records").insert({
    scholar_id: scholarId,
    period_id: periodId,
    activity,
    hours,
    remarks: optionalStr(formData, "remarks"),
    recorded_by: profile.id,
  });

  redirectWith(`/scholars/${scholarId}`, {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Render hours recorded.",
    period: periodId,
  });
}

export async function deleteRenderHours(formData: FormData) {
  await requireRecordStaff();
  const id = str(formData, "id");
  const scholarId = str(formData, "scholar_id");
  if (!id || !scholarId) redirectWith("/scholars", { error: "Missing record identifier." });

  const supabase = await createClient();
  const { error } = await supabase.from("render_hour_records").delete().eq("id", id);

  redirectWith(`/scholars/${scholarId}`, {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Render hour record removed.",
    period: str(formData, "period_id") || undefined,
  });
}

export async function upsertCompliance(formData: FormData) {
  const profile = await requireRecordStaff();
  const scholarId = str(formData, "scholar_id");
  const periodId = str(formData, "period_id");
  const status = str(formData, "status");
  if (!scholarId || !periodId) {
    redirectWith("/scholars", { error: "Missing compliance identifiers." });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("compliance_records").upsert(
    {
      scholar_id: scholarId,
      period_id: periodId,
      status,
      remarks: optionalStr(formData, "remarks"),
      verifier_id: profile.id,
    },
    { onConflict: "scholar_id,period_id" },
  );

  redirectWith(`/scholars/${scholarId}`, {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Compliance status saved.",
    period: periodId,
  });
}
