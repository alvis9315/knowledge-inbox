# UI Style Guide

## 視覺軌:Full(2026-07-12 升級)

原為 Lite,依使用者需求升級 **Full 軌**。完整設計正本見 `ux/implementation-brief.md`、參考拆解見 `ux/visual-reference-guide.md`。

## 風格方向(一句話)

**極簡冷靜、零摩擦捕捉的知識收件匣:中性灰階 + 單一 accent 藍,固定側欄 + 首頁分類卡片雙排輪播,互動流暢不花俏,深 / 淺雙色。**

## 配色:每分類專屬主色(取代深 / 淺切換)

2026-07-12 改版:**拿掉右上角 dark / light 切換**,改用「每個分類專屬主色」——進入某分類時,整個介面的 accent(按鈕、連結、active、頂端色條、輪播重點)切換成該分類的顏色(靈感同 figureshot-lab 的分區換色)。

- 色彩用語意 token(`--accent` / `--accent-soft` / `--accent-fg` 等),集中在 `main.css`,元件只吃 token 不寫死顏色。
- `features/theme/useCategoryTheme.ts` 的 `applyAccent(color)` 在路由進入分類時覆寫 `:root` 的 accent 變數;離開分類 → reset 回預設藍。
- 每個分類的 `color` 存在 `type_definitions.color`;`分類配色` 設定(頂端調色盤鈕)可為每個分類指定 preset 色。
- 底層 dark token 仍保留在 `main.css`(未啟用),之後要恢復深色模式可再接。

### 世界主題 preset(每大類別一套 bg+字+accent)

`features/theme/themePresets.ts` 定義每個大類別一整組語意 token(底色/文字/accent 綁在一起,文字色預配好保證可讀)。進入該大類別的分類或大類別頁 → `applyTheme(domain)` 整組套用,像進入另一個世界;離開 → reset 回預設淺色。

- 已定義世界:**學習=深色科技感、美食=暖色餐廳、日本旅遊=和風紙白、國內旅遊=海島青**。
- 未定義 vibe 的大類別(求職/攝影/社群)→ 退回「淺色 + 該分類自選 accent 色」。要新增世界,在 `PRESETS` 加一個 `domain → ThemePreset` 即可(modular)。
- 有 preset 的大類別,世界主題會蓋過該分類的自選色(沉浸感優先);沒 preset 的才吃 `分類配色`。

## 輪播(首頁)

- `embla-carousel-vue` + `embla-carousel-auto-scroll`;上排 forward、下排 backward,一顆鈕控制兩排 play/pause。
- `prefers-reduced-motion` → 不自動播,退化為靜態可拖曳卡列。

## CSS 策略

- 唯一樣式系統:**Tailwind CSS v4**(`@tailwindcss/vite`),不混用其他 UI library。
- 入口:`src/assets/styles/main.css` — `@import "tailwindcss";` + `@theme { ... }`。

## Design token

集中在 `main.css` 的 `@theme`:

- accent:`--color-accent-500/600/700`(藍)。技術領域徽章用 accent,生活領域用 emerald,未分類用 slate。
- 中性色直接用 Tailwind `slate-*`。
- 字體:system-ui + Noto Sans TC / PingFang TC(中文優先)。

## 全域樣式 vs 元件樣式

- 全域(`main.css`):token、body 基底、`prefers-reduced-motion`。
- 元件樣式:直接寫 Tailwind utility class 在各 `.vue`。
- 重複的 UI pattern → 抽成 `components/common/` 元件(如 `BaseButton`),不重貼長 className。

## 常用元件封裝

`components/common/`:`BaseButton`(variant: primary/secondary/ghost/danger)、`BaseInput`、`BaseModal`(手機 bottom sheet、桌機置中)、`LoadingState`(loading / error / empty / slot)。

## 互動狀態(Lite 也要保留)

- hover / focus-visible ring / disabled 皆已在 base 元件處理。
- 非同步操作要有 loading(`LoadingState`、按鈕「儲存中…」)。
- 空狀態、錯誤狀態要有明確文案。

## 禁止

- 不混用多套 UI library。
- 不把樣式全塞單一 `main.css`。
- 不在多處分散覆寫 theme。
- 不為簡單功能引入過重 UI library。
