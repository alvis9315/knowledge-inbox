-- Row Level Security (PLAN.md Phase 0).
-- A bare Supabase table is readable by anyone holding the anon key. Every table
-- holding user data must enable RLS and scope rows to the signed-in user.

-- Category definitions are shared reference data: readable by any authenticated
-- user, writable only by the owner via the service role (Edge Function / admin).
alter table type_definitions enable row level security;
drop policy if exists "type_definitions_read" on type_definitions;
create policy "type_definitions_read" on type_definitions
  for select using (auth.role() = 'authenticated');

-- entries: owner-only, all operations.
alter table entries enable row level security;
drop policy if exists "entries_own_data" on entries;
create policy "entries_own_data" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tags are shared vocabulary; readable by authenticated users, insertable by them.
alter table tags enable row level security;
drop policy if exists "tags_read" on tags;
create policy "tags_read" on tags
  for select using (auth.role() = 'authenticated');
drop policy if exists "tags_insert" on tags;
create policy "tags_insert" on tags
  for insert with check (auth.role() = 'authenticated');

-- entry_tags: scoped through the owning entry.
alter table entry_tags enable row level security;
drop policy if exists "entry_tags_own" on entry_tags;
create policy "entry_tags_own" on entry_tags
  for all using (
    exists (select 1 from entries e where e.id = entry_tags.entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_tags.entry_id and e.user_id = auth.uid())
  );

-- collections / collection_entries / links / classification_feedback:
-- scope to the owner. For MVP (single user) these are simple; multi-user or
-- multi-entrypoint (LINE bot via service key) will refine these — see
-- docs/security-guideline.md.
alter table collections enable row level security;
drop policy if exists "collections_authenticated" on collections;
create policy "collections_authenticated" on collections
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table collection_entries enable row level security;
drop policy if exists "collection_entries_own" on collection_entries;
create policy "collection_entries_own" on collection_entries
  for all using (
    exists (select 1 from entries e where e.id = collection_entries.entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = collection_entries.entry_id and e.user_id = auth.uid())
  );

alter table links enable row level security;
drop policy if exists "links_own" on links;
create policy "links_own" on links
  for all using (
    exists (select 1 from entries e where e.id = links.from_entry and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = links.from_entry and e.user_id = auth.uid())
  );

alter table classification_feedback enable row level security;
drop policy if exists "classification_feedback_own" on classification_feedback;
create policy "classification_feedback_own" on classification_feedback
  for all using (
    exists (select 1 from entries e where e.id = classification_feedback.entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = classification_feedback.entry_id and e.user_id = auth.uid())
  );
