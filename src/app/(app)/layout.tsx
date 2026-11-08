import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/pending");

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", profile.id)
    .eq("status", "unread");

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        profile={{ full_name: profile.full_name, email: profile.email, role: profile.role }}
        unread={count ?? 0}
      />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
