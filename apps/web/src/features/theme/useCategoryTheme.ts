/**
 * Per-大類別 theming. Entering a category (or its domain view / an entry under
 * it) applies that 大類別's assigned world theme (bg + text + accent). The
 * assignment is editable per domain and persisted; domains without a preset
 * fall back to light + the category's own accent colour.
 */
import { useLocalStorage } from '@vueuse/core'
import { DEFAULT_DOMAIN_PRESET, presetByKey, type ThemePreset } from './themePresets'

// Per-大類別 preset overrides (domain → preset key).
const overrides = useLocalStorage<Record<string, string>>('ki-domain-theme', {})

export function domainThemeKey(domain: string): string {
  return overrides.value[domain] ?? DEFAULT_DOMAIN_PRESET[domain] ?? 'default'
}
export function setDomainTheme(domain: string, key: string) {
  overrides.value = { ...overrides.value, [domain]: key }
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const VARS = [
  '--canvas', '--surface', '--elevated', '--line', '--ink', '--muted',
  '--accent', '--accent-fg', '--accent-soft',
] as const

function reset() {
  const s = document.documentElement.style
  for (const v of VARS) s.removeProperty(v)
}

function applyPreset(p: ThemePreset) {
  const s = document.documentElement.style
  s.setProperty('--canvas', p.canvas)
  s.setProperty('--surface', p.surface)
  s.setProperty('--elevated', p.elevated)
  s.setProperty('--line', p.line)
  s.setProperty('--ink', p.ink)
  s.setProperty('--muted', p.muted)
  s.setProperty('--accent', p.accent)
  s.setProperty('--accent-fg', p.accentFg)
  s.setProperty('--accent-soft', p.accentSoft)
}

/** 登入頁選定的背景風格 → App 基底世界主題(頂欄/側欄/主內容跟隨)。 */
function appBasePreset(): ThemePreset | null {
  const raw = (localStorage.getItem('ki-login-bg') ?? 'galaxy').replace(/"/g, '')
  const key = raw === 'threads' ? 'ink-threads' : 'space-navy' // galaxy 與 image 都走星空深藍
  return presetByKey(key).preset
}

/**
 * Apply the world theme for a 大類別. The domain's preset sets the "world"
 * (bg + text + accent); a 子分類 colour, when set, always overrides the accent
 * on top of that world — so the per-category colour picker stays meaningful
 * even for domains that have a world preset.
 * 無 domain(總覽/全部/待確認)或該 domain 未指派世界主題時,
 * 改用「登入風格基底主題」讓整站與登入頁一致。
 */
export function applyTheme(domain: string | null | undefined, categoryColor?: string | null) {
  reset()
  const base = appBasePreset()
  if (!domain) {
    if (base) applyPreset(base)
    if (categoryColor) applyAccent(categoryColor)
    return
  }
  const preset = presetByKey(domainThemeKey(domain)).preset
  if (preset) applyPreset(preset)
  else if (base) applyPreset(base)
  if (categoryColor) applyAccent(categoryColor)
}

/** Accent-only override (light theme; used by the per-category colour picker). */
export function applyAccent(color: string | null | undefined) {
  const s = document.documentElement.style
  if (!color) {
    s.removeProperty('--accent')
    s.removeProperty('--accent-soft')
    s.removeProperty('--accent-fg')
    return
  }
  s.setProperty('--accent', color)
  s.setProperty('--accent-soft', hexToRgba(color, 0.14))
  s.setProperty('--accent-fg', '#ffffff')
}

/** A pleasant preset palette for the per-category colour picker (策展色盤). */
export const PRESET_COLORS = [
  '#02a8e0', '#0d9488', '#ea580c', '#7c3aed', '#e11d48', '#db2777',
  '#16a34a', '#ca8a04', '#0891b2', '#4f46e5', '#dc2626', '#475569',
]
