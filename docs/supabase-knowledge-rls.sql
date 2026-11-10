-- Row-level security for the chat knowledge tables.
-- Run in the Supabase SQL editor (Dashboard -> SQL Editor).
--
-- Model: signed-in app users can READ both tables; nobody can write through the
-- API. Writes happen only with the service-role key (which bypasses RLS), e.g.
-- from the ETL pipeline or the dashboard. The anon role gets no access, so the
-- tables are not readable before sign-in.

alter table public.ingredients_and_conditions enable row level security;
alter table public.cosmetic_qa enable row level security;

-- Make re-running this script safe.
drop policy if exists "Signed-in users can read ingredients_and_conditions" on public.ingredients_and_conditions;
drop policy if exists "Signed-in users can read cosmetic_qa" on public.cosmetic_qa;

create policy "Signed-in users can read ingredients_and_conditions"
  on public.ingredients_and_conditions
  for select
  to authenticated
  using (true);

create policy "Signed-in users can read cosmetic_qa"
  on public.cosmetic_qa
  for select
  to authenticated
  using (true);

-- No insert/update/delete policies exist, so those are denied for anon and
-- authenticated by default. Also remove the table privileges as a second layer.
revoke all on public.ingredients_and_conditions from anon;
revoke all on public.cosmetic_qa from anon;
revoke insert, update, delete, truncate on public.ingredients_and_conditions from authenticated;
revoke insert, update, delete, truncate on public.cosmetic_qa from authenticated;
grant select on public.ingredients_and_conditions to authenticated;
grant select on public.cosmetic_qa to authenticated;

-- Quick check after running, as a signed-in user:
--   select count(*) from public.cosmetic_qa;
