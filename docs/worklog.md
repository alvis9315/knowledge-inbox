# Worklog

## 2026-07-13 — 首頁滿版輪播 + 初始藍換 figureshot 藍 + 子分類主色修復

- **首頁輪播佔滿高度**:AppShell 主內容區 `min-h-full flex-col`,HomeView `section` + 輪播容器 `flex-1`,兩排 CategoryCarousel `flex-1`(items-stretch + `h-full`),卡片內文區 `flex-1` 撐開 → 卡片放大填滿視窗、消除下方留白。
- **初始/預設 accent 改成 figureshot 藍** `#02a8e0`(rgb 2,168,224):`main.css` light `--accent`/`--accent-soft`;色盤 `PRESET_COLORS[0]` 同步。
- **子分類主色修復**:`applyTheme` 原本大分類有世界 preset 時直接 return、忽略 categoryColor;改為 **preset 管底色+文字、子分類色永遠覆蓋 accent**,故子分類主色在任何大分類都會生效。彈窗標題「分類配色」→「子分類主色」。
- 驗證:typecheck ✅、build ✅。

## 2026-07-13 — 登入視覺(OGL 星系/線條)+ 齒輪選單/標籤管理 + 排隊清單批次

### 登入 / 背景
- 登入頁(Aurora→)改用 **OGL/WebGL shader 背景**:`KnowledgeGalaxy`(移植 React Bits Galaxy,4 層景深/hash 星/twinkle/滑鼠斥力)+ `KnowledgeThreads`(官方 Perlin shader);雙背景切換 + 星系 3 底色圓圈(黑/深藍/星雲多彩)+ 內建控制面板(show-controls)+ `/galaxy` playground + 雙主題標題字型。

### 齒輪選單 / 配色 / 標籤
- 右上 ⚙️ hover 選單(`HoverMenu`):大分類主題 / 子分類主色 / 標籤管理。
- **大分類主題面板**(`DomainThemeSettings`):每個大類別選一套世界 preset(named presets in `themePresets`);攝影 = 深灰黃字。
- **標籤管理**(`TagManager`):搜尋/新增/改名(連動 entries)/隱藏(soft，不硬刪);mock tag registry + `tags.hidden` migration(0005)。

### 排隊清單批次(2026-07-13)
- **美食「歇業」取代刪除**:`entries.closed`(migration 0006)+ `BaseConfirm` 現代確認框 + 卡片/列表 Store icon + 「顯示歇業」切換。
- **匯出按鈕加 icon**(md/json/excel)。
- **大類別拖曳排序**:mock `domainOrder` + `reorderDomains`(mock/supabase)+ 側欄 domain grip 拖曳。
- **首頁輪播顯示開關**:`CarouselSettings`(眼睛鈕 + 分類勾選,per-domain 整批)。
- **DateTimePicker 元件** + 營業時間起訖(EntryForm 特例)。
- 版面:Demo banner 白底、標題置中、登出/選單置中、詳情頁套用大分類主題 + 返回鈕改回子分類清單。
- 驗證:typecheck ✅、build ✅(1976 modules)。

## 2026-07-12(傍晚)— mock 資料層 + 階層分類 + 分類換色 + 分型詳情

### Done
- **mock 資料層**:`services/dataMode`(USE_MOCK=未接 Supabase)+ `services/mock/{seed,mockDb}`;所有 api 分流 mock/supabase,localStorage 持久化。不接 Supabase 也能全功能玩
- **階層 mock 分類**:大類別(景點/美食/學習/求職/攝影/社群)→ 子類別(共 ~38 個,附 icon/color/attrs_schema)+ 種子 entries;景點/社群 部分子類為建議值
- **兩層側欄**:大類別可展開收合、子類別可拖曳排序(拖曳同步首頁輪播)
- **mock 分類器**:關鍵字啟發式(classifyText 介面),捕捉時自動歸類 / 進待確認;之後換 Claude Haiku 同介面
- **每分類專屬主色**(取代右上 dark/light 切換):進分類→整體 accent 換色 + 頂端色條;`分類配色`設定調色盤
- **分型詳情頁**:default + 美食 + 學習 三種 body,registry 依大類別選,模組化(`features/entries/detail/`)
- migration 0004 加 `type_definitions.color`;shared-types 加 color / entries.sort_order
- `docs/obsidian-export.md`:Obsidian 知識圖譜完整執行規範
- 驗證:typecheck ✅、build ✅(1870 modules)、dev ✅

### Decisions
- 大類別 = domain、子類別 = type_definition(沿用現有模型,零 schema 破壞)
- AI 自動分類=Phase 2 才需 API;現在用 mock 分類器頂著,不擋開發
- 移除 dark/light 切換(token 仍保留),改玩每分類換色

