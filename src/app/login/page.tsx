import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-base font-bold">
              ET
            </span>
            <div>
              <p className="text-lg font-semibold">EduTrack</p>
              <p className="text-sm text-white/70">EduKar Scholarship Program</p>
            </div>
          </div>
          <h1 className="mt-16 max-w-md text-4xl font-semibold leading-tight">
            One place for scholar compliance and disbursement monitoring.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Track requirements, render hours, reported disbursement status, and concerns for active
            EduKar scholars of General Santos City.
          </p>
        </div>
        <p className="text-sm text-white/60">
          Document verification remains in person. Fund transfers remain with the LGU financial
          process.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
              ET
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Sign in to EduTrack</h2>
          <p className="mt-1 mb-6 text-sm text-slate-500">
            Use the account issued by the scholarship office, or your approved scholar account.
          </p>
          {params.error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {params.error}
            </div>
          ) : null}
          <LoginForm next={params.next} />
          <p className="mt-8 text-center text-xs text-slate-400">
            <Link className="hover:text-slate-600" href="/">
              EduTrack
            </Link>{" "}
            · Compliance management and disbursement monitoring
          </p>
        </div>
      </div>
    </div>
  );
}
