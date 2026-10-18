-- Dati specifici del singolo progetto per ogni servizio (URL, ID, API key...): i campi non segreti stanno in
-- public_metadata, quelli segreti in encrypted_payload (cifrati nel browser con la master password).
alter table project_services add column if not exists encrypted_payload jsonb;
