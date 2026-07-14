-- 0012: 自學字典(規則分類器的關鍵詞權重)跨裝置同步
-- 每人一列,payload 存整本字典(分類 key → 詞 → 權重),比照 bg_presets 模式。
-- 前端 fail-soft:此表未建立時功能照常(僅 localStorage),建立後自動開始同步。

create table if not exists public.learned_weights (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.learned_weights enable row level security;

drop policy if exists "learned_weights_own" on public.learned_weights;
create policy "learned_weights_own" on public.learned_weights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
