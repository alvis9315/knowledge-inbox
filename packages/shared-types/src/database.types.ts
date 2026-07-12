// ⚠️ PLACEHOLDER — hand-written to mirror supabase/migrations.
// Replace with the generated file once the Supabase project exists:
//   supabase gen types typescript --project-id <id> > src/database.types.ts
//
// Kept intentionally minimal: only the columns Phase 1 reads/writes are typed
// precisely; JSONB columns use `Json`.

// Non-recursive on purpose: a fully recursive Json type explodes Vue's deep
// `UnwrapRef` when a column of this type is held in a `ref()`. Leaves are
// `unknown`, which is plenty for JSONB attrs in Phase 1.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: unknown }
  | unknown[]

export type Domain = '生活' | '技術'
export type EntryStatus = 'filed' | 'pending_review'
export type DefaultView = 'card' | 'map' | 'code'
export type TypeStatus = 'active' | 'pending'

export interface TypeDefinitionRow {
  key: string
  name: string
  domain: string
  description: string
  attrs_schema: Json
  icon: string | null
  color: string | null
  default_view: DefaultView
  status: TypeStatus
  created_at: string
}

export interface EntryRow {
  id: string
  user_id: string | null
  type: string | null
  title: string
  summary: string | null
  content: string | null
  source_url: string | null
  attrs: Json
  confidence: number | null
  status: EntryStatus
  sort_order: number
  closed: boolean
  created_at: string
  updated_at: string
}

export interface TagRow {
  id: string
  name: string
}
