import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createRequirement, toggleRequirement } from "@/app/actions/compliance";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, Field, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { AcademicPeriod, Requirement } from "@/lib/types";

export const metadata = { title: "Requirements" };

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  await requireRole("administrator", "scholarship_staff");
  const supabase = await createClient();

  const { data: periodsData } = await supabase
    .from("academic_periods")
    .select("*")
    .order("start_date", { ascending: false })
    .returns<AcademicPeriod[]>();
  const periods = periodsData ?? [];
  const selectedPeriod =
    periods.find((period) => period.id === params.period) ??
    periods.find((period) => period.is_active) ??
    periods[0] ??
    null;

  let requirements: Requirement[] = [];
  if (selectedPeriod) {
    const { data } = await supabase
      .from("requirements")
      .select("*")
      .eq("period_id", selectedPeriod.id)
      .order("name", { ascending: true })
      .returns<Requirement[]>();
    requirements = data ?? [];
  }

  return (
    <div>
      <PageHeader
        title="Requirements"
        description="Define the documentary requirements scholars must satisfy each reporting period."
      />
      <Notice error={params.error} message={params.message} />

      {!selectedPeriod ? (
        <Empty title="No reporting period configured" description="Create a reporting period first under Periods & rules." />
      ) : (
        <div className="space-y-6">
          <Card>
            <form method="get" className="card-body flex flex-wrap items-end gap-3">
              <Field label="Reporting period">
                <select className="select" name="period" defaultValue={selectedPeriod.id}>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name} A.Y. {period.school_year}{period.is_active ? " (active)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="btn-secondary">View period</button>
            </form>
          </Card>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Requirements for the selected period"
                description={
                  <span>
                    {selectedPeriod.name} A.Y. {selectedPeriod.school_year} · {requirements.length} requirement(s)
                  </span>
                }
              />
              <div className="overflow-x-auto">
                {requirements.length === 0 ? (
                  <div className="p-5"><Empty title="No requirements yet" description="Add the first requirement using the form." /></div>
                ) : (
                  <table className="table">
                    <thead className="thead">
                      <tr>
                        <th className="th">Requirement</th>
                        <th className="th">Active</th>
                        <th className="th">Created</th>
                        <th className="th" />
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.map((requirement) => (
                        <tr key={requirement.id} className="row">
                          <td className="td">
                            <p className="font-medium text-slate-800">{requirement.name}</p>
                            {requirement.description ? <p className="text-xs text-slate-500">{requirement.description}</p> : null}
                          </td>
                          <td className="td">
                            <Badge tone={requirement.is_active ? "green" : "slate"}>
                              {requirement.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="td text-slate-500">{formatDate(requirement.created_at)}</td>
                          <td className="td text-right">
                            <form action={toggleRequirement}>
                              <input type="hidden" name="id" value={requirement.id} />
                              <input type="hidden" name="period_id" value={selectedPeriod.id} />
                              <input type="hidden" name="is_active" value={requirement.is_active ? "false" : "true"} />
                              <SubmitButton className="btn-ghost" pendingText="Updating…">
                                {requirement.is_active ? "Disable" : "Enable"}
                              </SubmitButton>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Add requirement" description="New requirements apply to the selected period." />
              <form action={createRequirement} className="card-body space-y-3">
                <input type="hidden" name="period_id" value={selectedPeriod.id} />
                <Field label="Requirement name">
                  <input className="input" name="name" placeholder="Certificate of Enrollment" required />
                </Field>
                <Field label="Description">
                  <textarea className="textarea" name="description" placeholder="What the document proves or how it is validated." />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton pendingText="Adding…">Add requirement</SubmitButton>
                </div>
              </form>
            </Card>
          </div>

          <p className="text-sm text-slate-500">
            Scholar document statuses are recorded from a scholar record.{" "}
            <Link className="font-semibold text-brand-700 hover:underline" href="/scholars">
              Open scholars
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
