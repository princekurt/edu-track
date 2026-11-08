"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { messageFrom, redirectWith, str } from "@/lib/forms";
import type { Role } from "@/lib/types";

const STAFF: Role[] = ["administrator", "scholarship_staff", "compliance", "disbursement"];

const concernSchema = z.object({
  subject: z.string().trim().min(3, "Enter a subject."),
  description: z.string().trim().min(10, "Describe the concern in at least a few words."),
});

export async function createConcern(formData: FormData) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });

  const parsed = concernSchema.safeParse({
    subject: str(formData, "subject"),
    description: str(formData, "description"),
  });
  if (!parsed.success) {
    redirectWith("/concerns", { error: parsed.error.issues[0]?.message });
  }

  const supabase = await createClient();
  let scholarId = str(formData, "scholar_id");

  if (profile.role === "scholar") {
    const { data: ownScholar } = await supabase
      .from("scholars")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!ownScholar) {
      redirectWith("/concerns", {
        error: "No active scholar record is linked to your account yet. Contact the scholarship office.",
      });
    }
    scholarId = ownScholar.id;
  } else if (!STAFF.includes(profile.role)) {
    redirectWith("/dashboard", { error: "You are not authorized to create concerns." });
  }

  if (!scholarId) {
    redirectWith("/concerns", { error: "Select the scholar this concern belongs to." });
  }

  const { data, error } = await supabase
    .from("concern_tickets")
    .insert({
      scholar_id: scholarId,
      subject: parsed.data.subject,
      description: parsed.data.description,
      status: "open",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirectWith("/concerns", { error: messageFrom(error) });
  }

  await supabase.from("concern_updates").insert({
    ticket_id: data.id,
    author_id: profile.id,
    message: "Concern submitted.",
    status_after: "open",
  });

  redirectWith(`/concerns/${data.id}`, { message: "Concern submitted." });
}

export async function addConcernUpdate(formData: FormData) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });

  const ticketId = str(formData, "ticket_id");
  const message = str(formData, "message");
  const requestedStatus = str(formData, "status");
  if (!ticketId || !message) {
    redirectWith(`/concerns/${ticketId || ""}`, { error: "Enter a message for the update." });
  }

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("concern_tickets")
    .select("id, status")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError || !ticket) {
    redirectWith("/concerns", { error: "Concern ticket not found or not accessible." });
  }

  const isStaff = STAFF.includes(profile.role);
  const nextStatus = isStaff && requestedStatus ? requestedStatus : null;

  const { error } = await supabase.from("concern_updates").insert({
    ticket_id: ticketId,
    author_id: profile.id,
    message,
    status_after: nextStatus ?? ticket.status,
  });
  if (error) {
    redirectWith(`/concerns/${ticketId}`, { error: messageFrom(error) });
  }

  if (nextStatus) {
    await supabase
      .from("concern_tickets")
      .update({
        status: nextStatus,
        resolved_at: nextStatus === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", ticketId);
  }

  redirectWith(`/concerns/${ticketId}`, { message: "Update added to the concern ticket." });
}
