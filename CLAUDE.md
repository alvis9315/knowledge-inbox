# CLAUDE.md

Claude Code 在本 repo 工作時的內容脈絡與規則。完整工作規範見 [`AGENTS.md`](AGENTS.md),規格正本見 [`PLAN.md`](PLAN.md)。

## Project context

個人知識收件匣(Knowledge Inbox)。前端為主的 Vue 3 web app + Supabase(Postgres / Edge Function)+ Claude 分類。pnpm monorepo。目前完成 Phase 1 MVP(手動歸檔可用);LLM 自動分類為 Phase 2+。

## User preferences

- 規格正本、架構圖是 single source of truth;改架構先改 `docs/` 的 Mermaid 圖再改 code
- 重視積木化邊界(見 AGENTS.md 六原則),不提前抽象
- 安全優先:API key 只在伺服端、RLS 預設開

## Coding style

- TypeScript strict、Vue 3 `<script setup lang="ts">`、Tailwind CSS v4
- 路徑別名 `@/` → `apps/web/src/`
- DB 型別統一從 `@inbox/shared-types` import

## Folder structure

```
apps/web/src/
  layouts/  views/  features/{entries,tags,types}/  components/common/
  router/  stores/  services/  composables/  constants/  utils/
packages/shared-types/   DB 型別
supabase/migrations/     schema + seed + RLS
supabase/functions/ingest/  Edge Function 骨架
docs/                    架構 / 資料模型 / 規範
```

## Development workflow

1. 動手前:`pwd`、`ls`、`git status --short`,讀 AGENTS.md + PLAN.md
2. 對照 `docs/architecture.md` 找到要實作的節點
3. 實作 → `pnpm --filter web typecheck` → `pnpm --filter web build`
4. 更新 `docs/worklog.md`

## Safety rules

- 不 commit `.env` / API key / 個資 / entries 資料
- `ANTHROPIC_API_KEY` 只在 Edge Function,不進前端
- 只用 pnpm,不刪 lock file,不混 package manager
- App.vue 只當 shell;不破壞前端分層邊界
- 失敗處理走修復迴路(最多 2 次),不假裝成功

## Commands

```bash
pnpm dev
pnpm build
pnpm --filter web typecheck
```

OpenAI Sites 的部署與 Supabase runtime config 規範見
[`docs/deployment-guide.md`](docs/deployment-guide.md)。
