export interface KnowledgeInboxRuntimeConfig {
  supabaseUrl?: string
  supabaseAnonKey?: string
}

/**
 * Hosted deployments may inject public Supabase connection values before the
 * Vite entry module runs. Local development keeps using VITE_* variables.
 */
export const getRuntimeConfig = (): KnowledgeInboxRuntimeConfig => {
  if (typeof window === 'undefined') return {}
  return window.__KI_CONFIG__ ?? {}
}
