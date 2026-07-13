import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when both env vars are present. UI degrades gracefully when false. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Single supabase-js client. The frontend talks to Postgres directly through
 * PostgREST; RLS is what keeps data safe (see docs/security-guideline.md).
 * The ANTHROPIC key never lives here — it stays server-side in the Edge Function.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null

/** Narrow helper: throws a clear error instead of a null-deref when unconfigured. */
export const requireSupabase = (): SupabaseClient => {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/web/.env',
    )
  }
  return supabase
}
