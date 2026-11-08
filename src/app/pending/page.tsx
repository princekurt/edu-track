import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { getProfile } from "@/lib/auth";
import { ACCOUNT_LABELS } from "@/lib/constants";

export const metadata = { title: "Account status" };

export default async function PendingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "active") redirect("/dashboard");

  const disabled = profile.status === "disabled";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            ET
          </span>
          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            {disabled ? "Account disabled" : "Account awaiting approval"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {disabled
              ? "This account has been disabled by the scholarship office. Contact the office if you believe this is a mistake."
              : "Your scholar account has been created and is waiting for the Scholarship Coordinating Office to review and activate it. You will have access once approved."}
          </p>
          <dl className="mt-5 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-800">{profile.full_name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-800">{profile.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-800">{ACCOUNT_LABELS[profile.status]}</dd>
            </div>
          </dl>
          <form action={signOut} className="mt-5">
            <button type="submit" className="btn-secondary w-full">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
