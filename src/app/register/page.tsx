import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create scholar account" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            ET
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">EduTrack</p>
            <p className="text-sm text-slate-500">EduKar Scholarship Program</p>
          </div>
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-semibold text-slate-900">Create a scholar account</h1>
          <p className="mt-1 mb-5 text-sm text-slate-500">
            New accounts are reviewed by the scholarship office before access is enabled. Staff
            accounts are created by the administrator.
          </p>
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Already have an approved account?{" "}
          <Link className="font-semibold text-brand-700 hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
