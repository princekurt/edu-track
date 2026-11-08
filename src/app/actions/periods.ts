"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bool, messageFrom, num, redirectWith, str } from "@/lib/forms";

async function requireAdministrator() {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });
  if (profile.role !== "administrator") {
    redirectWith("/dashboard", { error: "Only an administrator can manage periods and program rules." });
  }
  return profile;
}

const periodSchema = z.object({
  school_year: z.string().trim().min(4, "Enter the school year (e.g., 2026-2027)."),
  semester: z.string().trim().min(3, "Enter the semester."),
  start_date: z.string().min(1, "Enter the start date."),
  end_date: z.string().min(1, "Enter the end date."),
});

export async function createPeriod(formData: FormData) {
  await requireAdministrator();
  const parsed = periodSchema.safeParse({
    school_year: str(formData, "school_year"),
    semester: str(formData, "semester"),
    start_date: str(formData, "start_date"),
    end_date: str(formData, "end_date"),
  });
  if (!parsed.success) {
    redirectWith("/admin/periods", { error: parsed.error.issues[0]?.message });
  }
  if (parsed.data.end_date < parsed.data.start_date) {
    redirectWith("/admin/periods", { error: "The end date must be after the start date." });
  }

  const supabase = await createClient();
  const makeActive = bool(formData, "is_active");
  if (makeActive) {
    await supabase.from("academic_periods").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { error } = await supabase.from("academic_periods").insert({
    name: str(formData, "name") || `${parsed.data.semester} A.Y. ${parsed.data.school_year}`,
    school_year: parsed.data.school_year,
    semester: parsed.data.semester,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    is_active: makeActive,
  });

  redirectWith("/admin/periods", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Reporting period created.",
  });
}

export async function setActivePeriod(formData: FormData) {
  await requireAdministrator();
  const id = str(formData, "id");
  if (!id) redirectWith("/admin/periods", { error: "Missing period identifier." });

  const supabase = await createClient();
  await supabase
    .from("academic_periods")
    .update({ is_active: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase.from("academic_periods").update({ is_active: true }).eq("id", id);

  redirectWith("/admin/periods", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Active reporting period updated.",
  });
}

export async function updateSettings(formData: FormData) {
  await requireAdministrator();
  const required = num(formData, "required_render_hours");
  const warning = num(formData, "deadline_warning_days");
  if (required === null || required <= 0 || warning === null || warning < 0) {
    redirectWith("/admin/periods", { error: "Enter valid program rule values." });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("program_settings")
    .update({
      required_render_hours: Math.round(required),
      carry_forward_enabled: bool(formData, "carry_forward_enabled"),
      deadline_warning_days: Math.round(warning),
    })
    .eq("id", 1);

  redirectWith("/admin/periods", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Program rules updated.",
  });
}
