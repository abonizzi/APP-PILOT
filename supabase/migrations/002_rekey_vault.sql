-- Cambio master password atomico: ricifratura dei payload + nuovi metadati in un'unica transazione.
-- SECURITY INVOKER: le policy RLS restano attive (si toccano solo le righe dell'utente).
create or replace function rekey_vault(new_meta jsonb, payloads jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(payloads) loop
    update service_accounts set encrypted_payload = r->'payload'
     where id = (r->>'id')::uuid and owner_id = auth.uid();
  end loop;
  update profiles set preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{vault}', new_meta)
   where id = auth.uid();
end $$;
revoke all on function rekey_vault(jsonb, jsonb) from public;
grant execute on function rekey_vault(jsonb, jsonb) to authenticated;
