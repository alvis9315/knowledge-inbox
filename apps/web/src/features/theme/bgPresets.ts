import { ref } from 'vue'
import { requireSupabase } from '@/services/supabaseClient'
import { isMock } from '@/services/dataMode'
import type { LiveBgKind } from './themePresets'

/**
 * 活背景「方案存檔」:每種背景最多 10 套參數方案(控制面板上緣頁籤切換,
 * 完成=存進當前方案)。本機正本在 localStorage(訪客/離線可用);
 * 登入模式再同步一份到 Supabase bg_presets 表(跨裝置,fail-soft:
 * 表還沒建或網路失敗只影響雲端備份,不影響功能)。
 */
export const MAX_SLOTS = 10

type Cfg = Record<string, unknown>
interface KindPresets {
  active: number
  slots: (Cfg | null)[]
}
type PresetMap = Partial<Record<LiveBgKind, KindPresets>>

const KEY = 'ki-bg-presets-v1'

/** 方案選擇/雲端合併的變更計數:AppShell 靠它重掛背景元件套用新方案。 */
export const presetsRevision = ref(0)

const load = (): PresetMap => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as PresetMap
  } catch {
    return {}
  }
}
const persist = (m: PresetMap) => localStorage.setItem(KEY, JSON.stringify(m))

const ensure = (m: PresetMap, kind: LiveBgKind): KindPresets => {
  let k = m[kind]
  if (!k) {
    // 遷移舊版單一存檔(ki-app-<kind>-cfg)成為方案 1,不丟使用者調過的參數。
    let legacy: Cfg | null = null
    try {
      legacy = JSON.parse(localStorage.getItem(`ki-app-${kind}-cfg`) ?? 'null') as Cfg | null
    } catch {
      /* noop */
    }
    k = { active: 0, slots: [legacy ?? {}] }
    m[kind] = k
  }
  if (k.active < 0 || k.active >= k.slots.length) k.active = 0
  return k
}

/** 當前方案的參數(AppShell 組 props 用)。 */
export const activeCfg = (kind: LiveBgKind): Cfg => {
  const m = load()
  const k = ensure(m, kind)
  persist(m)
  return k.slots[k.active] ?? {}
}

/** 頁籤 UI 用:方案數與當前索引。 */
export const slotState = (kind: LiveBgKind): { active: number; count: number } => {
  const m = load()
  const k = ensure(m, kind)
  return { active: k.active, count: k.slots.length }
}

export const selectSlot = (kind: LiveBgKind, i: number) => {
  const m = load()
  const k = ensure(m, kind)
  if (i < 0 || i >= k.slots.length || i === k.active) return
  k.active = i
  persist(m)
  presetsRevision.value++
}

/** 新增方案(複製當前方案當起點,選中它)。 */
export const addSlot = (kind: LiveBgKind) => {
  const m = load()
  const k = ensure(m, kind)
  if (k.slots.length >= MAX_SLOTS) return
  k.slots.push(JSON.parse(JSON.stringify(k.slots[k.active] ?? {})) as Cfg)
  k.active = k.slots.length - 1
  persist(m)
  presetsRevision.value++
}

/** 完成=把調好的參數存進當前方案(localStorage 立即,雲端 fail-soft)。 */
export const saveActiveCfg = (kind: LiveBgKind, cfg: Cfg) => {
  const m = load()
  const k = ensure(m, kind)
  k.slots[k.active] = cfg
  persist(m)
  void syncToCloud(kind, k)
}

const syncToCloud = async (kind: LiveBgKind, k: KindPresets) => {
  if (isMock()) return
  try {
    const sb = requireSupabase()
    const { data } = await sb.auth.getUser()
    const uid = data.user?.id
    if (!uid) return
    const { error } = await sb
      .from('bg_presets')
      .upsert(
        { user_id: uid, kind, payload: k, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,kind' },
      )
    if (error) throw new Error(error.message)
  } catch (e) {
    // 裝飾性資料:雲端備份失敗不打擾使用者(表未建/離線都可能),本機已存好。
    console.warn('[bg-presets] 雲端同步失敗(本機已儲存):', e)
  }
}

/** App 啟動(登入模式)從雲端取回方案,以雲端為準合併。 */
export const hydrateBgPresets = async () => {
  if (isMock()) return
  try {
    const sb = requireSupabase()
    const { data, error } = await sb.from('bg_presets').select('kind, payload')
    if (error) throw new Error(error.message)
    if (!data?.length) return
    const m = load()
    for (const row of data) {
      m[row.kind as LiveBgKind] = row.payload as KindPresets
    }
    persist(m)
    presetsRevision.value++
  } catch (e) {
    console.warn('[bg-presets] 雲端方案載入失敗,使用本機方案:', e)
  }
}
