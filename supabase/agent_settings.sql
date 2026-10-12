-- Run once in Supabase → SQL Editor (project farmer_retailer).
-- Stores the settings you edit from the website's Settings panel.
-- The agent reads them at the start of every call.
create table if not exists public.agent_settings (
  id text primary key default 'default',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table public.agent_settings is
  'Voice/behaviour settings edited from the website Settings panel; read by the agent at the start of every call.';
insert into public.agent_settings (id, settings) values ('default', '{}'::jsonb)
  on conflict (id) do nothing;

-- Backend only: the browser can never read or write this table directly.
alter table public.agent_settings enable row level security;
revoke all on public.agent_settings from anon, authenticated;

create or replace function public.agent_settings_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_agent_settings_updated on public.agent_settings;
create trigger trg_agent_settings_updated before update on public.agent_settings
  for each row execute function public.agent_settings_touch();
