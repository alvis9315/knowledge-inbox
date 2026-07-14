# Knowledge Inbox

個人知識收件匣:貼上文字 / URL / 照片 → 自動分類歸檔 → 卡牆瀏覽與搜尋。
解決「有用資訊散落在 LINE 收藏、無法歸檔、無法找到、無法重複利用」的問題。

- **Description**: A personal knowledge inbox web app that auto-classifies and files web snippets, links, and photos with Claude, built with Vue 3, Tailwind CSS, and Supabase (Postgres + pgvector + Edge Functions).
- **正本規格**: 見 [`PLAN.md`](PLAN.md)(single source of truth)
- **可見性**: private(含個人知識與 API key 風險,勿轉 public)

## Features(目前 — Phase 1 MVP)

- 手動新增 / 編輯 / 刪除 entry,依類型 **schema-driven** 動態長出屬性欄位
- 卡牆瀏覽,依領域 / 類型 / 標籤篩選
- 關鍵字搜尋(標題 / 摘要 / 內容)
- 標籤管理與篩選
- 「一天不接 LLM 也能用」:核心歸檔功能不依賴 AI

> LLM 自動分類(`/ingest` + Claude Haiku)、URL 正文擷取、pgvector 語意搜尋、LINE bot / PWA
> 入口為 Phase 2+,骨架已就位。詳見 [`PLAN.md`](PLAN.md) Phase 規劃。

## Tech stack

| 層 | 選型 |
|---|---|
| 前端 | Vue 3 + Vite + TypeScript + Vue Router + Pinia |
| 樣式 | Tailwind CSS v4(`@tailwindcss/vite`)|
| 資料存取 | `@supabase/supabase-js`(前端直連,RLS 把關)|
| 後端 | Supabase Edge Functions(Deno / TS,只有 `/ingest`)|
| DB | Postgres(Supabase)+ pgvector |
| AI | Claude Haiku 4.5(Edge Function 內,key 只在伺服端)|
| Monorepo | pnpm workspace |

## Project structure

```
apps/web/            Vue 3 主網站(收件匣 UI)
packages/shared-types/  DB 型別(supabase gen types 產出)
supabase/migrations/ DB schema + seed + RLS
supabase/functions/ingest/  Edge Function 骨架
docs/                架構 / 資料模型 / 規範文件
PLAN.md              規格正本
```

## Requirements

- Node.js **22**(見 `.nvmrc`)
- pnpm(`corepack enable pnpm`)

## Setup

```bash
nvm use                 # 使用 .nvmrc 指定的 Node 22
corepack enable pnpm    # 若尚未啟用 pnpm
pnpm install
cp apps/web/.env.example apps/web/.env   # 填入 Supabase URL / anon key
```

> 首次啟動前需先建立 Supabase 專案並套用 migration — 見 [`docs/setup-guide.md`](docs/setup-guide.md)。

## Development

```bash
pnpm dev        # = pnpm --filter web dev
```

## Build

```bash
pnpm build      # = pnpm --filter web build
pnpm --filter web typecheck
```

## Deployment

- GitHub Pages and OpenAI Sites are supported deployment targets.
- Sites keeps Supabase as the backend and injects the public connection values
  at runtime; no migration to D1 / R2 is required.
- See [`docs/deployment-guide.md`](docs/deployment-guide.md).

## Notes

- API key(`ANTHROPIC_API_KEY`)**永遠只在 Supabase Edge Function 端**,絕不放前端。
- 未設定 Supabase 連線時,畫面會顯示提示並 degrade,不會崩潰。
- 架構決策與 Phase 規劃以 `PLAN.md` 為準;改架構先改 `docs/` 內的 Mermaid 圖再改 code。
