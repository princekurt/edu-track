-- EduTrack core schema
-- Run in the Supabase SQL editor (or `supabase db push`) before first use.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerated values (controlled status vocabularies)
-- ---------------------------------------------------------------------------
create type user_role as enum ('administrator', 'scholarship_staff', 'compliance', 'disbursement', 'scholar');
create type account_status as enum ('pending', 'active', 'disabled');
create type scholar_status as enum ('active', 'inactive', 'graduated');
create type requirement_status as enum ('pending', 'submitted', 'verified', 'rejected');
create type compliance_status as enum ('pending', 'compliant', 'non_compliant');
create type disbursement_status as enum ('pending', 'processing', 'released', 'on_hold');
create type concern_status as enum ('open', 'in_progress', 'resolved');
create type notification_type as enum ('reminder', 'flag', 'info', 'concern');
create type notification_status as enum ('unread', 'read');

create sequence scholar_ref_seq;
create sequence ticket_seq;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role user_role not null default 'scholar',
  status account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academic_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_year text not null,
  semester text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_year, semester)
);

create table program_settings (
  id integer primary key default 1 check (id = 1),
  required_render_hours integer not null default 100 check (required_render_hours > 0),
  carry_forward_enabled boolean not null default true,
  deadline_warning_days integer not null default 30 check (deadline_warning_days >= 0),
  updated_at timestamptz not null default now()
);

create table scholars (
  id uuid primary key default gen_random_uuid(),
  scholar_ref text not null unique
    default ('EDK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('scholar_ref_seq')::text, 4, '0')),
  profile_id uuid unique references profiles (id) on delete set null,
  full_name text not null,
  email text,
  school text,
  program text,
  year_level text,
  contact_number text,
  status scholar_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table requirements (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references academic_periods (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (period_id, name)
);

create table document_submissions (
  id uuid primary key default gen_random_uuid(),
  scholar_id uuid not null references scholars (id) on delete cascade,
  requirement_id uuid not null references requirements (id) on delete cascade,
  status requirement_status not null default 'pending',
  submitted_reference text,
  reviewer_id uuid references profiles (id) on delete set null,
  remarks text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scholar_id, requirement_id)
);

create table compliance_records (
  id uuid primary key default gen_random_uuid(),
  scholar_id uuid not null references scholars (id) on delete cascade,
  period_id uuid not null references academic_periods (id) on delete cascade,
  status compliance_status not null default 'pending',
  verifier_id uuid references profiles (id) on delete set null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scholar_id, period_id)
);

create table render_hour_records (
  id uuid primary key default gen_random_uuid(),
  scholar_id uuid not null references scholars (id) on delete cascade,
  period_id uuid not null references academic_periods (id) on delete cascade,
  activity text not null,
  hours numeric(6, 2) not null check (hours > 0),
  remarks text,
  recorded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Each row is an appended status update. The latest row per scholar + period is
-- the current reported status; earlier rows form the auditable history.
create table disbursements (
  id uuid primary key default gen_random_uuid(),
  scholar_id uuid not null references scholars (id) on delete cascade,
  period_id uuid not null references academic_periods (id) on delete cascade,
  benefit_type text not null default 'Allowance',
  amount numeric(12, 2) check (amount is null or amount >= 0),
  status disbursement_status not null default 'pending',
  status_date date not null default current_date,
  reference text,
  remarks text,
  recorded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table concern_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique
    default ('TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('ticket_seq')::text, 4, '0')),
  scholar_id uuid not null references scholars (id) on delete cascade,
  subject text not null,
  description text not null,
  status concern_status not null default 'open',
  assigned_to uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table concern_updates (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references concern_tickets (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  message text not null,
  status_after concern_status,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type notification_type not null default 'info',
  status notification_status not null default 'unread',
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Default row + helpers
-- ---------------------------------------------------------------------------
insert into program_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on profiles
  for each row execute function public.set_updated_at();
create trigger trg_scholars_updated before update on scholars
  for each row execute function public.set_updated_at();
create trigger trg_submissions_updated before update on document_submissions
  for each row execute function public.set_updated_at();
create trigger trg_compliance_updated before update on compliance_records
  for each row execute function public.set_updated_at();
create trigger trg_concerns_updated before update on concern_tickets
  for each row execute function public.set_updated_at();
create trigger trg_settings_updated before update on program_settings
  for each row execute function public.set_updated_at();

-- New auth users always start as a pending scholar. Elevated roles are only
-- assigned server-side with the service-role key, never from client metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'scholar',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Activating a scholar account links an existing unlinked scholar record with
-- the same email when one exists, otherwise it creates a new scholar record.
create or replace function public.handle_scholar_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'scholar' and new.status = 'active' then
    if coalesce(new.email, '') <> '' then
      update public.scholars
         set profile_id = new.id
       where profile_id is null
         and lower(coalesce(email, '')) = lower(new.email);

      if found then
        return new;
      end if;
    end if;

    insert into public.scholars (profile_id, full_name, email)
    values (new.id, new.full_name, new.email)
    on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_profile_scholar_activated
  after insert or update of role, status on profiles
  for each row execute function public.handle_scholar_activation();
