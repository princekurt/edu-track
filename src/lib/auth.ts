import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/pending");
  return profile;
}

export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (roles.length > 0 && !roles.includes(profile.role)) {
    redirect(`/dashboard?error=${encodeURIComponent("You do not have access to that page.")}`);
  }
  return profile;
}

export async function getMyScholar(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scholars")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data;
}
