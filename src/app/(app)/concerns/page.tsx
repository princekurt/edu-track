import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createConcern } from "@/app/actions/concerns";
import { CONCERN_LABELS, CONCERN_STATUS_OPTIONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Card, CardHeader, Empty, Field, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ConcernTicket, Scholar } from "@/lib/types";

export const metadata = { title: "Concerns" };

type ConcernRow = ConcernTicket & {
  scholar: { full_name: string; scholar_ref: string } | null;
};

export default async function ConcernsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const isScholar = profile.role === "scholar";

  let query = supabase
    .from("concern_tickets")
    .select("*, scholar:scholars(full_name, scholar_ref)")
    .order("created_at", { ascending: false });

  if (params.status && CONCERN_STATUS_OPTIONS.includes(params.status as ConcernTicket["status"])) {
    query = query.eq("status", params.status);
  }

  const { data } = await query.returns<ConcernRow[]>();
  const tickets = data ?? [];

  let scholars: Scholar[] = [];
  let ownScholarId: string | null = null;
  if (isScholar) {
    const { data: own } = await supabase
      .from("scholars")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    ownScholarId = own?.id ?? null;
  } else {
    const { data } = await supabase
      .from("scholars")
      .select("id, full_name, scholar_ref, status")
      .eq("status", "active")
      .order("full_name")
      .returns<Scholar[]>();
    scholars = data ?? [];
  }

  return (
    <div>
      <PageHeader
        title="Concerns"
        description="Track scholar concerns through Open, In Progress, and Resolved states with a shared history."
      />
      <Notice error={params.error} message={params.message} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Concern tickets"
            actions={
              <form method="get" className="flex items-center gap-2">
                <select className="select w-40" name="status" defaultValue={params.status ?? ""}>
                  <option value="">All statuses</option>
                  {CONCERN_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{CONCERN_LABELS[status]}</option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary">Filter</button>
              </form>
            }
          />
          <div className="overflow-x-auto">
            {tickets.length === 0 ? (
              <div className="p-5">
                <Empty title="No concern tickets" description="Submitted concerns will appear here." />
              </div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Ticket</th>
                    {!isScholar ? <th className="th">Scholar</th> : null}
                    <th className="th">Status</th>
                    <th className="th">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="row">
                      <td className="td">
                        <Link className="font-medium text-brand-700 hover:underline" href={`/concerns/${ticket.id}`}>
                          {ticket.subject}
                        </Link>
                        <p className="text-xs text-slate-500">{ticket.ticket_no}</p>
                      </td>
                      {!isScholar ? (
                        <td className="td">
                          <p>{ticket.scholar?.full_name ?? "—"}</p>
                          <p className="text-xs text-slate-500">{ticket.scholar?.scholar_ref}</p>
                        </td>
                      ) : null}
                      <td className="td"><StatusBadge kind="concern" status={ticket.status} /></td>
                      <td className="td text-slate-500">{formatDateTime(ticket.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Submit a concern" description="Describe the issue so staff can follow it up." />
          <form action={createConcern} className="card-body space-y-3">
            {!isScholar ? (
              <Field label="Scholar">
                <select className="select" name="scholar_id" required defaultValue="">
                  <option value="" disabled>Select a scholar</option>
                  {scholars.map((scholar) => (
                    <option key={scholar.id} value={scholar.id}>
                      {scholar.full_name} ({scholar.scholar_ref})
                    </option>
                  ))}
                </select>
              </Field>
            ) : ownScholarId ? (
              <input type="hidden" name="scholar_id" value={ownScholarId} />
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Your scholar record is not linked yet. Contact the scholarship office to submit a concern.
              </p>
            )}
            <Field label="Subject">
              <input className="input" name="subject" placeholder="Short summary of the concern" required />
            </Field>
            <Field label="Description">
              <textarea className="textarea" name="description" placeholder="What happened, what you need, and any reference details." required />
            </Field>
            <div className="flex justify-end">
              <SubmitButton pendingText="Submitting…" className="btn-primary">Submit concern</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
