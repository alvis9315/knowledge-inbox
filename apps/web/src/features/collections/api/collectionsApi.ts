import { requireSupabase } from '@/services/supabaseClient'
import { isMock } from '@/services/dataMode'
import { mockDb } from '@/services/mock/mockDb'
import type { EntryWithTags } from '@/features/entries/types'

/**
 * Collections(主題集合/行程):把多筆 entry 組成一個場景(sa-lite 第 4 條)。
 * 積木原則第 3 條:集合只引用 entry id(+ sort_order/note),不複製內容。
 * 雙資料源:mock 與 supabase 行為一致;錯誤一律 throw 讓呼叫端翻中文。
 */
export interface CollectionMeta {
  id: string
  name: string
  description: string | null
  count: number
}

export interface CollectionItem {
  entry: EntryWithTags
  note: string | null
  sort_order: number
}

export interface CollectionDetail extends CollectionMeta {
  items: CollectionItem[]
}

export const fetchCollections = async (): Promise<CollectionMeta[]> => {
  if (isMock()) return mockDb.collections()
  const supabase = requireSupabase()
  const [cols, links] = await Promise.all([
    supabase.from('collections').select('id, name, description').order('created_at', { ascending: true }),
    supabase.from('collection_entries').select('collection_id'),
  ])
  if (cols.error) throw new Error(cols.error.message)
  if (links.error) throw new Error(links.error.message)
  const countById = new Map<string, number>()
  for (const l of links.data ?? []) {
    countById.set(l.collection_id as string, (countById.get(l.collection_id as string) ?? 0) + 1)
  }
  return (cols.data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    description: (c.description as string | null) ?? null,
    count: countById.get(c.id as string) ?? 0,
  }))
}

export const createCollection = async (name: string, description?: string): Promise<string> => {
  if (isMock()) return mockDb.createCollection(name, description ?? null)
  const { data, error } = await requireSupabase()
    .from('collections')
    .insert({ name, description: description ?? null })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export const renameCollection = async (id: string, name: string): Promise<void> => {
  if (isMock()) return mockDb.renameCollection(id, name)
  const { error } = await requireSupabase().from('collections').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteCollection = async (id: string): Promise<void> => {
  if (isMock()) return mockDb.deleteCollection(id)
  // collection_entries 由 FK on delete cascade 一併清除。
  const { error } = await requireSupabase().from('collections').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const fetchCollectionDetail = async (id: string): Promise<CollectionDetail | null> => {
  if (isMock()) return mockDb.collectionDetail(id)
  const supabase = requireSupabase()
  const [col, links] = await Promise.all([
    supabase.from('collections').select('id, name, description').eq('id', id).maybeSingle(),
    supabase
      .from('collection_entries')
      .select('entry_id, sort_order, note, entries(*, entry_tags(tags(name)))')
      .eq('collection_id', id)
      .order('sort_order', { ascending: true }),
  ])
  if (col.error) throw new Error(col.error.message)
  if (!col.data) return null
  if (links.error) throw new Error(links.error.message)

  const items: CollectionItem[] = (links.data ?? []).map((row) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const raw = row.entries as any
    const tags: string[] = (raw?.entry_tags ?? [])
      .flatMap((j: any) => (Array.isArray(j.tags) ? j.tags : j.tags ? [j.tags] : []))
      .map((t: any) => t.name)
    const { entry_tags: _drop, ...entry } = raw ?? {}
    return {
      entry: { ...(entry as EntryWithTags), tags },
      note: (row.note as string | null) ?? null,
      sort_order: row.sort_order as number,
    }
  })
  return {
    id: col.data.id as string,
    name: col.data.name as string,
    description: (col.data.description as string | null) ?? null,
    count: items.length,
    items,
  }
}

export const addToCollection = async (collectionId: string, entryId: string): Promise<void> => {
  if (isMock()) return mockDb.addToCollection(collectionId, entryId)
  const supabase = requireSupabase()
  // 排在最後;重複加入由複合主鍵擋下(翻成人話在呼叫端)。
  const { data } = await supabase
    .from('collection_entries')
    .select('sort_order')
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const next = ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10
  const { error } = await supabase
    .from('collection_entries')
    .insert({ collection_id: collectionId, entry_id: entryId, sort_order: next })
  if (error) throw new Error(error.message)
}

export const removeFromCollection = async (collectionId: string, entryId: string): Promise<void> => {
  if (isMock()) return mockDb.removeFromCollection(collectionId, entryId)
  const { error } = await requireSupabase()
    .from('collection_entries')
    .delete()
    .eq('collection_id', collectionId)
    .eq('entry_id', entryId)
  if (error) throw new Error(error.message)
}

export const setCollectionNote = async (
  collectionId: string,
  entryId: string,
  note: string | null,
): Promise<void> => {
  if (isMock()) return mockDb.setCollectionNote(collectionId, entryId, note)
  const { error } = await requireSupabase()
    .from('collection_entries')
    .update({ note })
    .eq('collection_id', collectionId)
    .eq('entry_id', entryId)
  if (error) throw new Error(error.message)
}

export const reorderCollectionEntries = async (
  collectionId: string,
  orderedEntryIds: string[],
): Promise<void> => {
  if (isMock()) return mockDb.reorderCollectionEntries(collectionId, orderedEntryIds)
  const supabase = requireSupabase()
  await Promise.all(
    orderedEntryIds.map((entryId, i) =>
      supabase
        .from('collection_entries')
        .update({ sort_order: (i + 1) * 10 })
        .eq('collection_id', collectionId)
        .eq('entry_id', entryId),
    ),
  )
}
