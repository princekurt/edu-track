"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { messageFrom, optionalStr, redirectWith, str } from "@/lib/forms";
import type { Role } from "@/lib/types";

const RECORD_STAFF: Role[] = ["administrator", "scholarship_staff"];

async function requireRecordStaff() {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });
  if (!RECORD_STAFF.includes(profile.role)) {
    redirectWith("/dashboard", { error: "You are not authorized to manage scholar records." });
  }
  return profile;
}

const scholarSchema = z.object({
  full_name: z.string().trim().min(3, "Enter the scholar's full name."),
  school: z.string().trim().min(1, "Enter the school."),
  program: z.string().trim().min(1, "Enter the program."),
  year_level: z.string().trim().min(1, "Enter the year level."),
});

export async function createScholar(formData: FormData) {
  await requireRecordStaff();
  const parsed = scholarSchema.safeParse({
    full_name: str(formData, "full_name"),
    school: str(formData, "school"),
    program: str(formData, "program"),
    year_level: str(formData, "year_level"),
  });
  if (!parsed.success) {
    redirectWith("/scholars/new", { error: parsed.error.issues[0]?.message });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("scholars").insert({
    full_name: parsed.data.full_name,
    email: optionalStr(formData, "email"),
    school: parsed.data.school,
    program: parsed.data.program,
    year_level: parsed.data.year_level,
    contact_number: optionalStr(formData, "contact_number"),
    status: str(formData, "status") || "active",
    scholar_ref: optionalStr(formData, "scholar_ref"),
  });

  if (error) {
    redirectWith("/scholars/new", { error: messageFrom(error) });
  }
  redirectWith("/scholars", { message: "Scholar record created." });
}

export async function updateScholar(formData: FormData) {
  await requireRecordStaff();
  const id = str(formData, "id");
  if (!id) redirectWith("/scholars", { error: "Missing scholar identifier." });

  const parsed = scholarSchema.safeParse({
    full_name: str(formData, "full_name"),
    school: str(formData, "school"),
    program: str(formData, "program"),
    year_level: str(formData, "year_level"),
  });
  if (!parsed.success) {
    redirectWith(`/scholars/${id}`, { error: parsed.error.issues[0]?.message });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("scholars")
    .update({
      full_name: parsed.data.full_name,
      email: optionalStr(formData, "email"),
      school: parsed.data.school,
      program: parsed.data.program,
      year_level: parsed.data.year_level,
      contact_number: optionalStr(formData, "contact_number"),
      status: str(formData, "status") || "active",
    })
    .eq("id", id);

  if (error) {
    redirectWith(`/scholars/${id}`, { error: messageFrom(error) });
  }
  redirectWith(`/scholars/${id}`, { message: "Scholar record updated." });
}
