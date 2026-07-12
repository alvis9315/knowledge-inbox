# Obsidian 知識圖譜 — 執行規範

> 狀態:PLAN Phase 5 有規劃(單向匯出 Obsidian vault),但先前只有一句話,**沒有明確執行規範**。本檔補上。
> 兩件事要分清楚:
> - **Obsidian 圖譜**(本檔):把資料匯出成 `.md` vault,用 Obsidian 內建 graph view 看關聯。
> - **站內 graph view**(PLAN Phase 4,另案):用 Cytoscape.js / vis-network 在網站內畫 `links`。兩者資料同源、實作不同。

## 核心觀念

Obsidian 的圖譜是**從 note 之間的 `[[wikilink]]` 自動長出來的**。所以要有圖譜,不是「產生一張圖」,而是**把每筆 entry 匯成一個 note,並用 wikilink 表達關聯**,Obsidian 就會自動畫。

DB 是 single source of truth,vault 是**唯讀投影**:單向匯出、可重複覆蓋(避免雙向同步衝突,PLAN §2 已定)。

## Vault 結構

```
knowledge-inbox-vault/
├─ MOC/                         Map of Content(分類索引 note)
│  ├─ 美食.md                    列出該分類所有 entry 的 wikilink
│  ├─ 學習.md
│  └─ …(每個大類別 or 子類別一張)
├─ 美食/
│  ├─ 興波咖啡.md
│  └─ 學校咖啡館.md
├─ 學習/
│  └─ MCP 是什麼.md
└─ tags/                        (選用)每個 tag 一張 note,聚合同標籤
   └─ AI.md
```

## 每筆 entry → note 對應

檔名 = 標題(清掉 `/ : # ^ [ ] |`);標題重複時附短 id 後綴。

```markdown
---
id: <entry id>
type: food_cafe
category: 美食 / 咖啡廳
tags: [咖啡, 台北, 手沖]
source_url: https://…
status: filed
confidence: 0.92
created: 2026-07-12
城市: 台北
價位: $$
推薦品項: 手沖耶加雪菲
---

# 興波咖啡 Simple Kaffa

世界冠軍咖啡師的店,手沖與甜點都強。

## 關聯
- 分類:[[美食]]
- 相關:[[學校咖啡館]]      ← 來自 links 表
- 標籤:[[AI]] 之類(選用)  ← 來自 tags
```

## Wikilink(圖譜連線)產生規則

圖譜的「邊」來自三種 link,依序:

1. **分類 MOC**(必做):每張 MOC note 用 `[[entry 標題]]` 列出所屬 entry;每個 entry note 反向 `[[分類]]`。→ 同分類的點會聚成一團。
2. **entry ↔ entry**(核心):`links` 表的每筆關聯,在兩個 note 互加 `[[對方標題]]`,relation 寫進行內文字。→ 跨分類的知識連結。
3. **tags**(選用):每個 tag 一張 `tags/<tag>.md`,entry note 加 `[[tag]]`;或直接用 Obsidian 原生 `#tag`(不進圖譜)。二選一,預設走 tag note 才會顯示在圖上。

## 匯出機制(兩條路)

| 場景 | 做法 |
|---|---|
| **現在(mock / 無後端)** | 前端「匯出 Obsidian vault(.zip)」按鈕:用 `JSZip` 在瀏覽器產出所有 `.md` + 資料夾,下載 zip,使用者解壓進 Obsidian vault。可立即用 mock 資料原型化。 |
| **接上 Supabase 後** | 同上,前端直接從 DB 撈全量後產 zip;或寫一支 Node script / Edge Function 產 vault 上傳。 |

複用現有 `useExport` 的 Markdown 產生邏輯(已含 frontmatter),再加:MOC 產生、wikilink 注入、資料夾分組、zip 打包。

## 實作步驟(Phase 5,可提前原型)

1. `features/entries/composables/useObsidianExport.ts`:`buildVault(entries, categories, links) → { path: content }[]`
2. 檔名清理 + 重複標題加 id 後綴的工具
3. MOC 產生(每分類一張,列 wikilink)
4. entry note 產生(frontmatter + 內文 + 關聯區塊)
5. `JSZip` 打包 → 下載(新依賴,懶載入)
6. 匯出設定:是否含 tag note、MOC 用大類別或子類別、是否含 pending

## 圓周率式提醒

- vault 是投影:重匯出直接覆蓋,不在 Obsidian 裡改內容期待同步回 DB。
- 站內 graph view(Phase 4)另用 Cytoscape.js 讀同一份 `links`,與本匯出獨立。
- `links` 資料目前多為手動建立;未來可由 LLM 建議「相關 entry」再人工核准(AI 建議、人核准)。
