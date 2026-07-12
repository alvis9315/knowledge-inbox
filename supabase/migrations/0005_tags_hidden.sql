-- Tag management: soft-hide instead of hard delete (renaming a tag propagates
-- via entry_tags' FK, so no data is affected). See TagManager.

alter table tags add column if not exists hidden boolean not null default false;

-- Allow authenticated users to rename / hide their tags.
drop policy if exists "tags_update" on tags;
create policy "tags_update" on tags
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
