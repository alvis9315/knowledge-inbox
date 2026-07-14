import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getRuntimeConfig } from './runtimeConfig'

// 連線值優先序:託管環境(OpenAI Sites)的 runtime 注入 > 本機 VITE_* 變數。
const runtimeConfig = getRuntimeConfig()
const url = runtimeConfig.supabaseUrl || import.meta.env.VITE_SUPABASE_URL
const anonKey = runtimeConfig.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY
const databaseEnvironment = runtimeConfig.supabaseUrl
  ? 'production'
  : import.meta.env.VITE_SUPABASE_ENV

// 本機開發防呆:沒有明確標示 development 的 Supabase 連線一律拒啟,
// 避免本機測試寫入誤打正式資料庫(設定方式見 docs/deployment-guide.md)。
if (import.meta.env.DEV && url && databaseEnvironment !== 'development') {
  throw new Error(
    'Local development is blocked from using an unlabelled Supabase project. ' +
      'Create apps/web/.env.development.local and set VITE_SUPABASE_ENV=development.',
  )
}

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
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/web/.env.development.local',
    )
  }
  return supabase
}
