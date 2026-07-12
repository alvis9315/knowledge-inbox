import { supabase } from './supabaseClient'
import { isMock } from './dataMode'

/**
 * Ensure an auth session exists so RLS (`auth.uid() = user_id`) lets the user
 * read/write their own rows. We use anonymous sign-in to avoid building a login
 * form for the single-user MVP.
 *
 * ⚠️ Anonymous users are tied to this browser. For durable personal data, add
 * real email auth (Phase 1.5) — see docs/security-guideline.md. Enable
 * "Anonymous sign-ins" in Supabase → Authentication → Providers first.
 */
export async function ensureSession(): Promise<void> {
  if (isMock() || !supabase) return
  const { data } = await supabase.auth.getSession()
  if (data.session) return

  const { error } = await supabase.auth.signInAnonymously()
  if (error) {
    throw new Error(
      `無法建立 Supabase session:${error.message}。請到 Supabase → Authentication → Providers 開啟 "Anonymous sign-ins",或改用 email 登入。`,
    )
  }
}
