# Setup Guide

## 前置需求

- Node.js **22**(`nvm use`,見 `.nvmrc`)
- pnpm(`corepack enable pnpm`)
- Supabase 帳號 + 專案
- (Phase 2 才需要)Anthropic Console 帳號 + API key

## 一、本機安裝

```bash
nvm use
corepack enable pnpm
pnpm install
```

## 二、建立 Supabase 專案(Phase 0 人工步驟)

1. 到 [supabase.com](https://supabase.com) 建立 project(免費方案即可),記下 **Project URL** 與 **anon key**(Settings → API)。
2. 套用 DB schema:SQL Editor 依序貼上並執行:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_seed_type_definitions.sql`
   - `supabase/migrations/0003_rls.sql`

   或用 Supabase CLI:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
3. `0001` 已 `create extension vector`;若失敗,Database → Extensions 手動啟用 **vector**。
4. Authentication → Providers → 開啟 **Anonymous sign-ins**(MVP session 需要,見 security-guideline)。

## 三、設定前端環境變數

```bash
cp apps/web/.env.example apps/web/.env
```

填入:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

> anon key 是設計上可公開的;真正的安全邊界是 RLS。`ANTHROPIC_API_KEY` 不放這裡。

## 四、啟動

```bash
pnpm dev          # http://localhost:5173
```

## 五、產生 DB 型別(Phase 1 收尾)

```bash
supabase gen types typescript --project-id <ref> \
  > packages/shared-types/src/database.types.ts
```

覆蓋 placeholder 後,`packages/shared-types/src/index.ts` 的別名保持不變。

## 六、部署 Edge Function(Phase 2)

```bash
supabase functions deploy ingest
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## Human TODO 快速清單

- [ ] 建 Supabase 專案,記下 URL / anon key
- [ ] 執行三個 migration(schema / seed / rls)
- [ ] 確認 pgvector extension 已啟用
- [ ] 開啟 Anonymous sign-ins
- [ ] `cp apps/web/.env.example apps/web/.env` 並填值
- [ ] `pnpm dev` 確認可新增 / 瀏覽 entry
- [ ] `supabase gen types` 覆蓋 shared-types
- [ ] (Phase 2)建 Anthropic key、部署 ingest、設 secret
