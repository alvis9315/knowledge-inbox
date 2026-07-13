import { useLocalStorage } from '@vueuse/core'

/** 頂欄/側欄透明度(%),活背景模式下生效;面板控制器即時調整。 */
export const topbarOpacity = useLocalStorage('ki-chrome-top', 55)
export const sidebarOpacity = useLocalStorage('ki-chrome-side', 55)
/** 分類卡片(大類別/子類別卡)透明度(%)。 */
export const cardOpacity = useLocalStorage('ki-card-alpha', 88)
/** 項目卡片透明度(%)。 */
export const entryOpacity = useLocalStorage('ki-entry-alpha', 88)
/** 卡片毛玻璃(輕量 6px;輪播卡多時若掉幀可關)。 */
export const cardGlass = useLocalStorage('ki-card-glass', true)

export const chromeBg = (pct: number) =>
  `color-mix(in srgb, var(--surface) ${pct}%, transparent)`
