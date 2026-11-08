"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
};

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const registerSchema = z
  .object({
    full_name: z.string().trim().min(3, "Enter your full name."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sign-in details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "Sign-in failed. Check your email and password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    return { error: "No account profile was found. Contact the scholarship office." };
  }
  if (profile.status === "disabled") {
    await supabase.auth.signOut();
    return { error: "This account has been disabled. Contact the scholarship office." };
  }
  if (profile.status === "pending") {
    redirect("/pending");
  }

  const next = String(formData.get("next") ?? "");
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid registration details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name } },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/pending");
  }

  return {
    message:
      "Account created. Confirm your email address, then wait for the scholarship office to approve your scholar account.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
