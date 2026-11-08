import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addConcernUpdate } from "@/app/actions/concerns";
import { CONCERN_LABELS, CONCERN_STATUS_OPTIONS, NOTIFICATION_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Card, CardHeader, Empty, Field, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ConcernStatus, ConcernTicket, ConcernUpdate, Role } from "@/lib/types";

export default async function ConcernDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("concern_tickets")
    .select("*, scholar:scholars(full_name, scholar_ref)")
    .eq("id", id)
    .maybeSingle<ConcernTicket & { scholar: { full_name: string; scholar_ref: string } | null }>();

  if (!ticket) {
    return (
      <div>
        <PageHeader title="Concern not found" description="This ticket does not exist or is not accessible to your account." />
        <Link className="btn-secondary" href="/concerns">Back to concerns</Link>
      </div>
    );
  }

  const { data: updatesData } = await supabase
    .from("concern_updates")
    .select("*, author:profiles(full_name, role)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true })
    .returns<Array<ConcernUpdate & { author: { full_name: string; role: Role } | null }>>();
  const updates = updatesData ?? [];

  const isStaff = ["administrator", "scholarship_staff", "compliance", "disbursement"].includes(profile.role);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={ticket.subject}
        description={`${ticket.ticket_no} · ${ticket.scholar?.full_name ?? "Scholar"} (${ticket.scholar?.scholar_ref ?? "—"})`}
        actions={<Link className="btn-secondary" href="/concerns">Back to concerns</Link>}
      />
      <Notice error={sp.error} message={sp.message} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Concern details"
              actions={<StatusBadge kind="concern" status={ticket.status} />}
            />
            <div className="card-body">
              <p className="whitespace-pre-line text-sm text-slate-700">{ticket.description}</p>
              <dl className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <div><dt className="inline">Submitted: </dt><dd className="inline">{formatDateTime(ticket.created_at)}</dd></div>
                <div><dt className="inline">Last updated: </dt><dd className="inline">{formatDateTime(ticket.updated_at)}</dd></div>
                {ticket.resolved_at ? (
                  <div><dt className="inline">Resolved: </dt><dd className="inline">{formatDateTime(ticket.resolved_at)}</dd></div>
                ) : null}
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="History" description="Updates are visible to the scholar and authorized staff." />
            <div className="card-body">
              {updates.length === 0 ? (
                <Empty title="No updates yet" />
              ) : (
                <ol className="space-y-4">
                  {updates.map((update) => (
                    <li key={update.id} className="border-l-2 border-brand-200 pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {update.author?.full_name || (update.author?.role ? ROLE_LABELS[update.author.role] : "System")}
                        </p>
                        {update.status_after ? (
                          <span className="text-xs text-slate-500">
                            → {CONCERN_LABELS[update.status_after as ConcernStatus] ?? update.status_after}
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-400">{formatDateTime(update.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{update.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Add update"
            description={isStaff ? "Post a response and optionally change the ticket status." : "Post a reply to this concern."}
          />
          <form action={addConcernUpdate} className="card-body space-y-3">
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <Field label="Message">
              <textarea className="textarea" name="message" required />
            </Field>
            {isStaff ? (
              <Field label="Set status">
                <select className="select" name="status" defaultValue={ticket.status}>
                  {CONCERN_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{CONCERN_LABELS[status]}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            <div className="flex justify-end">
              <SubmitButton pendingText="Posting…">Add update</SubmitButton>
            </div>
          </form>
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              {NOTIFICATION_LABELS.concern} tickets are tracked until resolved. Scholars cannot modify the status directly.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
