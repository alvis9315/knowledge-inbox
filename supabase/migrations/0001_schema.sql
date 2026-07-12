-- Knowledge Inbox — core schema (PLAN.md §3.2)
-- Source of truth: Postgres. Categories are managed AS DATA (type_definitions),
-- content lives in entries, everything else is a way to organise/reference it.

create extension if not exists vector;

-- ── Category definitions: the LLM rulebook AND the frontend UI schema ──
create table if not exists type_definitions (
  key          text primary key,          -- 'food', 'frontend_snippet'
  name         text not null,             -- '美食', '前端片段'
  domain       text not null,             -- '生活' | '技術'
  description  text not null,             -- 「什麼樣的內容屬於這類」→ LLM 分類依據
  attrs_schema jsonb not null default '{}'::jsonb,  -- 該類的屬性欄位定義
  icon         text,
  default_view text not null default 'card',        -- card | map | code
  status       text not null default 'active',      -- active | pending
  created_at   timestamptz not null default now()
);

-- ── Core content table ──
create table if not exists entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) default auth.uid(),  -- RLS 綁定
  type       text references type_definitions(key),
  title      text not null,
  summary    text,                        -- LLM 產生的一句摘要
  content    text,                        -- 原始內容 / 擷取正文
  source_url text,
  attrs      jsonb not null default '{}'::jsonb,  -- 類型專屬屬性
  confidence numeric,                      -- LLM 分類信心 0-1
  status     text not null default 'filed',       -- filed | pending_review
  embedding  vector(384),                 -- pgvector (Phase 3);換模型要一起改維度
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_user_id_idx on entries (user_id);
create index if not exists entries_type_idx on entries (type);
create index if not exists entries_status_idx on entries (status);

-- ── Tags (free-form, many-to-many) ──
create table if not exists tags (
  id   uuid primary key default gen_random_uuid(),
  name text unique not null
);
create table if not exists entry_tags (
  entry_id uuid references entries(id) on delete cascade,
  tag_id   uuid references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

-- ── Collections: composed scenes reference entry ids, never copy content ──
create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
create table if not exists collection_entries (
  collection_id uuid references collections(id) on delete cascade,
  entry_id      uuid references entries(id) on delete cascade,
  sort_order    int not null default 0,
  note          text,
  primary key (collection_id, entry_id)
);

-- ── Links between entries (graph view data source) ──
create table if not exists links (
  from_entry uuid references entries(id) on delete cascade,
  to_entry   uuid references entries(id) on delete cascade,
  relation   text,                        -- 'related' | 'prerequisite' | ...
  primary key (from_entry, to_entry)
);

-- ── Classification feedback (few-shot learning material) ──
create table if not exists classification_feedback (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid references entries(id) on delete set null,
  llm_result jsonb,
  corrected  jsonb,
  created_at timestamptz not null default now()
);

-- ── keep entries.updated_at fresh ──
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entries_set_updated_at on entries;
create trigger entries_set_updated_at
  before update on entries
  for each row execute function set_updated_at();
