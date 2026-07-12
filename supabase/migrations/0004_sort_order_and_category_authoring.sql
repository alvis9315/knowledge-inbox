-- Manual ordering + user-authored categories (docs/ux/implementation-brief.md §12)

-- Sidebar / carousel category order.
alter table type_definitions add column if not exists sort_order int not null default 0;
-- Per-category accent color (drives the per-category theming; see ui-style-guide.md).
alter table type_definitions add column if not exists color text;

-- Manual order of entries within a category (drag reorder in the category list).
alter table entries add column if not exists sort_order numeric not null default 0;
create index if not exists entries_type_sort_idx on entries (type, sort_order);

-- Seed a stable initial order for existing categories (by domain, then name).
with ordered as (
  select key, row_number() over (order by domain, name) * 10 as ord
  from type_definitions
)
update type_definitions t set sort_order = ordered.ord
from ordered where ordered.key = t.key and t.sort_order = 0;

-- Allow authenticated users to create / reorder their own categories.
-- Single-user MVP: keep it simple (any authenticated user). Multi-user later
-- would scope by an owner column — see docs/security-guideline.md.
drop policy if exists "type_definitions_insert" on type_definitions;
create policy "type_definitions_insert" on type_definitions
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "type_definitions_update" on type_definitions;
create policy "type_definitions_update" on type_definitions
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Per-category entry counts for the home overview cards. security_invoker makes
-- the view respect the querying user's RLS (Postgres 15+ / Supabase).
create or replace view category_counts
  with (security_invoker = true) as
  select type as key, count(*)::int as n
  from entries
  group by type;
