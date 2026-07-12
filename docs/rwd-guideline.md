# RWD Guideline

## 策略

**Mobile-first**。基礎樣式為手機版,用 Tailwind `min-width` variants(`md:` / `lg:`)往大螢幕擴充。

## Breakpoint 來源

**Tailwind CSS 預設**(不另創一套):

| token | 寬度 |
|---|---|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

## Viewport

`index.html` 已含 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`。不阻止縮放。

## Layout 變形規則

| 區塊 | 手機 | 桌機 |
|---|---|---|
| 卡牆 | 單欄 `grid-cols-1` | `md:grid-cols-2 lg:grid-cols-3` |
| Header | 精簡單列 | 同左(內容少,不需 hamburger) |
| 篩選列 | 搜尋滿版 + 下拉自動換行(`flex-wrap`) | 同排並列 |
| Modal | 底部 sheet(`items-end`、`rounded-t-2xl`) | 置中卡片(`sm:items-center sm:rounded-2xl`) |
| entry 屬性 | 單欄 `grid-cols-1` | `sm:grid-cols-2` |

## Typography

字級用 Tailwind rem-based utility;不用固定 px 主文、不用純 vw。

## 測試尺寸

375 / 390 / 430(手機)、768(平板)、1024 / 1280 / 1440(桌機)。

## 完成前檢查

- [ ] 無非預期橫向捲軸
- [ ] 卡片 / 表單 / Modal 不爆版
- [ ] 按鈕在手機易點擊
- [ ] Modal 手機為 bottom sheet、桌機置中
- [ ] 瀏覽器 zoom 200% 仍可操作

## 禁止

- 只做桌機版
- 把 RWD 全塞 `App.vue`
- 每個元件自訂不同 breakpoint(統一用 Tailwind)
- 用固定 width 導致爆版
- 用 CSS scale 縮小當 RWD
