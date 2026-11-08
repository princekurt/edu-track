import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteNotification, generateReminders, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { NOTIFICATION_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { AppNotification } from "@/lib/types";

export const metadata = { title: "Notifications" };

const TONES = {
  reminder: "amber",
  flag: "red",
  info: "blue",
  concern: "purple",
} as const;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<AppNotification[]>();
  const notifications = data ?? [];
  const unread = notifications.filter((item) => item.status === "unread").length;

  const canGenerate = ["administrator", "scholarship_staff", "compliance"].includes(profile.role);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Reminders and flags derived from recorded compliance, requirements, and render hours."
        actions={
          <>
            {unread > 0 ? (
              <form action={markAllNotificationsRead}>
                <SubmitButton className="btn-secondary" pendingText="Marking…">Mark all as read</SubmitButton>
              </form>
            ) : null}
            {canGenerate ? (
              <form action={generateReminders}>
                <SubmitButton pendingText="Generating…">Generate reminders</SubmitButton>
              </form>
            ) : null}
          </>
        }
      />
      <Notice error={params.error} message={params.message} />

      <Card>
        <CardHeader title="Your notifications" description={`${unread} unread of ${notifications.length}`} />
        <div className="card-body space-y-3">
          {notifications.length === 0 ? (
            <Empty title="No notifications" description="Compliance reminders and flags will appear here." />
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={
                  notification.status === "unread"
                    ? "rounded-lg border border-brand-200 bg-brand-50/50 p-4"
                    : "rounded-lg border border-slate-200 p-4"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                      <Badge tone={TONES[notification.type] ?? "slate"}>
                        {NOTIFICATION_LABELS[notification.type] ?? notification.type}
                      </Badge>
                      {notification.status === "unread" ? <Badge tone="blue">Unread</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {notification.status === "unread" ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={notification.id} />
                        <SubmitButton className="btn-ghost" pendingText="…">Mark read</SubmitButton>
                      </form>
                    ) : null}
                    <form action={deleteNotification}>
                      <input type="hidden" name="id" value={notification.id} />
                      <SubmitButton className="btn-ghost text-rose-600" pendingText="…">Delete</SubmitButton>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
