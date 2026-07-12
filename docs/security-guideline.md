# Security Guideline

## 1. API key 永遠在伺服端

- `ANTHROPIC_API_KEY` **只**存在 Supabase Edge Function 的 secrets:
  ```bash
  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
  ```
- 🚫 絕不放進前端程式碼、`VITE_` 變數、或任何會打包進 bundle 的地方(DevTools 一開就被竊取)。
- 前端只透過呼叫 `/ingest` Edge Function 間接使用 LLM。
- `VITE_SUPABASE_ANON_KEY` 是**設計上可公開**的 anon key,安全性由 RLS 保證(見下)。

## 2. Row Level Security(RLS)

裸露的 Supabase 表任何人拿 anon key 就能讀。所有使用者資料表必須開 RLS。

- `entries`:`auth.uid() = user_id`,owner-only 全操作(migration `0003_rls.sql`)。
- `entries.user_id` 預設 `auth.uid()`,寫入自動綁定當前使用者。
- `type_definitions` / `tags`:共享參考資料,authenticated 可讀。
- `entry_tags` / `collections` / `links` / `classification_feedback`:透過擁有的 entry 綁定。

## 3. Session / 認證

- MVP 用 **anonymous sign-in** 讓 `auth.uid()` 存在,免刻登入表單(`src/services/session.ts`)。
- 需在 Supabase → Authentication → Providers 開啟 "Anonymous sign-ins"。
- ⚠️ **匿名使用者綁定瀏覽器**:清 storage 或換裝置會失去資料歸屬。
  個人知識庫要長期保存 → **Phase 1.5 加 email 登入**,把匿名資料轉正。
- 未來多入口(LINE bot 用 service key 寫入)與物件層權限管理見 `PLAN.md` §7.1。

## 4. 不可 commit

API key、token、cookie、帳密、`.env`、憑證、個資、entries 實際資料、大型資料集、模型檔。
`.gitignore` 已排除 `.env` / `.env.*`(保留 `.env.example`)。commit 前確認 `git status` 無 `.env`。

## 5. 建議(未來)

- 開啟 gitleaks 掃 commit 歷史(repo 雖 private 仍防手滑)
- Edge Function 對 `/ingest` 加 rate limit 與輸入長度上限
- 轉 email auth 後,anon 資料一次性遷移並關閉 anonymous sign-in
