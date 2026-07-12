/** Emoji for each 大類別 (domain), with a fallback. User-created domains get 📁. */
const DOMAIN_ICONS: Record<string, string> = {
  國內旅遊: '🗺️',
  日本旅遊: '🗾',
  美食: '🍽️',
  學習: '💻',
  求職: '💼',
  攝影: '📷',
  社群: '📱',
}

export function domainIcon(domain: string): string {
  return DOMAIN_ICONS[domain] ?? '📁'
}
