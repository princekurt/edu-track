import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAccount, setAccountRole, setAccountStatus } from "@/app/actions/admin";
import { ACCOUNT_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, Empty, Field, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { Profile, Role } from "@/lib/types";

export const metadata = { title: "Account management" };

const ROLES: Role[] = ["administrator", "scholarship_staff", "compliance", "disbursement", "scholar"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; role?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const admin = await requireRole("administrator");
  const supabase = await createClient();

  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (params.q) {
    const term = params.q.replace(/[,%()]/g, " ").trim();
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  if (params.status && ["pending", "active", "disabled"].includes(params.status)) {
    query = query.eq("status", params.status);
  }
  if (params.role && ROLES.includes(params.role as Role)) {
    query = query.eq("role", params.role);
  }

  const { data } = await query.returns<Profile[]>();
  const profiles = data ?? [];
  const pendingCount = profiles.filter((profile) => profile.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Account management"
        description="Approve scholar registrations, create staff accounts, and control role-based access."
      />
      <Notice error={params.error} message={params.message} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts listed</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{profiles.length}</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending approval</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{pendingCount}</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">{admin.email}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Accounts" description="Role changes and approvals take effect immediately." />
          <div className="overflow-x-auto">
            {profiles.length === 0 ? (
              <div className="p-5"><Empty title="No accounts match the filters" /></div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Account</th>
                    <th className="th">Role</th>
                    <th className="th">Status</th>
                    <th className="th">Created</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((account) => {
                    const isSelf = account.id === admin.id;
                    return (
                      <tr key={account.id} className="row">
                        <td className="td">
                          <p className="font-medium text-slate-900">{account.full_name || "Unnamed user"}</p>
                          <p className="text-xs text-slate-500">{account.email}</p>
                        </td>
                        <td className="td">
                          <form action={setAccountRole} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={account.id} />
                            <select className="select w-36" name="role" defaultValue={account.role} disabled={isSelf}>
                              {ROLES.map((role) => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                              ))}
                            </select>
                            {isSelf ? null : (
                              <SubmitButton className="btn-ghost" pendingText="…">Set</SubmitButton>
                            )}
                          </form>
                        </td>
                        <td className="td"><StatusBadge kind="account" status={account.status} /></td>
                        <td className="td text-slate-500">{formatDate(account.created_at)}</td>
                        <td className="td">
                          <div className="flex flex-wrap items-center gap-1">
                            {account.status === "pending" ? (
                              <form action={setAccountStatus}>
                                <input type="hidden" name="id" value={account.id} />
                                <input type="hidden" name="status" value="active" />
                                <SubmitButton className="btn-secondary" pendingText="…">Approve</SubmitButton>
                              </form>
                            ) : null}
                            {account.status === "active" && !isSelf ? (
                              <form action={setAccountStatus}>
                                <input type="hidden" name="id" value={account.id} />
                                <input type="hidden" name="status" value="disabled" />
                                <SubmitButton className="btn-ghost text-rose-600" pendingText="…">Disable</SubmitButton>
                              </form>
                            ) : null}
                            {account.status === "disabled" ? (
                              <form action={setAccountStatus}>
                                <input type="hidden" name="id" value={account.id} />
                                <input type="hidden" name="status" value="active" />
                                <SubmitButton className="btn-secondary" pendingText="…">Enable</SubmitButton>
                              </form>
                            ) : null}
                            {isSelf ? <span className="text-xs text-slate-400">Current account</span> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Create account"
            description="Provision a staff or scholar account with an initial password."
          />
          <form action={createAccount} className="card-body space-y-3">
            <Field label="Full name">
              <input className="input" name="full_name" required />
            </Field>
            <Field label="Email address">
              <input className="input" type="email" name="email" required />
            </Field>
            <Field label="Initial password" hint="At least 8 characters. Share securely and ask the user to change it.">
              <input className="input" type="text" name="password" minLength={8} required />
            </Field>
            <Field label="Role">
              <select className="select" name="role" defaultValue="scholarship_staff">
                {ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end">
              <SubmitButton pendingText="Creating…">Create account</SubmitButton>
            </div>
          </form>
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              Scholar self-registrations start as pending. Approving a scholar account automatically creates a linked
              scholar record.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <form method="get" className="card-body flex flex-wrap items-end gap-3">
          <Field label="Search">
            <input className="input" type="search" name="q" defaultValue={params.q ?? ""} placeholder="Name or email" />
          </Field>
          <Field label="Status">
            <select className="select" name="status" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              {(["pending", "active", "disabled"] as const).map((status) => (
                <option key={status} value={status}>{ACCOUNT_LABELS[status]}</option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select className="select" name="role" defaultValue={params.role ?? ""}>
              <option value="">All roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn-secondary">Apply filters</button>
        </form>
      </Card>
    </div>
  );
}