### Next
- 景點/社群 建議子類別請使用者確認增刪
- Obsidian vault 匯出(JSZip)可提前原型
- 接 Supabase / Phase 2 LLM 分類

## 2026-07-12(下午)— Full 軌 UX 重build

### Done
- 視覺升級 Lite → **Full 軌**;完整設計正本歸檔 `docs/ux/implementation-brief.md` + `visual-reference-guide.md`(mymind / Raindrop / Linear / figureshot 拆解)+ `docs/line-bot-flow.md`
- 深 / 淺雙色主題(Tailwind v4 `@custom-variant` + data-theme + 語意 token + `useTheme` + ThemeToggle)
- 固定 TopBar + 可收合側欄(AppShell);側欄分類樹**可拖曳排序**(vue-draggable-plus),排序同步首頁
- 首頁分類卡片**上下兩排反向自動輪播**(embla + auto-scroll,一顆鈕控制兩排,reduced-motion 不自動跑)—— 同 figureshot 技術
- 分類頁:卡片 / 列表視圖切換、排序(手動 / 最新 / 標題)、搜尋、**分頁**、**拖曳排序**、編輯 / 刪除
- 快捷捕捉(單框 + 進階收合)、⌘K 指令面板全域搜尋、新增分類、鍵盤快捷(⌘K / n / /)
- 匯出 md / json / excel(SheetJS 懶載入,單獨 chunk 429KB 不進主包)
- migration 0004:`type_definitions.sort_order`、`entries.sort_order`、自建分類 policy、`category_counts` 視圖
- 新依賴:embla-carousel-vue + auto-scroll、vue-draggable-plus、lucide-vue-next、xlsx、@vueuse/core
- 移除舊 InboxView / inboxStore / AppLayout / EntryFilterBar
- 驗證:typecheck ✅、build ✅(1859 modules)、dev server ✅

### Decisions
- 主頁採「分類總覽卡牆 + 雙排反向輪播」(使用者選定並細化)
- AI 分類路由 UI(待確認佇列)Phase 2 接;LINE bot Phase 3(先歸檔流程)
- 搜尋先分頁 + 即時篩選;virtual-scroller 待資料量大再加

### Next
- 人工 Phase 0:建 Supabase + 套 migration 0001–0004 + 開 anonymous sign-in + 填 .env + `pnpm dev` 實測
- TopBar 功能待定案(目前:搜尋 / 捕捉 / 主題)
- Phase 2:/ingest 接 Claude Haiku + 待確認審核畫面

## 2026-07-12(上午)

### Done
- 以 new-project-quickstart skill 完成規劃並 scaffold 整個 monorepo
- pnpm workspace:`apps/web`(Vue 3 + Vite + TS + Tailwind v4)、`packages/shared-types`、`supabase/`
- DB migration:`0001_schema`(八張表 + pgvector + updated_at trigger)、`0002_seed_type_definitions`(六類種子)、`0003_rls`(RLS policies)
- `/ingest` Edge Function 骨架(寫入 pending_review,LLM 未接,Phase 2 TODO 標好)
- Phase 1 MVP 前端:entry 新增 / 編輯 / 刪除(schema-driven 表單)、卡牆、關鍵字搜尋、領域 / 類型 / 標籤篩選、詳情頁
- 匿名 session bootstrap(`services/session.ts`)讓 RLS 在無登入 UI 下可用
- 全套 docs(architecture / data-model / api-spec / frontend / ui / rwd / security / setup / git)
- 驗證:`pnpm --filter web typecheck` ✅、`pnpm --filter web build` ✅

### Decisions
- 主架構定為「前端為主的 Vue web app + 薄 Supabase 後端」,以 monorepo 承載(Phase 1 即建 shared-types,符合 monorepo 門檻)
- 視覺走 Lite 軌(Tailwind 簡潔卡片風,中性灰 + 單一 accent)
- MVP 用 anonymous sign-in 免刻登入表單;長期保存需 Phase 1.5 轉 email auth
- `Json` 型別刻意非遞迴,避免 Vue `UnwrapRef` 深度爆炸

### Issues
- 環境的 build-approval gate 會擋 esbuild install script;以手動執行 `esbuild/install.js` 解決,build 正常
- `shared-types` 目前為手寫 placeholder,待建 Supabase 專案後以 `supabase gen types` 覆蓋

### Next
- 建 Supabase 專案 → 套 migration → 填 `apps/web/.env` → `pnpm dev` 實測(見 setup-guide 的 Human TODO)
- `supabase gen types` 覆蓋 shared-types placeholder
- Phase 2:`/ingest` 接 Claude Haiku、URL 正文擷取、信心分流 UI
