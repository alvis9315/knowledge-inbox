import { ref } from 'vue'

/**
 * 大類別 icon:資料庫 domain_meta(雲端)/ mock 為正本,這裡的預設表只是
 * 種子分類的 fallback。categoriesStore 載入時會灌入 overrides;
 * domainIcon() 在 render 期讀取 ref,元件會自動反應更新。
 */
const DEFAULT_ICONS: Record<string, string> = {
  國內旅遊: '🗺️',
  日本旅遊: '🗾',
  美食: '🍽️',
  學習: '💻',
  求職: '💼',
  攝影: '📷',
  社群: '📱',
}

const overrides = ref<Record<string, string>>({})

export function setDomainIconOverrides(map: Record<string, string>) {
  overrides.value = map
}

export function domainIcon(domain: string): string {
  return overrides.value[domain] ?? DEFAULT_ICONS[domain] ?? '📁'
}
