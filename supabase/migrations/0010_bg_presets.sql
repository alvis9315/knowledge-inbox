-- 0010: 活背景「方案存檔」跨裝置同步
-- 每人每種活背景一列;payload 存整組方案(active 索引 + 最多 10 套參數)。
-- 前端 fail-soft:此表未建立時功能照常(僅 localStorage),建立後自動開始同步。

create table if not exists public.bg_presets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.bg_presets enable row level security;

-- RLS:只能讀寫自己的方案。
drop policy if exists "bg_presets_own" on public.bg_presets;
create policy "bg_presets_own" on public.bg_presets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
