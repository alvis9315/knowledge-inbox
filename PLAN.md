# PLAN — Knowledge Inbox 規格正本

> 本檔是專案的 single source of truth。
> **請使用者把 `knowledge-inbox` 完整規格正本 md(結論分析文件)貼到這裡取代本段。**
>
> Scaffold 產生器刻意不自行編造規格內容,避免與正本不一致。
> 貼上後,架構/流程若有變動,先改本檔與 `docs/architecture.md` 的 Mermaid 圖,再改 code。

## 目前已實作範圍(scaffold 附註,貼上正本後可整併)

- Monorepo scaffold(pnpm workspace):`apps/web`、`packages/shared-types`、`supabase/`
- Phase 0 骨架:DB migration(schema + seed + RLS)、Edge Function `ingest` 骨架
- Phase 1 MVP:手動新增 / 編輯 / 刪除 / 改分類 entry、卡牆瀏覽、關鍵字搜尋、tag 篩選(supabase-js 直連)
- **URL metadata 擷取**:`/extract` Edge Function(og / oEmbed / Maps 店名)+
  QuickCapture 標題自動填、描述進分類評分——已實作,SSRF / deadline 強化中
  (規格:`docs/proposals/link-meta-no-ai.md`),**尚未部署**
- **無 AI 分類**:規則分類器(網域對照 + 關鍵字加權)+ 回饋自學字典
  (localStorage 正本 + `learned_weights` 雲端鏡像);filed 門檻 confidence > 0.85
- **Collections**(2026-07-15,原 Phase 4 提前):entry 引用制集合 + 拖曳排序 + 筆記

## 尚未實作(依 Phase 規劃)

- Phase 2:`/ingest` 接 Claude Haiku 分類、URL **正文**擷取(metadata 已由 /extract 覆蓋)、信心分流
- Phase 3:embedding + pgvector 語意搜尋、Realtime、LINE bot、PWA share target
- Phase 4:links、graph view(collections 已提前完成)
- Phase 5:Obsidian 匯出、本地 LLM
