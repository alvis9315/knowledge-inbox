-- 0011: collections 擁有者化(RLS 補強)
-- 背景:0003 的 collections policy 是 auth.role() = 'authenticated'(MVP 單人
-- 簡化,原檔有註記)——任何登入者皆可讀寫全部 collections。多人前必修。
-- 前端尚未使用 collections,正式庫此表應為空;若非空,見下方回填說明。

-- 1) 加擁有者欄位(新列自動填當前使用者)。
alter table collections
  add column if not exists user_id uuid references auth.users (id) default auth.uid();

-- 2) 既有資料回填:表為空時本步驟無事發生。
--    若表已有資料,下一步的 set not null 會「大聲失敗」——此時先確認歸屬,
--    手動執行:update collections set user_id = '<owner-uuid>' where user_id is null;
--    再重跑本檔。絕不自動猜測擁有者。
alter table collections
  alter column user_id set not null;

create index if not exists collections_user_id_idx on collections (user_id);

-- 3) policy 換成擁有者限定(與 entries 同款)。
drop policy if exists "collections_authenticated" on collections;
drop policy if exists "collections_own" on collections;
create policy "collections_own" on collections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
