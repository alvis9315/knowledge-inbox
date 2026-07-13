-- 0008 — 大類別中繼資料(icon 等)。大類別本身只是 type_definitions.domain
-- 的字串;自訂 icon 需要自己的家(原本寫死在前端 domainIcons.ts,新建
-- 大類別只能拿 📁)。雲端為正本,前端預設表僅作 fallback。

create table if not exists domain_meta (
  domain     text primary key,
  icon       text,
  updated_at timestamptz not null default now()
);

alter table domain_meta enable row level security;
drop policy if exists "domain_meta_all" on domain_meta;
create policy "domain_meta_all" on domain_meta
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
