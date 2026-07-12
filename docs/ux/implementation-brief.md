# Implementation Brief — Knowledge Inbox 網頁端 UX

> 視覺軌:**Full**。本檔是網頁端設計正本(source of truth),定案自 2026-07-12 使用者需求 + 網路參考研究。
> 改 UX 先改本檔與 `ui-flow.md`,再改 code。UI 技術選型見 `../ui-style-guide.md`,RWD 見 `../rwd-guideline.md`。

## 1. 風格公式

```
Minimal Capture Inbox (mymind)
× Collection Workspace (Raindrop.io)
× Calm Collapsible Dashboard (Linear / Nuxt UI / shadcn)
```

極簡、冷靜、零摩擦捕捉,互動流暢不花俏,UX 直觀。深 / 淺雙色。

## 2. 全域框架(固定三區)

```
┌─ 固定頂端列 TopBar ────────────────────────────┐
│ logo · 全域搜尋(⌘K) · 快捷捕捉 · 主題切換      │  ← 功能可再調
├──────────┬─────────────────────────────────────┤
│ 固定側欄  │  主內容區(路由切換)                 │
│ (可收合)  │  · 首頁 = 分類卡片雙排輪播            │
│  分類樹   │  · 分類頁 = 項目列表(多視圖)         │
│  可拖曳   │  · 詳情頁                            │
└──────────┴─────────────────────────────────────┘
```

- **TopBar 固定**:不隨捲動移動。內容(暫定,待定案):品牌 + 全域搜尋(⌘K 指令面板)+ 快捷捕捉鈕 + 主題切換。
- **側欄固定 + 可收合**(256px ↔ 64px icon rail,狀態存 localStorage):
  - 快捷:搜尋、快捷捕捉
  - 導覽:全部 / 待確認(badge 數)
  - 分類樹:依 domain(生活 / 技術)分組,底下列各分類,可展開收合
  - 分類可**拖曳排序**(vue-draggable-plus);排序寫回 `type_definitions.sort_order`
  - 底部:主題切換、設定
- **拖曳分類後**:首頁輪播卡片順序同步跟著新 `sort_order` 重排。

## 3. 首頁 = 分類卡片雙排輪播

- 主內容區預設顯示「所有分類」為卡片,分**上下兩排輪播**(carousel)。
- 卡片不大,一個橫幅可見 **4–5 張**。
- **上排持續緩慢往左移、下排持續緩慢往右移**(反向)。
- **一顆暫停鈕同時控制兩排**(play / pause)。
- 技術:`embla-carousel-vue` + `embla-carousel-auto-scroll`(跟 figureshot-lab 同一套:loop 無限循環;上排 direction=forward、下排=backward;`stopOnInteraction:false`,滑鼠可拖)。
- `prefers-reduced-motion` → **不自動跑**,退化為可手動拖曳 / 捲動的靜態卡列。
- 卡片內容:分類 icon(emoji)+ 名稱 + 筆數 + 最近幾筆標題預覽。
- **點任一卡片 → 進入該分類的項目列表頁**。

## 4. 分類頁 = 項目列表(多視圖 + 工具列)

進入某分類後:

- **視圖切換鈕**:列表 List ↔ 卡片 Card 兩種模式。
- **工具列**:篩選(Filter)、排序(Sort:手動 / 最新 / 標題)、關鍵字搜尋(Search)。
- **分頁查詢**:筆數會變多 → 分頁(supabase `.range()`,每頁 30);搭配即時 client 端篩選(在已載入集合上即時比對顯示)。
  - 搜尋策略:輸入即時篩選目前頁;送出則對整個分類做 server 查詢分頁。
  - (待討論)資料量大時可換 `vue-virtual-scroller` 快速滑動;先不加依賴,分頁優先。
- **項目列表可拖曳排序**(手動排序模式下啟用),寫回 `entries.sort_order`。
- **點個別項目 → 詳情頁**。

