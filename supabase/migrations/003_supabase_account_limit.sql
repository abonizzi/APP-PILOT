-- Ogni account Supabase può essere associato a un massimo di 2 progetti (limite applicato dal database).
create or replace function enforce_supabase_account_limit() returns trigger
language plpgsql security invoker set search_path = public as $$
declare t text; n int;
begin
  if new.service_account_id is null then return new; end if;
  select service_type into t from service_accounts where id = new.service_account_id;
  if t is distinct from 'Supabase' then return new; end if;
  select count(*) into n from project_services
   where service_account_id = new.service_account_id and service_type = 'Supabase' and id <> new.id;
  if n >= 2 then
    raise exception 'Questo account Supabase ha già 2 progetti associati: è occupato.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_supabase_account_limit on project_services;
create trigger trg_supabase_account_limit
  before insert or update of service_account_id on project_services
  for each row execute function enforce_supabase_account_limit();
