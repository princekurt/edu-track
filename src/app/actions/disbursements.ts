"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { messageFrom, num, optionalStr, redirectWith, str } from "@/lib/forms";

const schema = z.object({
  scholar_id: z.string().uuid("Select a scholar."),
  period_id: z.string().uuid("Select a reporting period."),
  status: z.enum(["pending", "processing", "released", "on_hold"]),
  status_date: z.string().min(1, "Enter the status date."),
  benefit_type: z.string().trim().min(2, "Enter the benefit type."),
});

export async function addDisbursement(formData: FormData) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });
  if (!["administrator", "disbursement"].includes(profile.role)) {
    redirectWith("/disbursements", {
      error: "Only disbursement personnel or an administrator can record disbursement updates.",
    });
  }

  const parsed = schema.safeParse({
    scholar_id: str(formData, "scholar_id"),
    period_id: str(formData, "period_id"),
    status: str(formData, "status"),
    status_date: str(formData, "status_date"),
    benefit_type: str(formData, "benefit_type"),
  });
  if (!parsed.success) {
    redirectWith("/disbursements", { error: parsed.error.issues[0]?.message });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("disbursements").insert({
    scholar_id: parsed.data.scholar_id,
    period_id: parsed.data.period_id,
    status: parsed.data.status,
    status_date: parsed.data.status_date,
    benefit_type: parsed.data.benefit_type,
    amount: num(formData, "amount"),
    reference: optionalStr(formData, "reference"),
    remarks: optionalStr(formData, "remarks"),
    recorded_by: profile.id,
  });

  redirectWith("/disbursements", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Disbursement status recorded.",
    period: parsed.data.period_id,
    scholar: parsed.data.scholar_id,
  });
}