## 5. 詳情頁

欄位:分類徽章(= 該項目的類別,以標籤呈現)+ 自由 tags、標題、領域、摘要、完整內容、全部屬性(schema-driven)、來源連結、confidence、狀態(filed / pending_review)、建立 / 更新時間、關聯(Phase 4)。

動作列:編輯、刪除、改分類、**匯出(md / json / excel)**。

## 6. 匯出(md / json / excel)

三種格式,範圍:單筆 / 單分類 / 目前篩選結果。

- **JSON**:原生序列化。
- **Markdown**:frontmatter + 內文(鋪路 Phase 5 Obsidian 匯出)。
- **Excel**:`xlsx`(SheetJS)純前端;**點下去才 `import()` 動態載入**,避免肥 bundle。attrs 攤平成欄。

## 7. AI 分類路由(Phase 2,先做佇列 UI)

「AI 建議、人核准」防 taxonomy drift:

- Claude 拿全部 `type_definitions` → 回既有 `type` key 或 `type:"new"` + `new_type_proposal`。
- 信心分流:既有 >0.85 自動歸(filed);既有 <0.85 進待確認(附建議);**新類別永不自動建**,進「新類別提案」佇列讓使用者核准(近似既有時提示「是不是想選 X」)。
- 修正 → `classification_feedback` → 之後 few-shot。
- Phase 1 先把「待確認」側欄入口 + `pending_review` 狀態 + 審核畫面做好,AI 之後接。

## 8. 元件模組化(features 分層,不提前抽 packages/ui)

```
apps/web/src/
├─ layouts/AppShell.vue          固定 TopBar + 側欄 + 主區
├─ features/
│  ├─ theme/            useTheme + ThemeToggle
│  ├─ capture/          QuickCapture(單框 + 進階收合)
│  ├─ categories/       CategoryTree(側欄拖曳)/ CategoryCard / CategoryCarousels / OverviewHome
│  ├─ entries/          EntryList / EntryListItem / EntryCard / EntryToolbar / EntryForm / EntryDetail / useExport
│  └─ search/           CommandPalette(⌘K)
└─ components/common/   Base*(Button/Input/Modal/Select/LoadingState/Pagination/IconButton)
```

依 PLAN §7.3:等第二個消費者出現才抽到 `packages/ui`;現在留在 apps/web。

## 9. 動效與互動律(§14,全部受 prefers-reduced-motion 管)

- 輪播:緩慢等速;reduced-motion 停自動播。
- 卡片 reveal:translateY 24px + opacity,500–700ms,進 viewport 觸發。
- hover / 點擊回饋:120–320ms,transform / opacity 優先。
- 拖曳:Sortable 動畫 + optimistic UI(先動再非同步存)。
- 每個核心元件狀態:Default / Hover / Active / Selected / Disabled / Loading / Empty / Error。

## 10. RWD

- 側欄:桌機固定可收合;手機 → drawer(漢堡開)。
- 首頁輪播:手機一排可見 ~1.5 張;reduced-motion / 窄螢幕減動。
- 分類頁工具列:手機收進「篩選 / 排序」drawer;列表單欄。
- 拖曳:手機改「上移 / 下移」鈕較好按。
- 詳情屬性:手機單欄。測試 375/390/430/768/1024/1280。

## 11. 補充的疏漏(已納入)

⌘K 指令面板、鍵盤快捷(⌘Enter 送出 / n 新增 / / 搜尋)、optimistic 拖曳、拖曳鍵盤替代、重複 source_url 偵測、icon 套件(lucide + emoji)、主題預設跟隨系統可手動覆蓋。

## 12. 資料模型改動(migration 0004)

- `type_definitions.sort_order int default 0`(側欄 / 輪播分類排序)
- `entries.sort_order numeric default 0`(分類內手動排序)
- 放寬 `type_definitions` 的 insert policy 給 authenticated(自建分類);單人 MVP 先簡單。
