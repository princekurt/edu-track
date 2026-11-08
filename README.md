# EduTrack

A web-based **compliance management and disbursement monitoring system** for the EduKar Scholarship Program of General Santos City, built to support the capstone manuscript of the same name.

EduTrack consolidates monitoring records for already-active scholars while preserving the office's mandatory in-person document verification and keeping actual fund transfers inside the LGU's existing financial process.

- **Stack:** Next.js 15 (App Router, TypeScript) + Supabase (PostgreSQL, Auth, Row-Level Security)
- **Hosting target:** Vercel
- **UI:** Tailwind CSS, server components, progressive-enhancement forms (server actions)

---

## Feature coverage (FR-01 – FR-14)

| ID | Requirement | Where it is implemented |
|----|-------------|--------------------------|
| FR-01 | Authentication with active/invalid account handling | Supabase Auth, `src/app/actions/auth.ts`, middleware |
| FR-02 | Role-based permissions; blocked unauthorized actions | Postgres RLS (`20260101000100_rls.sql`) + `requireRole` guards |
| FR-03 | Create/view/update scholar records | `/scholars`, `/scholars/new`, `/scholars/[id]` |
| FR-04 | Requirements and terms linked to scholar + period | `requirements`, `document_submissions`, scholar detail |
| FR-05 | Document verification recorded only by authorized roles | Submission updates restricted to staff/compliance roles |
| FR-06 | Render hours with office-approved carry-forward | `src/lib/render-hours.ts`, scholar detail |
| FR-07 | Disbursement status + history, attributable, no fund transfer | Append-only `disbursements`, `/disbursements`, scholar detail |
| FR-08 | Concern tickets Open → In Progress → Resolved with history | `concern_tickets`, `concern_updates`, `/concerns` |
| FR-09 | Reminders and non-compliance flags | Dashboard flags + `generateReminders` action |
| FR-10 | Search and filtering | `/scholars`, `/disbursements`, `/admin/users` |
| FR-11 | Dashboard totals reconciled with records | `/dashboard` |
| FR-12 | Compliance, render-hour, and disbursement reports | `/reports` + CSV export `/api/reports/[type]` |
| FR-13 | Audit events with actor and timestamp | DB triggers (`20260101000200_audit.sql`), `/admin/audit` |
| FR-14 | Account creation and role assignment | `/admin/users`, `src/app/actions/admin.ts` |

Five roles are supported: **Administrator, Scholarship Staff, Compliance Personnel, Disbursement Personnel, Scholar**.

---

## Prerequisites

- Node.js 20+ (built with Node 22)
- A Supabase project (free tier is enough for the capstone pilot)

## 1. Create the Supabase project

1. Create a project at <https://supabase.com>.
2. In **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it)

## 2. Apply the database migrations

Open **SQL Editor** in Supabase and run these files in order:

1. `supabase/migrations/20260101000000_init.sql`
2. `supabase/migrations/20260101000100_rls.sql`
3. `supabase/migrations/20260101000200_audit.sql`
4. `supabase/seed.sql` (optional synthetic demo data)

Or with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies the migrations
# then paste supabase/seed.sql into the SQL editor
```

> The seed inserts synthetic scholars, periods, requirements, render hours, compliance records, disbursements, and concerns. It contains no real personal data.

## 3. Configure authentication

In **Authentication → Providers → Email**:

- For a quick local/demo setup, **disable “Confirm email”** so new accounts are usable immediately.
- For a stricter setup, keep confirmation on and add these URLs under **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000` (and your Vercel URL in production)
  - Redirect URL: `http://localhost:3000/auth/callback` (and the production equivalent)

## 4. Create the first administrator

Accounts created directly in **Authentication → Users** receive a pending-scholar profile from a database trigger. Promote the first one to administrator with SQL:

```sql
insert into public.profiles (id, email, full_name, role, status)
select id, email, 'Scholarship Administrator', 'administrator', 'active'
from auth.users
where email = 'admin@example.com'
on conflict (id) do update
  set role = 'administrator', status = 'active';
```

After signing in as that administrator, use **Account management** to create the rest of the staff accounts.

### Demo scholar login

To try the scholar portal with the seeded data:

1. Register in the app using an email that matches a seeded scholar, e.g. `maria.santos@example.com`.
2. Sign in as the administrator and approve the pending account.
3. Approval automatically links the existing `EDK-2026-0001` record (matched by email), so the seeded render hours, requirements, disbursements, and concerns appear.

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill in the values (the build also accepts placeholders, but the app needs real values to run):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 6. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## 7. Deploy to Vercel

1. Push this folder to a Git repository.
2. Import the project in Vercel.
3. Add the three environment variables above (Production and Preview).
4. Deploy. No special build configuration is required (`npm run build`).
5. Add the Vercel domain to Supabase **URL Configuration** so authentication redirects work.

---

## Project structure

```
src/
  app/
    (app)/                 authenticated shell + pages
      dashboard/           role-aware dashboard and flags
      scholars/            list, create, detail workspace
      requirements/        requirement definitions per period
      disbursements/       status history + recording
      concerns/            ticket list and detail/history
      notifications/       reminders and flags
      reports/             compliance / render-hour / disbursement reports
      admin/users/         account approval, creation, roles
      admin/periods/       reporting periods + program rules
      admin/audit/         audit trail
    actions/               server actions for every workflow
    api/reports/[type]/    CSV export
    login, register, pending, auth/callback
  components/              shared UI, sidebar, forms
  lib/
    auth.ts                session/profile guards
    render-hours.ts        carry-forward computation
    reports.ts             shared report builder
    supabase/              server + service-role clients
supabase/
  migrations/              schema, RLS, audit triggers
  seed.sql                 synthetic demo data
```

## Business-rule assumptions

These are configurable in **Periods & rules** and should be confirmed with the Scholarship Coordinating Office:

- **Render hours:** 100 per semester (configurable), with **excess above the requirement carried forward** to the next semester.
- **Disbursement statuses:** Pending, Processing, Released, On hold. Each entry is an append-only status update; the latest per scholar/period is current.
- **Accounts:** administrators create staff accounts; scholars self-register and require administrator approval.
- **Document verification:** recorded in the system but performed in person; the system does not verify document authenticity.
- **Funds:** the system displays reported status only and never transfers or authorizes funds.

## Security notes

- Row-Level Security enforces scholar data isolation and role permissions at the database, not only in the UI.
- The `service_role` key is used only in server actions (`src/lib/supabase/admin.ts`) for account provisioning and must never be exposed client-side.
- Audit triggers record create/update/delete events on scholar, compliance, render-hour, disbursement, concern, and account tables.
- Use synthetic or masked data during development and demonstrations; do not load real LGU records into a cloud project without authorization.
