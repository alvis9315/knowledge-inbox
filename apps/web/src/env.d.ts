/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_ENV?: 'development' | 'production'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Public runtime configuration injected by the hosting adapter. */
  readonly __KI_CONFIG__?: {
    readonly supabaseUrl?: string
    readonly supabaseAnonKey?: string
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
