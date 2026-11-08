-- EduTrack demo data (synthetic only)
-- Run after the three migrations. Safe to run once; scholar/reference rows use
-- fixed IDs and conflict guards so re-runs do not duplicate reference records.

-- Academic periods ---------------------------------------------------------
insert into academic_periods (id, name, school_year, semester, start_date, end_date, is_active) values
  ('c1000000-0000-4000-8000-000000000001', '2nd Semester', '2025-2026', '2nd Semester', '2026-01-15', '2026-05-31', false),
  ('c1000000-0000-4000-8000-000000000002', '1st Semester', '2026-2027', '1st Semester', '2026-08-01', '2026-12-15', true),
  ('c1000000-0000-4000-8000-000000000003', '2nd Semester', '2026-2027', '2nd Semester', '2027-01-15', '2027-05-31', false)
on conflict (school_year, semester) do nothing;

-- Requirements for the active period ----------------------------------------
insert into requirements (id, period_id, name, description) values
  ('a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'Certificate of Enrollment', 'Proof of enrollment for the current semester.'),
  ('a1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'Grade Report', 'Grades from the previous semester.'),
  ('a1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'Certificate of Good Moral Character', 'Issued by the school.'),
  ('a1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'Render Hour Completion Form', 'Signed summary of rendered community or office service.')
on conflict (period_id, name) do nothing;

-- Scholars ------------------------------------------------------------------
insert into scholars (id, scholar_ref, full_name, email, school, program, year_level, status) values
  ('b1000000-0000-4000-8000-000000000001', 'EDK-2026-0001', 'Maria Santos', 'maria.santos@example.com', 'Mindanao State University - General Santos', 'BS Information Technology', '3rd Year', 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'EDK-2026-0002', 'John Paul Reyes', 'johnpaul.reyes@example.com', 'Mindanao State University - General Santos', 'BS Computer Science', '2nd Year', 'active'),
  ('b1000000-0000-4000-8000-000000000003', 'EDK-2026-0003', 'Aisha Macabalang', 'aisha.macabalang@example.com', 'Mindanao State University - General Santos', 'BS Accountancy', '4th Year', 'active'),
  ('b1000000-0000-4000-8000-000000000004', 'EDK-2026-0004', 'Kevin Lim', 'kevin.lim@example.com', 'Holy Trinity College', 'BS Nursing', '2nd Year', 'active'),
  ('b1000000-0000-4000-8000-000000000005', 'EDK-2026-0005', 'Grace Villanueva', 'grace.villanueva@example.com', 'Ramon Magsaysay Memorial Colleges', 'BS Education', '3rd Year', 'active'),
  ('b1000000-0000-4000-8000-000000000006', 'EDK-2026-0006', 'Mark Anthony Dela Cruz', 'mark.delacruz@example.com', 'Mindanao State University - General Santos', 'BS Civil Engineering', '1st Year', 'active'),
  ('b1000000-0000-4000-8000-000000000007', 'EDK-2026-0007', 'Sheena Mae Ocampo', 'sheena.ocampo@example.com', 'GenSan Doctors College', 'BS Radiologic Technology', '3rd Year', 'active'),
  ('b1000000-0000-4000-8000-000000000008', 'EDK-2026-0008', 'Jamal Usman', 'jamal.usman@example.com', 'Mindanao State University - General Santos', 'BS Biology', '2nd Year', 'active')
on conflict (id) do nothing;

-- Document submissions --------------------------------------------------------
insert into document_submissions (scholar_id, requirement_id, status, submitted_reference, remarks, verified_at)
select
  s.id,
  r.id,
  case
    when s.id = 'b1000000-0000-4000-8000-000000000004' and r.name = 'Grade Report' then 'rejected'::requirement_status
    when r.name in ('Certificate of Enrollment', 'Certificate of Good Moral Character') then 'verified'::requirement_status
    when s.id in ('b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000007')
      and r.name in ('Grade Report', 'Render Hour Completion Form') then 'verified'::requirement_status
    else 'pending'::requirement_status
  end,
  'REF-' || right(s.scholar_ref, 4) || '-' || left(md5(r.name), 4),
  case when s.id = 'b1000000-0000-4000-8000-000000000004' and r.name = 'Grade Report'
       then 'Blurred copy; please resubmit the signed original.' end,
  case when r.name in ('Certificate of Enrollment', 'Certificate of Good Moral Character')
       then now() - interval '12 days' end
from scholars s
cross join requirements r
where r.period_id = 'c1000000-0000-4000-8000-000000000002'
on conflict (scholar_id, requirement_id) do nothing;

-- Render hours (previous term + current term) --------------------------------
insert into render_hour_records (scholar_id, period_id, activity, hours, remarks)
select * from (values
  ('b1000000-0000-4000-8000-000000000001'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'Community clean-up and office assistance', 120.00, 'Excess carries forward'),
  ('b1000000-0000-4000-8000-000000000002'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'Barangay tutoring program', 100.00, null),
  ('b1000000-0000-4000-8000-000000000003'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'Office clerical support', 80.00, null),
  ('b1000000-0000-4000-8000-000000000004'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'Health center assistance', 130.00, 'Excess carries forward'),
  ('b1000000-0000-4000-8000-000000000005'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'School outreach', 60.00, null),
  ('b1000000-0000-4000-8000-000000000006'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'Coastal clean-up', 110.00, null),
  ('b1000000-0000-4000-8000-000000000007'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'Community health drive', 100.00, null),
  ('b1000000-0000-4000-8000-000000000008'::uuid, 'c1000000-0000-4000-8000-000000000001'::uuid, 'Library assistance', 90.00, null),
  ('b1000000-0000-4000-8000-000000000001'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 'Office records assistance', 30.00, null),
  ('b1000000-0000-4000-8000-000000000002'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 'Community clean-up', 45.00, null),
  ('b1000000-0000-4000-8000-000000000003'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 'Barangay tutorial sessions', 100.00, null),
  ('b1000000-0000-4000-8000-000000000004'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 'Clinic assistance', 20.00, null),
  ('b1000000-0000-4000-8000-000000000005'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 'School feeding program', 55.00, null),
  ('b1000000-0000-4000-8000-000000000007'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 'Hospital support service', 110.00, null),
  ('b1000000-0000-4000-8000-000000000008'::uuid, 'c1000000-0000-4000-8000-000000000002'::uuid, 'Environmental awareness drive', 35.00, null)
) as v(scholar_id, period_id, activity, hours, remarks)
where not exists (select 1 from render_hour_records);

-- Compliance records for the active period -----------------------------------
insert into compliance_records (scholar_id, period_id, status, remarks)
select s.id, 'c1000000-0000-4000-8000-000000000002',
  case
    when s.id in ('b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000007') then 'compliant'::compliance_status
    when s.id in ('b1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000006') then 'non_compliant'::compliance_status
    else 'pending'::compliance_status
  end,
  case
    when s.id = 'b1000000-0000-4000-8000-000000000004' then 'Rejected grade report and insufficient render hours.'
    when s.id = 'b1000000-0000-4000-8000-000000000006' then 'No render hours recorded for the term.'
  end
from scholars s
on conflict (scholar_id, period_id) do nothing;

-- Disbursement status history for the active period --------------------------
insert into disbursements (scholar_id, period_id, benefit_type, amount, status, status_date, reference, remarks)
select s.id, 'c1000000-0000-4000-8000-000000000002', 'Allowance', 5000.00, st.status::disbursement_status,
       current_date - st.days_ago, 'DV-' || right(s.scholar_ref, 4) || '-' || st.status, null
from scholars s
join (values
  ('pending', 21),
  ('processing', 12)
) as st(status, days_ago) on true
where not exists (select 1 from disbursements);

insert into disbursements (scholar_id, period_id, benefit_type, amount, status, status_date, reference, remarks)
select s.id, 'c1000000-0000-4000-8000-000000000002', 'Allowance', 5000.00, 'released'::disbursement_status,
       current_date - 5, 'DV-' || right(s.scholar_ref, 4) || '-released', 'Released through the LGU financial process.'
from scholars s
where s.id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000007')
  and not exists (
    select 1 from disbursements d
    where d.scholar_id = s.id and d.status = 'released'
  );

-- Concern tickets ------------------------------------------------------------
insert into concern_tickets (id, ticket_no, scholar_id, subject, description, status, resolved_at) values
  ('d1000000-0000-4000-8000-000000000001', 'TKT-2026-0001', 'b1000000-0000-4000-8000-000000000001', 'Delayed allowance release', 'My allowance for this semester has not been released and I would like to check the status.', 'open', null),
  ('d1000000-0000-4000-8000-000000000002', 'TKT-2026-0002', 'b1000000-0000-4000-8000-000000000004', 'Rejected grade report', 'My grade report was rejected. I want to clarify what needs to be corrected.', 'in_progress', null),
  ('d1000000-0000-4000-8000-000000000003', 'TKT-2026-0003', 'b1000000-0000-4000-8000-000000000006', 'Render hour clarification', 'Please confirm whether coastal clean-up hours are counted.', 'resolved', now() - interval '3 days')
on conflict (id) do nothing;

insert into concern_updates (ticket_id, message, status_after)
select * from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid, 'Concern submitted by the scholar.', 'open'::concern_status),
  ('d1000000-0000-4000-8000-000000000002'::uuid, 'Concern submitted by the scholar.', 'open'::concern_status),
  ('d1000000-0000-4000-8000-000000000002'::uuid, 'Staff requested a clear copy of the signed grade report.', 'in_progress'::concern_status),
  ('d1000000-0000-4000-8000-000000000003'::uuid, 'Concern submitted by the scholar.', 'open'::concern_status),
  ('d1000000-0000-4000-8000-000000000003'::uuid, 'Confirmed: coastal clean-up is an approved community service activity.', 'resolved'::concern_status)
) as v(ticket_id, message, status_after)
where not exists (select 1 from concern_updates);
