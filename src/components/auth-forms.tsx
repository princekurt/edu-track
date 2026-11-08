"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

const initialState: AuthState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {state.error}
        </div>
      ) : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="block">
        <span className="label">Email address</span>
        <input className="input" type="email" name="email" autoComplete="email" required />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input className="input" type="password" name="password" autoComplete="current-password" required />
      </label>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-slate-500">
        New scholar?{" "}
        <Link className="font-semibold text-brand-700 hover:underline" href="/register">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(signUp, initialState);

  if (state.message) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {state.error}
        </div>
      ) : null}
      <label className="block">
        <span className="label">Full name</span>
        <input className="input" type="text" name="full_name" autoComplete="name" required />
      </label>
      <label className="block">
        <span className="label">Email address</span>
        <input className="input" type="email" name="email" autoComplete="email" required />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="block">
        <span className="label">Confirm password</span>
        <input className="input" type="password" name="confirm" autoComplete="new-password" minLength={8} required />
      </label>
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create scholar account
      </SubmitButton>
      <p className="text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link className="font-semibold text-brand-700 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}
