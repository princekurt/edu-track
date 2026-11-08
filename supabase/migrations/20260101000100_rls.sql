-- EduTrack row-level security
-- Implements FR-02 (role-based permissions) and scholar data isolation at the
-- database layer, in addition to server-side checks in the application.

-- ---------------------------------------------------------------------------
-- Helper functions (security definer avoids recursive RLS evaluation)
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_role(roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role = any (roles)
  );
$$;

create or replace function public.owns_scholar(p_scholar uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.scholars where id = p_scholar and profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table academic_periods enable row level security;
alter table program_settings enable row level security;
alter table scholars enable row level security;
alter table requirements enable row level security;
alter table document_submissions enable row level security;
alter table compliance_records enable row level security;
alter table render_hour_records enable row level security;
alter table disbursements enable row level security;
alter table concern_tickets enable row level security;
alter table concern_updates enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[])
  );

create policy profiles_update_admin on profiles
  for update to authenticated
  using (public.has_role(array['administrator']::user_role[]))
  with check (public.has_role(array['administrator']::user_role[]));

create policy profiles_delete_admin on profiles
  for delete to authenticated
  using (public.has_role(array['administrator']::user_role[]));

-- ---------------------------------------------------------------------------
-- reference / settings tables
-- ---------------------------------------------------------------------------
create policy periods_select on academic_periods
  for select to authenticated using (public.is_active_user());

create policy periods_manage on academic_periods
  for all to authenticated
  using (public.has_role(array['administrator']::user_role[]))
  with check (public.has_role(array['administrator']::user_role[]));

create policy settings_select on program_settings
  for select to authenticated using (public.is_active_user());

create policy settings_update on program_settings
  for update to authenticated
  using (public.has_role(array['administrator']::user_role[]))
  with check (public.has_role(array['administrator']::user_role[]));

create policy requirements_select on requirements
  for select to authenticated using (public.is_active_user());

create policy requirements_manage on requirements
  for all to authenticated
  using (public.has_role(array['administrator', 'scholarship_staff']::user_role[]))
  with check (public.has_role(array['administrator', 'scholarship_staff']::user_role[]));

-- ---------------------------------------------------------------------------
-- scholars
-- ---------------------------------------------------------------------------
create policy scholars_select on scholars
  for select to authenticated
  using (
    public.owns_scholar(id)
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[])
  );

create policy scholars_insert on scholars
  for insert to authenticated
  with check (public.has_role(array['administrator', 'scholarship_staff']::user_role[]));

create policy scholars_update on scholars
  for update to authenticated
  using (public.has_role(array['administrator', 'scholarship_staff']::user_role[]))
  with check (public.has_role(array['administrator', 'scholarship_staff']::user_role[]));

create policy scholars_delete on scholars
  for delete to authenticated
  using (public.has_role(array['administrator']::user_role[]));

-- ---------------------------------------------------------------------------
-- document submissions / compliance / render hours
-- ---------------------------------------------------------------------------
create policy submissions_select on document_submissions
  for select to authenticated
  using (
    public.owns_scholar(scholar_id)
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[])
  );

create policy submissions_manage on document_submissions
  for all to authenticated
  using (public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[]))
  with check (public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[]));

create policy compliance_select on compliance_records
  for select to authenticated
  using (
    public.owns_scholar(scholar_id)
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[])
  );

create policy compliance_manage on compliance_records
  for all to authenticated
  using (public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[]))
  with check (public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[]));

create policy render_hours_select on render_hour_records
  for select to authenticated
  using (
    public.owns_scholar(scholar_id)
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[])
  );

create policy render_hours_manage on render_hour_records
  for all to authenticated
  using (public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[]))
  with check (public.has_role(array['administrator', 'scholarship_staff', 'compliance']::user_role[]));

-- ---------------------------------------------------------------------------
-- disbursements
-- ---------------------------------------------------------------------------
create policy disbursements_select on disbursements
  for select to authenticated
  using (
    public.owns_scholar(scholar_id)
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[])
  );

create policy disbursements_manage on disbursements
  for all to authenticated
  using (public.has_role(array['administrator', 'disbursement']::user_role[]))
  with check (public.has_role(array['administrator', 'disbursement']::user_role[]));

-- ---------------------------------------------------------------------------
-- concerns
-- ---------------------------------------------------------------------------
create policy concerns_select on concern_tickets
  for select to authenticated
  using (
    public.owns_scholar(scholar_id)
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[])
  );

create policy concerns_insert on concern_tickets
  for insert to authenticated
  with check (
    public.owns_scholar(scholar_id)
    or public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[])
  );

create policy concerns_update on concern_tickets
  for update to authenticated
  using (public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[]))
  with check (public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[]));

create policy concerns_delete on concern_tickets
  for delete to authenticated
  using (public.has_role(array['administrator']::user_role[]));

create policy concern_updates_select on concern_updates
  for select to authenticated
  using (
    exists (select 1 from concern_tickets t where t.id = ticket_id)
  );

create policy concern_updates_insert on concern_updates
  for insert to authenticated
  with check (
    exists (select 1 from concern_tickets t where t.id = ticket_id)
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create policy notifications_select on notifications
  for select to authenticated using (recipient_id = auth.uid());

create policy notifications_update on notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy notifications_insert_staff on notifications
  for insert to authenticated
  with check (public.has_role(array['administrator', 'scholarship_staff', 'compliance', 'disbursement']::user_role[]));

create policy notifications_delete on notifications
  for delete to authenticated
  using (recipient_id = auth.uid() or public.has_role(array['administrator']::user_role[]));

-- ---------------------------------------------------------------------------
-- audit logs (written only by security-definer triggers)
-- ---------------------------------------------------------------------------
create policy audit_select on audit_logs
  for select to authenticated
  using (public.has_role(array['administrator']::user_role[]));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
