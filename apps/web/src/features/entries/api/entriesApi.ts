import { requireSupabase } from '@/services/supabaseClient'
import { isMock } from '@/services/dataMode'
import { mockDb } from '@/services/mock/mockDb'
import { ensureTags } from '@/features/tags/api/tagsApi'
import { SCOPE_ALL, SCOPE_PENDING } from '@/features/entries/constants'
import type {
  EntryFilters,
  EntryInput,
  EntryWithTags,
  PageQuery,
  PageResult,
} from '@/features/entries/types'

type EntryTagJoin = { tags: { name: string } | { name: string }[] | null }

/** Flatten the nested `entry_tags(tags(name))` join into a string[]. */
function mapEntry(row: Record<string, unknown>): EntryWithTags {
  const joins = (row.entry_tags as EntryTagJoin[] | undefined) ?? []
  const tags = joins
    .flatMap((j) => (Array.isArray(j.tags) ? j.tags : j.tags ? [j.tags] : []))
    .map((t) => t.name)
  const { entry_tags: _drop, ...entry } = row
  return { ...(entry as unknown as EntryWithTags), tags }
}

export async function fetchEntries(
  filters: EntryFilters,
  opts: { domainTypeKeys?: string[] } = {},
): Promise<EntryWithTags[]> {
  const supabase = requireSupabase()

  // Resolve tag filter to a set of entry ids (two-step keeps the main query simple).
  let entryIdsForTag: string[] | null = null
  if (filters.tag) {
    const { data, error } = await supabase
      .from('entry_tags')
      .select('entry_id, tags!inner(name)')
      .eq('tags.name', filters.tag)
    if (error) throw new Error(error.message)
    entryIdsForTag = (data ?? []).map((r) => r.entry_id as string)
    if (entryIdsForTag.length === 0) return []
  }

  let query = supabase
    .from('entries')
    .select('*, entry_tags(tags(name))')
    .order('created_at', { ascending: false })

  if (filters.type) {
    query = query.eq('type', filters.type)
  } else if (filters.domain) {
    const keys = opts.domainTypeKeys ?? []
    // No types in this domain → nothing can match.
    query = keys.length ? query.in('type', keys) : query.eq('id', '00000000-0000-0000-0000-000000000000')
  }

  const term = filters.search.trim()
  if (term) {
    const q = term.replace(/[%,()]/g, ' ')
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,content.ilike.%${q}%`)
  }

  if (entryIdsForTag) query = query.in('id', entryIdsForTag)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapEntry)
}

/** One page of a category's entries, with total count for pagination. */
export async function fetchEntriesPage(q: PageQuery): Promise<PageResult> {
  if (isMock()) return mockDb.entriesPage(q)
  const supabase = requireSupabase()
  const from = (q.page - 1) * q.pageSize
  const to = from + q.pageSize - 1

  let query = supabase
    .from('entries')
    .select('*, entry_tags(tags(name))', { count: 'exact' })

  // Special scopes: all entries, or the pending-review queue.
  if (q.type === SCOPE_PENDING) query = query.eq('status', 'pending_review')
  else if (q.type !== SCOPE_ALL) query = query.eq('type', q.type)

  if (!q.includeClosed) query = query.eq('closed', false)

  if (q.tag) {
    const { data: tagRows, error: tagErr } = await supabase
      .from('entry_tags')
      .select('entry_id, tags!inner(name)')
      .eq('tags.name', q.tag)
    if (tagErr) throw new Error(tagErr.message)
    const ids = (tagRows ?? []).map((r) => r.entry_id as string)
    if (ids.length === 0) return { rows: [], total: 0 }
    query = query.in('id', ids)
  }

  const term = q.search.trim()
  if (term) {
    const t = term.replace(/[%,()]/g, ' ')
    query = query.or(`title.ilike.%${t}%,summary.ilike.%${t}%,content.ilike.%${t}%`)
  }

  if (q.sort === 'newest') query = query.order('created_at', { ascending: false })
  else if (q.sort === 'title') query = query.order('title', { ascending: true })
  else query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: false })

  const { data, error, count } = await query.range(from, to)
  if (error) throw new Error(error.message)
  return { rows: (data ?? []).map(mapEntry), total: count ?? 0 }
}

/** Persist a manual entry order within a category (array of ids, top to bottom). */
export async function reorderEntries(orderedIds: string[]): Promise<void> {
  if (isMock()) return mockDb.reorderEntries(orderedIds)
  const supabase = requireSupabase()
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('entries').update({ sort_order: (i + 1) * 10 }).eq('id', id),
    ),
  )
}

export async function fetchEntry(id: string): Promise<EntryWithTags | null> {
  if (isMock()) return mockDb.getEntry(id)
  const { data, error } = await requireSupabase()
    .from('entries')
    .select('*, entry_tags(tags(name))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapEntry(data) : null
}

async function syncEntryTags(entryId: string, tags: string[]): Promise<void> {
  const supabase = requireSupabase()
  const tagIds = await ensureTags(tags)

  // Replace the entry's tag set.
  const { error: delError } = await supabase.from('entry_tags').delete().eq('entry_id', entryId)
  if (delError) throw new Error(delError.message)

  if (tagIds.length) {
    const { error } = await supabase
      .from('entry_tags')
      .insert(tagIds.map((tag_id) => ({ entry_id: entryId, tag_id })))
    if (error) throw new Error(error.message)
  }
}

export async function createEntry(input: EntryInput): Promise<string> {
  if (isMock()) return mockDb.createEntry(input)
  const { data, error } = await requireSupabase()
    .from('entries')
    .insert({
      title: input.title,
      type: input.type,
      summary: input.summary,
      content: input.content,
      source_url: input.source_url,
      attrs: input.attrs,
      status: input.status,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const id = data.id as string
  await syncEntryTags(id, input.tags)
  return id
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  if (isMock()) return mockDb.updateEntry(id, input)
  const { error } = await requireSupabase()
    .from('entries')
    .update({
      title: input.title,
      type: input.type,
      summary: input.summary,
      content: input.content,
      source_url: input.source_url,
      attrs: input.attrs,
      status: input.status,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await syncEntryTags(id, input.tags)
}

export async function deleteEntry(id: string): Promise<void> {
  if (isMock()) return mockDb.deleteEntry(id)
  const { error } = await requireSupabase().from('entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Mark an entry closed / reopened (used by 美食 「歇業」 instead of deleting). */
export async function setEntryClosed(id: string, closed: boolean): Promise<void> {
  if (isMock()) return mockDb.setEntryClosed(id, closed)
  const { error } = await requireSupabase().from('entries').update({ closed }).eq('id', id)
  if (error) throw new Error(error.message)
}
