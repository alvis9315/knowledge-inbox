# Supabase 配置與操作規範(本專案專用)

> 本專案沒有自建後端:資料庫(PostgreSQL)、登入(Auth)、伺服器端擷取(Edge Function)
> 全部由 Supabase 提供。前端直連,安全靠 RLS。
> 資料表清單與 ERD 見 [`data-model.md`](./data-model.md)。

## 1. 金鑰與環境變數

| 金鑰 | 放哪 | 性質 |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `apps/web/.env` | **可公開**(前端本來就帶著跑),權限被 RLS 限制 |
| `SUPABASE_SERVICE_ROLE_KEY` | 專案根目錄 `.env`(gitignored) | **絕密**:繞過所有 RLS,只給本機腳本(如 `scripts/export-taxonomy.mjs`)用,永不進前端、永不貼對話 |

## 2. Migration 流程(改資料庫的唯一正道)

1. 新增 `supabase/migrations/00XX_描述.sql`(編號遞增,一檔 = 一次變更:建表/改欄位/種子/索引)
2. 開 Supabase Dashboard → **SQL Editor** → 貼上該檔內容 → Run(**每個編號只貼一次,永久生效**)
3. **同一個 commit** 必須同步:
   - `docs/data-model.md`(資料表清單 + ERD + migration 對照表)
   - 跑 `node scripts/build-all-migrations.mjs` 重生彙總檔
4. 日常資料讀寫(新增分類、歸檔、存方案)是程式透過 API 自動進行,與 SQL Editor 無關

### ALL_MIGRATIONS_paste_into_sql_editor.sql 是什麼

- **由腳本產生,不要手改**:`node scripts/build-all-migrations.mjs` 把 0001~最新串成一份
- **只給全新環境用**(例如未來開第二個 Supabase 專案做正式站):整貼一次 = 完整建庫
- **現有專案永遠只貼新編號的個別檔案**,不要重貼整份(種子資料會重複、部分語句非冪等)

## 3. RLS 慣例(安全的真防線)

- 使用者資料表一律 `alter table … enable row level security` + policy `auth.uid() = user_id`
- 新表沒掛 RLS 前,前端等於裸奔——**建表與 RLS 必須在同一個 migration**(參考 0010)
- 唯一性等資料完整性靠 **DB 約束**(unique index),前端檢查只是 UX 提示(0009 的教訓)

## 4. Edge Functions(伺服器端程式)

- 現有:`supabase/functions/extract/index.ts`(og 擷取、YouTube oEmbed、Maps 地點)
- 部署方式:Dashboard → Edge Functions → 該函式 → 貼上整份 index.ts 覆蓋 → Deploy
  (repo 內的檔案是正本,Dashboard 是部署目標;編輯器對 `jsr:` import 的紅線無害)
- 函式內驗 JWT(登入者才能呼叫)+ SSRF 防護;錯誤訊息一律中文

## 5. 前端接 Supabase 的專案慣例

- **雙資料源**:`isMock()` 分流——訪客/Demo 走 localStorage,登入走 Supabase;
  兩邊行為必須一致(mock 也要模擬 DB 約束,如重名 throw)
- **fail-soft 分級**:裝飾性資料(domain_meta 的 icon、bg_presets 方案)讀寫失敗
  只 console.warn、不弄壞主流程;核心資料(entries、分類)失敗必須明確中文報錯
- 錯誤訊息經 `humanError()` 翻譯層,原始錯誤只進 console

## 6. 常見操作速查

| 想做什麼 | 去哪 |
|---|---|
| 看現在實際有哪些表/資料 | Dashboard → Table Editor |
| 執行一次性查詢/貼 migration | Dashboard → SQL Editor |
| 看登入使用者 | Dashboard → Authentication |
| 部署/看 extract 函式 log | Dashboard → Edge Functions |
| 匯出分類樹快照 | `node scripts/export-taxonomy.mjs`(需根目錄 .env 的 service key) |
| 資料表結構正本 | [`docs/data-model.md`](./data-model.md) |

---
*建立於 2026-07-14,回應「Supabase 怎麼處理資料庫」系列提問。新增 migration 時若流程有變,先改本文件再動工。*
