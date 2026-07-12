import type { Tag } from '@inbox/shared-types'
import { requireSupabase } from '@/services/supabaseClient'
import { isMock } from '@/services/dataMode'
import { mockDb } from '@/services/mock/mockDb'

export async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await requireSupabase()
    .from('tags')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Tag[]
}

/** Just the (non-hidden) tag names — used by the tag filter dropdown. */
export async function fetchAllTagNames(): Promise<string[]> {
  if (isMock()) return mockDb.allTags()
  const { data, error } = await requireSupabase()
    .from('tags')
    .select('name')
    .eq('hidden', false)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((t) => t.name as string)
}

export interface TagDetail {
  name: string
  hidden: boolean
  count: number
}

/** All tags with usage counts + hidden flag (for the tag manager). */
export async function fetchTagsDetailed(): Promise<TagDetail[]> {
  if (isMock()) return mockDb.listTags()
  const { data, error } = await requireSupabase()
    .from('tags')
    .select('name, hidden, entry_tags(count)')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((t: Record<string, unknown>) => ({
    name: t.name as string,
    hidden: (t.hidden as boolean) ?? false,
    count: (t.entry_tags as { count: number }[] | undefined)?.[0]?.count ?? 0,
  }))
}

export async function addTag(name: string): Promise<void> {
  if (isMock()) return mockDb.addTag(name)
  const { error } = await requireSupabase()
    .from('tags')
    .upsert({ name: name.trim() }, { onConflict: 'name', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export async function renameTag(oldName: string, next: string): Promise<void> {
  if (isMock()) return mockDb.renameTag(oldName, next)
  // entry_tags reference tags by id, so renaming the tag row propagates everywhere.
  const { error } = await requireSupabase()
    .from('tags')
    .update({ name: next.trim() })
    .eq('name', oldName)
  if (error) throw new Error(error.message)
}

export async function setTagHidden(name: string, hidden: boolean): Promise<void> {
  if (isMock()) return mockDb.setTagHidden(name, hidden)
  const { error } = await requireSupabase().from('tags').update({ hidden }).eq('name', name)
  if (error) throw new Error(error.message)
}

/** Ensure a set of tag names exist; return their ids. */
export async function ensureTags(names: string[]): Promise<string[]> {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (clean.length === 0) return []

  const supabase = requireSupabase()
  const { error: upsertError } = await supabase
    .from('tags')
    .upsert(clean.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
  if (upsertError) throw new Error(upsertError.message)

  const { data, error } = await supabase.from('tags').select('id, name').in('name', clean)
  if (error) throw new Error(error.message)
  return (data ?? []).map((t) => t.id as string)
}
