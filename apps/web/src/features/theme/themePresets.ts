/**
 * Named "world" theme presets. Each 大類別 is assigned one (editable in the
 * 大分類主題 panel); entering a category under that 大類別 applies the whole
 * token set, so it reads like another world. Text colours are pre-tuned for
 * readability. Add a preset here to offer a new world.
 */
/** 活背景型別(之後逐步擴充 react-bits Backgrounds)。 */
export type LiveBgKind = 'galaxy' | 'threads' | 'image' | 'aurora' | 'waves' | 'darkveil' | 'silk'

export interface ThemePreset {
  canvas: string
  surface: string
  elevated: string
  line: string
  ink: string
  muted: string
  accent: string
  accentFg: string
  accentSoft: string
}

export interface NamedPreset {
  key: string
  label: string
  preset: ThemePreset | null // null = default light
  /** 指定後,套用此主題的頁面會鋪對應的活背景(WebGL/圖片)。 */
  liveBg?: LiveBgKind
}

export const THEME_PRESETS: NamedPreset[] = [
  { key: 'default', label: '預設淺藍', preset: null },
  {
    key: 'tech-dark',
    label: '深色科技(青)',
    preset: {
      canvas: '#0a0f1e', surface: '#121a30', elevated: '#182142', line: '#26325a',
      ink: '#e8f0ff', muted: '#8aa0c8', accent: '#22d3ee', accentFg: '#04121a',
      accentSoft: 'rgba(34, 211, 238, 0.16)',
    },
  },
  {
    key: 'warm-restaurant',
    label: '暖色餐廳',
    preset: {
      canvas: '#fbf3e9', surface: '#fffaf3', elevated: '#fffdf9', line: '#ecdcc7',
      ink: '#4a3526', muted: '#9c8266', accent: '#e0622f', accentFg: '#ffffff',
      accentSoft: 'rgba(224, 98, 47, 0.14)',
    },
  },
  {
    key: 'washi-white',
    label: '和風紙白',
    preset: {
      canvas: '#fafafa', surface: '#ffffff', elevated: '#ffffff', line: '#ededed',
      ink: '#2b2b2b', muted: '#8a8a8a', accent: '#d64545', accentFg: '#ffffff',
      accentSoft: 'rgba(214, 69, 69, 0.10)',
    },
  },
  {
    key: 'island-teal',
    label: '海島青',
    preset: {
      canvas: '#f0faf8', surface: '#ffffff', elevated: '#ffffff', line: '#d6ece7',
      ink: '#14342e', muted: '#5e8b82', accent: '#0d9488', accentFg: '#ffffff',
      accentSoft: 'rgba(13, 148, 136, 0.12)',
    },
  },
  {
    key: 'charcoal-yellow',
    label: '深灰黃字',
    preset: {
      canvas: '#1e1e20', surface: '#2a2a2e', elevated: '#313136', line: '#45454c',
      ink: '#f5d76e', muted: '#b8a35a', accent: '#f4c430', accentFg: '#1e1e20',
      accentSoft: 'rgba(244, 196, 48, 0.16)',
    },
  },
  {
    key: 'violet-night',
    label: '深紫夜',
    preset: {
      canvas: '#14102a', surface: '#1e1840', elevated: '#251d4e', line: '#362c66',
      ink: '#e6e0ff', muted: '#a99fd0', accent: '#a78bfa', accentFg: '#14102a',
      accentSoft: 'rgba(167, 139, 250, 0.16)',
    },
  },
  {
    key: 'rose-dusk',
    label: '暮色玫瑰',
    preset: {
      canvas: '#1f1220', surface: '#2c1a2e', elevated: '#35203a', line: '#4a2f4e',
      ink: '#ffe0ee', muted: '#cfa0b8', accent: '#fb7185', accentFg: '#1f1220',
      accentSoft: 'rgba(251, 113, 133, 0.16)',
    },
  },
  {
    key: 'space-navy',
    label: '星空(活背景)',
    liveBg: 'galaxy',
    preset: {
      canvas: '#0a1226', surface: '#111b36', elevated: '#172547', line: '#263457',
      ink: '#e8eeff', muted: '#93a3c8', accent: '#8fb7ff', accentFg: '#0a1226',
      accentSoft: 'rgba(143, 183, 255, 0.16)',
    },
  },
  {
    key: 'ink-threads',
    label: '線條(活背景)',
    liveBg: 'threads',
    preset: {
      canvas: '#05080f', surface: '#0b111d', elevated: '#111a2b', line: '#1e2a40',
      ink: '#dfe9ff', muted: '#8494b5', accent: '#9cc4ff', accentFg: '#05080f',
      accentSoft: 'rgba(156, 196, 255, 0.14)',
    },
  },
  {
    key: 'aurora-night',
    label: '極光(活背景)',
    liveBg: 'aurora',
    preset: {
      canvas: '#07131c', surface: '#0d1c28', elevated: '#122534', line: '#1e3547',
      ink: '#e4f4f4', muted: '#8fb0b8', accent: '#2dd4bf', accentFg: '#062028',
      accentSoft: 'rgba(45, 212, 191, 0.16)',
    },
  },
  {
    key: 'wave-lines',
    label: '波浪(活背景)',
    liveBg: 'waves',
    preset: {
      canvas: '#080e1a', surface: '#0e1728', elevated: '#141f36', line: '#22304d',
      ink: '#e3ecff', muted: '#8b9cc0', accent: '#6d9eff', accentFg: '#080e1a',
      accentSoft: 'rgba(109, 158, 255, 0.16)',
    },
  },
  {
    key: 'dark-veil',
    label: '暗湧(活背景)',
    liveBg: 'darkveil',
    preset: {
      canvas: '#0a0916', surface: '#131126', elevated: '#191634', line: '#282350',
      ink: '#e8e4ff', muted: '#9b93c4', accent: '#8b7cf6', accentFg: '#0a0916',
      accentSoft: 'rgba(139, 124, 246, 0.16)',
    },
  },
  {
    key: 'silk-mauve',
    label: '絲綢(活背景)',
    liveBg: 'silk',
    preset: {
      canvas: '#17141c', surface: '#201c27', elevated: '#282332', line: '#3a3446',
      ink: '#ece8f2', muted: '#a79eb4', accent: '#b3a2cc', accentFg: '#17141c',
      accentSoft: 'rgba(179, 162, 204, 0.16)',
    },
  },
  {
    key: 'photo-cover',
    label: '圖片封面(活背景)',
    liveBg: 'image',
    preset: {
      canvas: '#0b0f18', surface: '#131926', elevated: '#1a2233', line: '#283349',
      ink: '#eef2ff', muted: '#9aa8c7', accent: '#a8c7ff', accentFg: '#0b0f18',
      accentSoft: 'rgba(168, 199, 255, 0.16)',
    },
  },
]

export function presetByKey(key: string): NamedPreset {
  return THEME_PRESETS.find((p) => p.key === key) ?? THEME_PRESETS[0]
}

/** Default 大類別 → preset assignment (user can override in the panel). */
export const DEFAULT_DOMAIN_PRESET: Record<string, string> = {
  學習: 'tech-dark',
  美食: 'warm-restaurant',
  日本旅遊: 'washi-white',
  國內旅遊: 'island-teal',
  攝影: 'charcoal-yellow',
  // 求職 / 社群 default to the light theme until assigned.
}
