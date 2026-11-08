"use server";

import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { messageFrom, redirectWith, str } from "@/lib/forms";

const ROLES = ["administrator", "scholarship_staff", "compliance", "disbursement", "scholar"] as const;

async function requireAdministrator() {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") redirectWith("/login", { error: "Please sign in." });
  if (profile.role !== "administrator") {
    redirectWith("/dashboard", { error: "Only an administrator can manage accounts." });
  }
  return profile;
}

const createSchema = z.object({
  full_name: z.string().trim().min(3, "Enter the account holder's full name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(ROLES),
});

export async function createAccount(formData: FormData) {
  await requireAdministrator();
  const parsed = createSchema.safeParse({
    full_name: str(formData, "full_name"),
    email: str(formData, "email"),
    password: str(formData, "password"),
    role: str(formData, "role"),
  });
  if (!parsed.success) {
    redirectWith("/admin/users", { error: parsed.error.issues[0]?.message });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    redirectWith("/admin/users", { error: messageFrom(error as { message: string }) });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (error || !data.user) {
    redirectWith("/admin/users", { error: messageFrom(error) });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      status: "active",
    })
    .eq("id", data.user.id);

  if (profileError) {
    redirectWith("/admin/users", { error: messageFrom(profileError) });
  }

  redirectWith("/admin/users", {
    message: `Account created for ${parsed.data.email} with the ${parsed.data.role.replace(/_/g, " ")} role.`,
  });
}

export async function setAccountStatus(formData: FormData) {
  const admin = await requireAdministrator();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !["pending", "active", "disabled"].includes(status)) {
    redirectWith("/admin/users", { error: "Invalid account status request." });
  }
  if (id === admin.id && status !== "active") {
    redirectWith("/admin/users", { error: "You cannot disable or unapprove your own account." });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", id);

  redirectWith("/admin/users", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : status === "active" ? "Account approved and activated." : "Account status updated.",
  });
}

export async function setAccountRole(formData: FormData) {
  const admin = await requireAdministrator();
  const id = str(formData, "id");
  const role = str(formData, "role");
  if (!id || !ROLES.includes(role as (typeof ROLES)[number])) {
    redirectWith("/admin/users", { error: "Invalid role request." });
  }
  if (id === admin.id) {
    redirectWith("/admin/users", { error: "You cannot change your own role." });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);

  redirectWith("/admin/users", {
    error: error ? messageFrom(error) : undefined,
    message: error ? undefined : "Role updated.",
  });
}
