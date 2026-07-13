-- 0009 — 同大類別下子類別名稱唯一(DB 層防線)。
-- 背景:前端有重複檢查,但它比對的是前端快取,在「建立成功但畫面未刷新」
-- 的窗口下會失效(實際發生:餐酒館 ×5)。唯一約束才是真正的守門員。

-- 1) 清掉歷史重複:每組 (domain, name) 保留最早的一筆,其餘刪除;
--    引用到被刪者的 entries 先改指向保留者。
update entries e
set type = r.keep_key
from (
  select key,
         first_value(key) over (partition by domain, name order by sort_order, created_at, key) as keep_key,
         row_number()     over (partition by domain, name order by sort_order, created_at, key) as rn
  from type_definitions
) r
where e.type = r.key and r.rn > 1;

delete from type_definitions t
using (
  select key,
         row_number() over (partition by domain, name order by sort_order, created_at, key) as rn
  from type_definitions
) r
where t.key = r.key and r.rn > 1;

-- 2) 唯一約束:之後任何路徑(前端漏接、併發、腳本)都插不進重複名稱。
create unique index if not exists ux_type_definitions_domain_name
  on type_definitions (domain, name);
