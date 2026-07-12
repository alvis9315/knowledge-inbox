import type { Json, TypeDefinition } from '@inbox/shared-types'
import { requireSupabase } from '@/services/supabaseClient'
import { isMock } from '@/services/dataMode'
import { mockDb } from '@/services/mock/mockDb'

export interface CategoryMeta extends TypeDefinition {
  count: number
  recentTitles: string[]
}

/** Categories ordered by sort_order, enriched with count + recent titles. */
export async function fetchCategoriesWithMeta(): Promise<CategoryMeta[]> {
  if (isMock()) return mockDb.categoriesWithMeta()
  const supabase = requireSupabase()

  const [cats, counts, recent] = await Promise.all([
    supabase
      .from('type_definitions')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('category_counts').select('key, n'),
    supabase
      .from('entries')
      .select('type, title, created_at')
      .order('created_at', { ascending: false })
      .limit(120),
  ])

  if (cats.error) throw new Error(cats.error.message)
  if (counts.error) throw new Error(counts.error.message)
  if (recent.error) throw new Error(recent.error.message)

  const countByKey = new Map<string, number>()
  for (const c of counts.data ?? []) countByKey.set(c.key as string, c.n as number)

  const titlesByKey = new Map<string, string[]>()
  for (const r of recent.data ?? []) {
    const key = r.type as string | null
    if (!key) continue
    const list = titlesByKey.get(key) ?? []
    if (list.length < 4) list.push(r.title as string)
    titlesByKey.set(key, list)
  }

  return (cats.data ?? []).map((c) => ({
    ...(c as TypeDefinition),
    count: countByKey.get(c.key as string) ?? 0,
    recentTitles: titlesByKey.get(c.key as string) ?? [],
  }))
}

/** Persist a new 大類別 (domain) order. */
export async function reorderDomains(orderedDomains: string[]): Promise<void> {
  if (isMock()) return mockDb.reorderDomains(orderedDomains)
  const supabase = requireSupabase()
  const { data, error } = await supabase.from('type_definitions').select('key, domain, sort_order')
  if (error) throw new Error(error.message)
  const cats = (data ?? []) as { key: string; domain: string; sort_order: number }[]
  cats.sort((a, b) => {
    const da = orderedDomains.indexOf(a.domain)
    const db = orderedDomains.indexOf(b.domain)
    if (da !== db) return da - db
    return a.sort_order - b.sort_order
  })
  await Promise.all(
    cats.map((c, i) =>
      supabase.from('type_definitions').update({ sort_order: (i + 1) * 10 }).eq('key', c.key),
    ),
  )
}

/** Persist a new category order (array of keys, front to back). */
export async function reorderCategories(orderedKeys: string[]): Promise<void> {
  if (isMock()) return mockDb.reorderCategories(orderedKeys)
  const supabase = requireSupabase()
  await Promise.all(
    orderedKeys.map((key, i) =>
      supabase.from('type_definitions').update({ sort_order: (i + 1) * 10 }).eq('key', key),
    ),
  )
}

export interface NewCategoryInput {
  key: string
  name: string
  domain: string
  description: string
  icon?: string
  attrs_schema?: Json
}

export async function createCategory(input: NewCategoryInput): Promise<void> {
  if (isMock()) return mockDb.createCategory(input)
  const { error } = await requireSupabase()
    .from('type_definitions')
    .insert({
      key: input.key,
      name: input.name,
      domain: input.domain,
      description: input.description,
      icon: input.icon ?? null,
      attrs_schema: input.attrs_schema ?? {},
      status: 'active',
      sort_order: 9999,
    })
  if (error) throw new Error(error.message)
}

/** Set a category's accent color (drives per-category theming). */
export async function setCategoryColor(key: string, color: string): Promise<void> {
  if (isMock()) return mockDb.setCategoryColor(key, color)
  const { error } = await requireSupabase()
    .from('type_definitions')
    .update({ color })
    .eq('key', key)
  if (error) throw new Error(error.message)
}
