# AGENTS.md — Knowledge Inbox

給 AI Coding Agent 的工作規範。動手前先讀本檔與 `PLAN.md`。

## 專案定位

個人知識收件匣。前端為主(Vue 3),Supabase 直連 DB,只有 ingest pipeline 走 Edge Function。
規格正本是 `PLAN.md`;架構圖是 `docs/architecture.md` / `docs/data-model.md`。改架構先改圖再改 code。

## 積木化設計原則(底層思維)

1. **你是架構師、AI 是工程師**:先看圖(docs/ 的 Mermaid),再實作指定節點。
2. **改 A 不壞 B**:每塊積木職責單一、邊界清楚;寫入必經 Edge Function、讀取靠 RLS,展示層不直通資料層的敏感路徑。
3. **資料按本質存**:entry 是唯一內容體;collection / 行程只引用 id,不複製內容。
4. **設定當資料管理**:類型放 `type_definitions` 表(schema-driven),新增類型零程式碼——它同時是 LLM 規則書與前端 UI schema。
5. **AI 建議、人核准**:LLM 產出走 confidence 分流(>0.85 filed,否則 pending_review),修正回饋進 `classification_feedback` 當 few-shot。
6. **不提前抽象**:共用元件等第二個消費者出現才抽(`packages/ui` 目前不建);核心功能不接 AI 也要能跑。

## 禁止事項

- 禁止 commit:API key、token、`.env`、cookie、帳密、個資、entries 實際資料、大型資料集
- 禁止把 `ANTHROPIC_API_KEY` 放進任何前端程式碼或 `VITE_` 變數(前端可見即外洩)
- 禁止混用 package manager;本專案只用 **pnpm**,不可 `npm install` / 不可留多份 lock file
- 禁止刪除 `pnpm-lock.yaml`
- 禁止把主要畫面寫在 `App.vue`;功能元件不可全塞 `components/`;不可同時建 `pages/` 與 `views/`(統一 `views/`)
- 禁止 commit `node_modules/`、`dist/`、`build/`
- 禁止改動 `supabase/migrations` 已套用檔案的欄位名與 `embedding` 維度(要改用新 migration)
- 禁止過度初始化:本階段不做 Docker、CI/CD、LINE bot、PWA、登入 UI、graph view

## 前端分層防呆

1. 不可把主要畫面寫在 `App.vue`(它只能是 `<AppLayout><RouterView/></AppLayout>`)
2. 功能元件放 `src/features/{feature}/components/`,不可塞 `components/common/`
3. 不可同時建立 `pages/` 與 `views/`
4. API 呼叫放 `src/services/` 或 `src/features/{feature}/api/`,不可寫在 template
5. 資料 mapping / formatting 不塞在 view;Pinia store 不當垃圾桶
6. 即使 MVP,也維持 App / layouts / views / features / components/common / services / router 邊界

## Lazy loading 防呆(2026-07-14 活背景災區教訓)

lazy 的機制是**動態 import**(Vite 見 `() => import(...)` 自動切 chunk、用到才下載);
vite.config 的 `manualChunks` 只能分組不能延遲,unplugin auto-import 只是省打字,兩者都不是 lazy。

1. **路由一律 lazy**:router 的 component 必為 `() => import('@/views/X.vue')`
2. **重型元件必用 `defineAsyncComponent`**:WebGL/canvas(活背景)、重 lib 的元件、
   條件渲染且非首屏必經的大塊功能。判斷基準:該元件(含其依賴)> ~20KB 或非多數人首屏會用到
3. **大型資料/lib 用函式內 `await import()`**:已做 xlsx(匯出才載)、emojibase(開面板才載);
   之後同類(字型檔、大字典、重演算法)照此模式
4. **輕量元件不要 async**:小 modal(幾 KB)async 只會多一次網路 round-trip,沒收益
5. **新增每種主題活背景時,只准以 `defineAsyncComponent` 掛進 AppShell**(主包零成長是硬指標)
6. 驗收方式:`vite build` 看產物清單,新功能的重依賴必須出現在獨立 chunk,不得混進 `index-*.js`

## UI / CSS 防呆

1. UI 樣式統一 Tailwind CSS v4,不混用其他 UI library
2. design token 集中在 `src/assets/styles/main.css` 的 `@theme`,不散落覆寫
3. 重複的 UI pattern 抽成 component,不重貼長 className
4. theme / CSS variables 集中管理

## Node / pnpm 防呆

1. 先確認在 repo root、有無 `package.json`、`node -v` / `pnpm -v`
2. 有 `.nvmrc` 先 `nvm use`(Node 22)
3. 不混用 package manager,不刪 lock file
4. 不 commit `node_modules` / `dist` / `.env`
5. 安裝套件前說明用途(prod / dev、能否用現有替代)
6. 完成前至少跑 `pnpm --filter web build`;失敗必停並回報

## 安裝 / 啟動 / 測試指令

```bash
pnpm install                    # 安裝(root 執行)
pnpm dev                        # 起 dev server
pnpm build                      # 產出 dist
pnpm --filter web typecheck     # vue-tsc 型別檢查
```

## 程式風格

- TypeScript strict;Vue 3 `<script setup lang="ts">`
- 路徑別名 `@/` → `apps/web/src/`
- DB 型別從 `@inbox/shared-types` import,不各自重寫
- **函式一律 `const` + arrow function**(含 event handler、async、工具函式),
  不用 `function` 宣告。核心理由:(1) 與 Composition API 的 `const` 宣告
  風格一致,整檔單一宣告模式;(2) 無 hoisting,依賴關係必然由上而下,
  閱讀順序 = 執行順序。ESLint `func-style` + `prefer-arrow-callback` 強制;
  例外僅限第三方型別明確要求 function 宣告,需附 eslint-disable + 原因。
  ⚠️ 轉換既有 code 時注意 TDZ:`watch(..., { immediate: true })` 等
  註冊當下同步執行的 callback,引用的函式必須宣告在其上方

## Git commit 規則

Conventional Commits(`feat/fix/docs/style/refactor/test/chore/build/ci`);branch `feature/*`、`fix/*`。詳見 `docs/commit-convention.md`。

## OpenAI Sites 部署防呆

1. Sites 僅注入公開的 `SUPABASE_URL` / `SUPABASE_ANON_KEY`;service role 與 Anthropic key 不得進前端
2. 本機仍使用 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,不得為部署寫死正式值
3. Vue Router 使用 history mode,託管層必須對非資產路徑 fallback 至 `index.html`
4. 部署前必跑 typecheck + build,並驗證 `/login`、`/d/:domain`、`/entries/:id` 直接開啟與重新整理
5. 正式網址建立後必須加入 Supabase Redirect URLs,網站預設維持私人直到驗證完成

## 遇到錯誤的處理方式(修復迴路)

指令失敗先做最小可行修復(缺套件補裝、路徑錯修正),最多 2 次;仍失敗停止並回報:錯誤訊息、可能原因、建議修法、是否需改需求。**不得假裝成功**。區分環境問題(自行修)與需求 / 程式問題(問使用者)。
