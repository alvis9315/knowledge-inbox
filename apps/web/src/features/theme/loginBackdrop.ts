/**
 * 登入頁背景設定的共用正本:LoginView(登入頁)與 AppShell(登入後把
 * 同一顆背景鋪滿整站)共用,避免兩份參數漂移。
 */
export type LoginBg = 'galaxy' | 'threads' | 'image'
export type GalaxyBg = 'black' | 'blue' | 'nebula'

export const LOGIN_BG_KEY = 'ki-login-bg'
export const GALAXY_BG_KEY = 'ki-login-galaxy-bg-v4'

// 夜幕藍星雲:深夜藍底 + 有機星雲色暈 + feTurbulence 細顆粒噪點層。
const nebulaBg =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E") 0 0 / 140px 140px repeat,` +
  `radial-gradient(ellipse 42% 36% at 28% 32%, rgba(84,118,220,0.16) 0%, transparent 60%),` +
  `radial-gradient(ellipse 48% 42% at 72% 64%, rgba(122,82,192,0.15) 0%, transparent 62%),` +
  `radial-gradient(ellipse 40% 30% at 60% 20%, rgba(56,150,180,0.10) 0%, transparent 60%),` +
  `radial-gradient(ellipse 55% 46% at 40% 78%, rgba(48,96,170,0.10) 0%, transparent 64%),` +
  `radial-gradient(ellipse 122% 112% at 50% 50%, #0c1b40 0%, #0a1533 40%, #070f26 72%, #04091a 100%)`

export const GALAXY_BG_CSS: Record<GalaxyBg, string> = {
  black: 'radial-gradient(circle at 50% 50%, #0a0a14 0%, #000 82%)',
  blue: 'radial-gradient(circle at 50% 50%, #0e1b40 0%, #091229 36%, #05091c 64%, #02040c 100%)',
  nebula: nebulaBg,
}

/** 每個底色掛自己的星星參數(使用者調校定案 2026-07-13)。 */
export const GALAXY_BG_STARS: Record<GalaxyBg, { density: number; starTint: string; glow: number }> = {
  black: { density: 0.9, starTint: '#ffffff', glow: 0.35 },
  blue: { density: 2.1, starTint: '#37598b', glow: 0.65 },
  nebula: { density: 0.5, starTint: '#3282ec', glow: 0.35 },
}

const strip = (v: string | null) => (v ?? '').replace(/"/g, '')

export const currentLoginBg = (): LoginBg => {
  const v = strip(localStorage.getItem(LOGIN_BG_KEY))
  return v === 'threads' || v === 'image' ? v : 'galaxy'
}
export const currentGalaxyBg = (): GalaxyBg => {
  const v = strip(localStorage.getItem(GALAXY_BG_KEY))
  return v === 'blue' || v === 'nebula' ? v : 'black'
}
