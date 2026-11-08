import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Audit log" };

interface AuditLog {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  details: unknown;
  created_at: string;
}

const ACTION_TONES = {
  INSERT: "green",
  UPDATE: "blue",
  DELETE: "red",
} as const;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  await requireRole("administrator");
  const supabase = await createClient();

  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<AuditLog[]>();
  const logs = data ?? [];

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Security- and accountability-relevant record changes, captured automatically with the acting user and timestamp."
      />
      <Notice error={params.error} message={params.message} />

      <Card>
        <CardHeader title="Recent activity" description={`${logs.length} most recent event(s).`} />
        <div className="overflow-x-auto">
          {logs.length === 0 ? (
            <div className="p-5"><Empty title="No audit events yet" description="Record changes will appear here." /></div>
          ) : (
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Actor</th>
                  <th className="th">Action</th>
                  <th className="th">Table</th>
                  <th className="th">Record</th>
                  <th className="th">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="row">
                    <td className="td whitespace-nowrap text-slate-500">{formatDateTime(log.created_at)}</td>
                    <td className="td">
                      <p>{log.actor_email || "System / service"}</p>
                      {log.actor_id ? <p className="text-xs text-slate-400">{log.actor_id.slice(0, 8)}…</p> : null}
                    </td>
                    <td className="td">
                      <Badge tone={ACTION_TONES[log.action as keyof typeof ACTION_TONES] ?? "slate"}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="td font-mono text-xs">{log.table_name}</td>
                    <td className="td font-mono text-xs text-slate-500">{log.record_id ?? "—"}</td>
                    <td className="td">
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-brand-700">View</summary>
                        <pre className="mt-2 max-w-lg overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
