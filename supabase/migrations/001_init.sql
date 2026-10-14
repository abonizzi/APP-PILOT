-- AppPilot: schema iniziale + RLS. Eseguire nello SQL Editor di Supabase.
create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  icon text default '🚀',
  tags text[] not null default '{}',
  status text not null default 'idea'
    check (status in ('idea','work_in_progress','to_deploy','deployed','updating')),
  public_url text check (public_url is null or public_url ~ '^https://'),
  repository_url text check (repository_url is null or repository_url ~ '^https://'),
  published_at timestamptz,
  last_deployed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on projects (owner_id, status);

create table project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('completed','future_improvements')),
  title text, content text not null default '',
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on project_notes (project_id);

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null, description text, category text, icon text,
  sort_order int not null default 0,
  is_enabled boolean not null default true,
  is_required boolean not null default false,
  field_schema jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Copie indipendenti dei modelli: template_id resta null se il modello viene eliminato.
create table project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  template_id uuid references checklist_templates on delete set null,
  name text not null, description text, category text, icon text,
  status text not null default 'todo' check (status in ('todo','done','not_applicable')),
  sort_order int not null default 0,
  notes text, link text, custom_data jsonb not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on project_checklist_items (project_id, sort_order);

-- Solo email/username in chiaro; password e token solo in encrypted_payload (AES-GCM lato client).
create table service_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  service_type text not null,
  label text not null, email text, username text, login_url text,
  project_reference text,
  non_sensitive_metadata jsonb not null default '{}',
  encrypted_payload jsonb, -- {v, salt, iv, ct} in base64
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  service_account_id uuid references service_accounts on delete set null,
  service_type text not null,
  configuration_status text not null default 'missing'
    check (configuration_status in ('missing','partial','configured')),
  public_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, service_type)
);

create table project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  url text not null check (url ~ '^https://'),
  category text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Storico versioni: promemoria delle patch notes. AppPilot NON esegue deploy:
-- "published" significa che l'utente ha confermato a mano di aver pubblicato altrove (es. Netlify).
create table project_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  version_label text not null,
  patch_title text,
  patch_changes text, patch_improvements text, patch_fixes text, patch_extra text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check (status <> 'published' or published_at is not null)
);
create index on project_releases (project_id, created_at desc);

-- Trigger updated_at + RLS: ogni tabella accessibile solo al proprietario.
do $$
declare t text;
begin
  foreach t in array array['projects','project_notes','checklist_templates','project_checklist_items',
    'service_accounts','project_services','project_links','project_releases','profiles']
  loop
    execute format('create trigger trg_%1$s_upd before update on %1$I for each row execute function set_updated_at()', t);
    execute format('alter table %I enable row level security', t);
  end loop;
  foreach t in array array['projects','project_notes','checklist_templates','project_checklist_items',
    'service_accounts','project_services','project_links','project_releases']
  loop
    execute format('create policy "owner_all" on %I for all to authenticated
      using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
create policy "own_profile" on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Registrazioni pubbliche: disabilitarle da Auth > Providers > Email > "Allow new users to sign up".
