import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createScholar } from "@/app/actions/scholars";
import { SCHOLAR_LABELS, SCHOLAR_STATUS_OPTIONS } from "@/lib/constants";
import { Card, Field, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Add scholar" };

export default async function NewScholarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireRole("administrator", "scholarship_staff");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Add scholar record"
        description="Create a monitoring record for an active scholar. This does not process a scholarship application."
        actions={
          <Link className="btn-secondary" href="/scholars">
            Back to scholars
          </Link>
        }
      />
      <Notice error={params.error} />

      <Card>
        <form action={createScholar} className="card-body grid gap-4 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2">
            <input className="input" name="full_name" required />
          </Field>
          <Field label="Scholarship reference" hint="Leave blank to generate automatically.">
            <input className="input" name="scholar_ref" placeholder="EDK-2026-0009" />
          </Field>
          <Field label="Email address">
            <input className="input" type="email" name="email" />
          </Field>
          <Field label="School">
            <input className="input" name="school" required />
          </Field>
          <Field label="Program">
            <input className="input" name="program" required />
          </Field>
          <Field label="Year level">
            <input className="input" name="year_level" placeholder="1st Year" required />
          </Field>
          <Field label="Contact number">
            <input className="input" name="contact_number" />
          </Field>
          <Field label="Status">
            <select className="select" name="status" defaultValue="active">
              {SCHOLAR_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {SCHOLAR_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Link className="btn-secondary" href="/scholars">Cancel</Link>
            <SubmitButton pendingText="Creating…">Create scholar record</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
