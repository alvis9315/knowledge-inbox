# Visual Reference Guide

> Full 軌參考來源拆解(skill visual-design.md §12.3)。核心不是模仿,是拆解可遷移的設計原則再重組。
> 研究來源見文末 Sources。

## 風格公式

```
mymind 的零摩擦捕捉與極簡卡牆
+ Raindrop.io 的 collection 側欄與 capture→categorize→resurface 流程
+ Linear / Nuxt UI 的可收合側欄與鍵盤友善
+ figureshot-lab 的 Embla 慣性 / 自動輪播手感
= Minimal Capture Inbox × Collection Workspace × Calm Dashboard
```

## Reference:mymind

- Use for:首頁氛圍、快捷捕捉框、卡片極簡呈現
- Keep:一框丟進去的零摩擦、視覺極簡、留白、AI 自動整理心智模型、強搜尋
- Avoid:純無分類哲學(本專案要可自建分類)、其專屬配色 / 字體
- Transform:保留「丟進去就好」,但加上可核准的分類路由與 collection
- Priority:High

## Reference:Raindrop.io

- Use for:側欄 collection 結構、分類頁工具列、視圖切換
- Keep:collection 側欄、List / Card 視圖切換、capture→categorize→resurface、篩選 + 全文搜尋
- Avoid:過度功能密度、廣告 / 升級提示
- Transform:collection → 我們的 type_definitions 分類 + collections;三視圖精簡為 List / Card
- Priority:High

## Reference:Linear / Nuxt UI Dashboard

- Use for:固定可收合側欄、TopBar、⌘K 指令面板、鍵盤律
- Keep:256px↔64px 收合 + icon tooltip + 狀態記憶、乾淨排版、鍵盤優先
- Avoid:專案管理特定語意(issue / cycle)
- Transform:導覽項改為「全部 / 待確認 / 分類樹」
- Priority:Medium

## Reference:figureshot-lab(自家)

- Use for:首頁分類卡片雙排輪播
- Keep:Embla loop 無限循環 + auto-scroll 連續捲、autoplay 可暫停、`prefers-reduced-motion` 不自動播、慣性拖曳手感
- Avoid:電影感滿版 Hero、光暈、超級英雄配色
- Transform:單排 Hero 輪播 → 上下兩排反向 auto-scroll 的分類卡片牆,一顆鈕控制兩排
- Priority:High(輪播技術主參考)

## 版權

只借結構、流程、互動邏輯與動效節奏;不移植任何來源的字體、Logo、專屬色、原圖片。

## Sources(研究)

- [mymind 評測 / 定位](https://www.producthunt.com/products/my-mind/reviews)、[mymind 指南](https://skywork.ai/skypage/en/mymind-Your-AI-Powered-Digital-Brain-%E2%80%93-A-Comprehensive-Guide-for-AI-Enthusiasts/1972840147367030784)
- [Raindrop 當 PKM](https://www.xda-developers.com/raindrop-second-brain/)、[PKM with Raindrop](https://irtizahafiz.medium.com/personal-knowledge-management-pkm-system-with-raindrop-and-bear-1106a47dbfb8)
- [Collapsible sidebar best practices](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)、[Nuxt UI DashboardSidebarCollapse](https://ui.nuxt.com/docs/components/dashboard-sidebar-collapse)
- [vue-draggable-plus vs vuedraggable](https://npm-compare.com/vue-draggable-plus,vuedraggable)
- [Tailwind v4 dark mode](https://tailwindcss.com/docs/dark-mode)、[custom variant data-theme](https://schoen.world/n/tailwind-dark-mode-custom-variant)
- [SheetJS 匯出](https://docs.sheetjs.com/docs/getting-started/examples/export/)
