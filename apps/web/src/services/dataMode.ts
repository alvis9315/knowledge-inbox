import { ref } from 'vue'
import { isSupabaseConfigured } from './supabaseClient'

/**
 * Which data source the app reads/writes.
 * - Guest login  → mock (localStorage fake data, never touches Supabase).
 * - Owner login  → Supabase (real DB), only if it's configured.
 * Defaults to mock until auth decides, so nothing hits Supabase prematurely.
 */
// 預設值從持久化登入模式「同步」推導——不憑空預設 mock,
// 否則任何時序/HMR 重評估都會把已登入者打回假資料(慘痛教訓)。
const _mock = ref(localStorage.getItem('ki-auth-mode') !== 'supabase')

export const setDataMode = (mode: 'guest' | 'supabase') => {
  _mock.value = mode === 'guest' || !isSupabaseConfigured
}

export const isMock = (): boolean => {
  return _mock.value
}

export { isSupabaseConfigured }
