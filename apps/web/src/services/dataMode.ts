import { ref } from 'vue'
import { isSupabaseConfigured } from './supabaseClient'

/**
 * Which data source the app reads/writes.
 * - Guest login  → mock (localStorage fake data, never touches Supabase).
 * - Owner login  → Supabase (real DB), only if it's configured.
 * Defaults to mock until auth decides, so nothing hits Supabase prematurely.
 */
const _mock = ref(true)

export function setDataMode(mode: 'guest' | 'supabase') {
  _mock.value = mode === 'guest' || !isSupabaseConfigured
}

export function isMock(): boolean {
  return _mock.value
}

export { isSupabaseConfigured }
