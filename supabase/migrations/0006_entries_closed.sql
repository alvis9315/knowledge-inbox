-- 美食 entries use 「歇業」 (closed) instead of deletion, so a shop's data is kept
-- but hidden from the default list. Applies generally; only surfaced for 美食.

alter table entries add column if not exists closed boolean not null default false;
create index if not exists entries_closed_idx on entries (closed);
