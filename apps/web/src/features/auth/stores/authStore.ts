import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/services/supabaseClient'
import { setDataMode } from '@/services/dataMode'

export type AuthMode = 'guest' | 'supabase'
const STORE_KEY = 'ki-auth-mode'

export const useAuthStore = defineStore('auth', () => {
  const mode = ref<AuthMode | null>(null)
  const email = ref<string | null>(null)
  const ready = ref(false)

  const isAuthed = computed(() => mode.value !== null)
  const label = computed(() =>
    mode.value === 'guest' ? '訪客 (Demo)' : (email.value ?? '已登入'),
  )
  const supabaseReady = computed(() => isSupabaseConfigured)

  /** Restore a session on app start (called by the router guard). */
  async function init() {
    if (ready.value) return
    const saved = localStorage.getItem(STORE_KEY) as AuthMode | null
    if (saved === 'guest') {
      mode.value = 'guest'
      setDataMode('guest')
    } else if (saved === 'supabase' && supabase) {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        mode.value = 'supabase'
        email.value = data.session.user.email ?? null
        setDataMode('supabase')
      } else {
        localStorage.removeItem(STORE_KEY)
      }
    }
    ready.value = true
  }

  function loginGuest() {
    mode.value = 'guest'
    email.value = null
    setDataMode('guest')
    localStorage.setItem(STORE_KEY, 'guest')
  }

  async function loginWithPassword(mail: string, password: string) {
    if (!supabase) throw new Error('尚未設定 Supabase,請先設定或改用訪客登入。')
    const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password })
    if (error) throw new Error(error.message)
    mode.value = 'supabase'
    email.value = data.user?.email ?? mail
    setDataMode('supabase')
    localStorage.setItem(STORE_KEY, 'supabase')
  }

  async function loginWithGoogle() {
    if (!supabase) throw new Error('尚未設定 Supabase,請先設定或改用訪客登入。')
    // Remember intent so init() picks up the session after the OAuth redirect.
    localStorage.setItem(STORE_KEY, 'supabase')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw new Error(error.message)
    // Browser redirects to Google; on return, init() restores the session.
  }

  async function logout() {
    if (mode.value === 'supabase' && supabase) await supabase.auth.signOut()
    mode.value = null
    email.value = null
    localStorage.removeItem(STORE_KEY)
  }

  return { mode, email, ready, isAuthed, label, supabaseReady, init, loginGuest, loginWithPassword, loginWithGoogle, logout }
})
