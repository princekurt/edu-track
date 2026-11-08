import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPeriod, setActivePeriod, updateSettings } from "@/app/actions/periods";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, Field, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { AcademicPeriod, ProgramSettings } from "@/lib/types";

export const metadata = { title: "Periods & rules" };

export default async function AdminPeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  await requireRole("administrator");
  const supabase = await createClient();

  const [periodsResult, settingsResult] = await Promise.all([
    supabase.from("academic_periods").select("*").order("start_date", { ascending: false }).returns<AcademicPeriod[]>(),
    supabase.from("program_settings").select("*").eq("id", 1).maybeSingle<ProgramSettings>(),
  ]);

  const periods = periodsResult.data ?? [];
  const settings = settingsResult.data;

  return (
    <div>
      <PageHeader
        title="Periods & program rules"
        description="Configure reporting periods and the office-approved render-hour rules used by the system."
      />
      <Notice error={params.error} message={params.message} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Reporting periods" description="Only one period is active at a time." />
          <div className="overflow-x-auto">
            {periods.length === 0 ? (
              <div className="p-5"><Empty title="No reporting periods yet" description="Create the first period using the form." /></div>
            ) : (
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Period</th>
                    <th className="th">Dates</th>
                    <th className="th">Status</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.id} className="row">
                      <td className="td">
                        <p className="font-medium text-slate-800">{period.name}</p>
                        <p className="text-xs text-slate-500">A.Y. {period.school_year} · {period.semester}</p>
                      </td>
                      <td className="td text-slate-500">
                        {formatDate(period.start_date)} – {formatDate(period.end_date)}
                      </td>
                      <td className="td">
                        <Badge tone={period.is_active ? "green" : "slate"}>
                          {period.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="td text-right">
                        {period.is_active ? null : (
                          <form action={setActivePeriod}>
                            <input type="hidden" name="id" value={period.id} />
                            <SubmitButton className="btn-ghost" pendingText="…">Set active</SubmitButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Create period" />
          <form action={createPeriod} className="card-body space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="School year">
                <input className="input" name="school_year" placeholder="2026-2027" required />
              </Field>
              <Field label="Semester">
                <input className="input" name="semester" placeholder="1st Semester" required />
              </Field>
            </div>
            <Field label="Display name (optional)">
              <input className="input" name="name" placeholder="1st Semester A.Y. 2026-2027" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <input className="input" type="date" name="start_date" required />
              </Field>
              <Field label="End date">
                <input className="input" type="date" name="end_date" required />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="is_active" className="h-4 w-4 rounded border-slate-300" />
              Make this the active period
            </label>
            <div className="flex justify-end">
              <SubmitButton pendingText="Creating…">Create period</SubmitButton>
            </div>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Render-hour and deadline rules"
          description="These values drive render-hour computation and reminder flags. Confirm them with the scholarship office."
        />
        {settings ? (
          <form action={updateSettings} className="card-body grid gap-4 sm:grid-cols-3">
            <Field label="Required render hours per semester">
              <input
                className="input"
                type="number"
                name="required_render_hours"
                min="1"
                defaultValue={settings.required_render_hours}
                required
              />
            </Field>
            <Field label="Deadline warning window (days)">
              <input
                className="input"
                type="number"
                name="deadline_warning_days"
                min="0"
                defaultValue={settings.deadline_warning_days}
                required
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="carry_forward_enabled"
                defaultChecked={settings.carry_forward_enabled}
                className="h-4 w-4 rounded border-slate-300"
              />
              Apply carry-forward for excess hours
            </label>
            <div className="sm:col-span-3 flex justify-end">
              <SubmitButton pendingText="Saving…">Save program rules</SubmitButton>
            </div>
          </form>
        ) : (
          <div className="card-body"><Empty title="Program settings not found" description="Run the migrations to create the settings row." /></div>
        )}
      </Card>
    </div>
  );
}
