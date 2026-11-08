-- EduTrack audit trail (FR-13)
-- Records create/update/delete events on accountability-relevant tables.

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_record_id text;
  v_actor_email text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_record_id := v_row ->> 'id';
  select email into v_actor_email from public.profiles where id = auth.uid();

  insert into public.audit_logs (actor_id, actor_email, action, table_name, record_id, details)
  values (
    auth.uid(),
    v_actor_email,
    tg_op,
    tg_table_name,
    v_record_id,
    jsonb_build_object('operation', tg_op, 'row', v_row)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_profiles after insert or update or delete on profiles
  for each row execute function public.write_audit_log();
create trigger audit_scholars after insert or update or delete on scholars
  for each row execute function public.write_audit_log();
create trigger audit_submissions after insert or update or delete on document_submissions
  for each row execute function public.write_audit_log();
create trigger audit_compliance after insert or update or delete on compliance_records
  for each row execute function public.write_audit_log();
create trigger audit_render_hours after insert or update or delete on render_hour_records
  for each row execute function public.write_audit_log();
create trigger audit_disbursements after insert or update or delete on disbursements
  for each row execute function public.write_audit_log();
create trigger audit_concerns after insert or update or delete on concern_tickets
  for each row execute function public.write_audit_log();
