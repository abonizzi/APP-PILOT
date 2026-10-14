-- Test di isolamento RLS. Esegui nello SQL Editor di Supabase DOPO 001/002. Termina con ROLLBACK: non lascia dati.
-- Esito: "RLS OK" in fondo; in caso di falla compare un'eccezione che inizia con FALLITO.
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@test.local');

-- Utente A crea dati
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
insert into projects (name) values ('Progetto di A');
insert into service_accounts (service_type, label, email) values ('GitHub', 'Account di A', 'a@test.local');

-- Utente B non deve vedere né toccare nulla di A
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n int;
begin
  if (select count(*) from projects) <> 0 then raise exception 'FALLITO: B legge i progetti di A'; end if;
  if (select count(*) from service_accounts) <> 0 then raise exception 'FALLITO: B legge gli account di A'; end if;
  update projects set name = 'violato'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLITO: B modifica progetti di A'; end if;
  delete from service_accounts; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLITO: B elimina account di A'; end if;
  begin
    insert into projects (name, owner_id) values ('finto', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FALLITO: B inserisce a nome di A';
  exception when sqlstate '42501' then null; end;
end $$;

-- A vede ancora i propri dati intatti
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from projects where name = 'Progetto di A') <> 1 then raise exception 'FALLITO: i dati di A sono stati alterati'; end if;
end $$;

reset role;
select 'RLS OK' as risultato;
rollback;
