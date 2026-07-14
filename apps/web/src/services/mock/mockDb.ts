import type { TypeDefinition } from '@inbox/shared-types'
import type { CategoryMeta, NewCategoryInput } from '@/features/categories/api/categoriesApi'
import type { EntryInput, EntryWithTags, PageQuery, PageResult } from '@/features/entries/types'
import { SCOPE_ALL, SCOPE_PENDING } from '@/features/entries/constants'
import { seedCategories, seedEntries } from './seed'

const STORAGE_KEY = 'ki-mock-v5'

interface TagMeta {
  name: string
  hidden: boolean
}
interface MockState {
  categories: TypeDefinition[]
  entries: EntryWithTags[]
  tags?: TagMeta[]
  domainOrder?: string[]
  /** 大類別自訂 icon(對應雲端 domain_meta)。 */
  domainIcons?: Record<string, string>
}

export interface TagDetail {
  name: string
  hidden: boolean
  count: number
}

// sort_order lives on the persisted category objects even though the shared
// TypeDefinition type doesn't declare it (it's a DB column, added by migration).
// Keep these helpers above module-level seed normalization: a first-time guest
// executes that path immediately, before later const declarations initialize (TDZ).
const sortOrderOf = (c: TypeDefinition): number => {
  return (c as unknown as { sort_order?: number }).sort_order ?? 0
}
const setSortOrder = (c: TypeDefinition, v: number) => {
  ;(c as unknown as { sort_order?: number }).sort_order = v
}

const load = (): MockState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockState
  } catch {
    /* ignore */
  }
  const seeded: MockState = { categories: seedCategories(), entries: seedEntries() }
  save(seeded)
  return seeded
}

const save = (state: MockState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

const state: MockState = load()

// Ensure the tag registry exists (derive from entries on first run).
if (!state.tags) {
  const names = new Set<string>()
  for (const e of state.entries) for (const t of e.tags) names.add(t)
  state.tags = [...names].sort().map((name) => ({ name, hidden: false }))
  save(state)
}

// Ensure a 大類別 order exists (derive from category order on first run).
if (!state.domainOrder) {
  const seen: string[] = []
  for (const c of [...state.categories].sort((a, b) => sortOrderOf(a) - sortOrderOf(b))) {
    if (!seen.includes(c.domain)) seen.push(c.domain)
  }
  state.domainOrder = seen
  save(state)
}

const persist = () => {
  save(state)
}

/** Add any tag names not yet in the registry (called when entries gain tags). */
const registerTags = (names: string[]) => {
  for (const n of names) {
    if (n && !state.tags!.some((t) => t.name === n)) state.tags!.push({ name: n, hidden: false })
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// ── Categories ─────────────────────────────────────────────────────
const withMeta = (cat: TypeDefinition): CategoryMeta => {
  const mine = state.entries
    .filter((e) => e.type === cat.key)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return { ...cat, count: mine.length, recentTitles: mine.slice(0, 4).map((e) => e.title) }
}

export const mockDb = {
  categoriesWithMeta(): CategoryMeta[] {
    const order = state.domainOrder ?? []
    return state.categories
      .filter((c) => c.status === 'active')
      .sort((a, b) => {
        const da = order.indexOf(a.domain)
        const db = order.indexOf(b.domain)
        if (da !== db) return da - db
        return sortOrderOf(a) - sortOrderOf(b)
      })
      .map((c) => clone(withMeta(c)))
  },

  reorderDomains(orderedDomains: string[]) {
    const existing = new Set(state.categories.map((c) => c.domain))
    state.domainOrder = orderedDomains.filter((d) => existing.has(d))
    persist()
  },

  reorderCategories(keys: string[]) {
    keys.forEach((key, i) => {
      const c = state.categories.find((x) => x.key === key)
      if (c) setSortOrder(c, (i + 1) * 10)
    })
    persist()
  },

  createCategory(input: NewCategoryInput) {
    if (state.categories.some((c) => c.key === input.key)) return
    // 同大類別下名稱唯一(對齊雲端 0009 的唯一約束)。
    if (state.categories.some((c) => c.domain === input.domain && c.name === input.name)) {
      throw new Error(`「${input.domain}」底下已有「${input.name}」,請換個名稱`)
    }
    state.categories.push({
      key: input.key,
      name: input.name,
      domain: input.domain,
      description: input.description,
      attrs_schema: input.attrs_schema ?? {},
      icon: input.icon ?? null,
      color: null,
      default_view: 'card',
      status: 'active',
      created_at: new Date().toISOString(),
    })
    if (state.domainOrder && !state.domainOrder.includes(input.domain)) {
      state.domainOrder.push(input.domain)
    }
    persist()
  },

  renameCategory(key: string, newName: string) {
    const c = state.categories.find((x) => x.key === key)
    if (!c) throw new Error('找不到這個子類別,請重新整理再試')
    // 同大類別下名稱唯一(對齊雲端 0009 的唯一約束)。
    if (state.categories.some((x) => x.key !== key && x.domain === c.domain && x.name === newName)) {
      throw new Error(`「${c.domain}」底下已有「${newName}」,請換個名稱`)
    }
    c.name = newName
    persist()
  },

  renameDomain(oldDomain: string, newDomain: string) {
    if (state.categories.some((c) => c.domain === newDomain)) {
      throw new Error(`已存在大類別「${newDomain}」,請換個名稱`)
    }
    for (const c of state.categories) if (c.domain === oldDomain) c.domain = newDomain
    if (state.domainOrder) {
      state.domainOrder = state.domainOrder.map((d) => (d === oldDomain ? newDomain : d))
    }
    if (state.domainIcons?.[oldDomain]) {
      state.domainIcons[newDomain] = state.domainIcons[oldDomain]
      delete state.domainIcons[oldDomain]
    }
    persist()
  },

  setCategoryColor(key: string, color: string) {
    const c = state.categories.find((x) => x.key === key)
    if (c) {
      c.color = color
      persist()
    }
  },

  /** 大類別自訂 icon(對應雲端 domain_meta)。 */
  domainIcons(): Record<string, string> {
    return { ...(state.domainIcons ?? {}) }
  },
  setDomainIcon(domain: string, icon: string) {
    state.domainIcons = { ...(state.domainIcons ?? {}), [domain]: icon }
    persist()
  },

  // ── Entries ───────────────────────────────────────────────────────
  entriesPage(q: PageQuery): PageResult {
    let rows = state.entries.slice()
    if (q.type === SCOPE_PENDING) rows = rows.filter((e) => e.status === 'pending_review')
    else if (q.type !== SCOPE_ALL) rows = rows.filter((e) => e.type === q.type)

    if (!q.includeClosed) rows = rows.filter((e) => !e.closed)
    if (q.tag) rows = rows.filter((e) => e.tags.includes(q.tag as string))

    const term = q.search.trim().toLowerCase()
    if (term) {
      rows = rows.filter((e) =>
        [e.title, e.summary, e.content].some((f) => (f ?? '').toLowerCase().includes(term)),
      )
    }

    if (q.sort === 'newest') rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    else if (q.sort === 'title') rows.sort((a, b) => a.title.localeCompare(b.title))
    else rows.sort((a, b) => a.sort_order - b.sort_order || (a.created_at < b.created_at ? 1 : -1))

    const total = rows.length
    const from = (q.page - 1) * q.pageSize
    return { rows: clone(rows.slice(from, from + q.pageSize)), total }
  },

  reorderEntries(ids: string[]) {
    ids.forEach((id, i) => {
      const e = state.entries.find((x) => x.id === id)
      if (e) e.sort_order = (i + 1) * 10
    })
    persist()
  },

  allTags(): string[] {
    // Non-hidden tags only (for the filter dropdown / suggestions).
    return state
      .tags!.filter((t) => !t.hidden)
      .map((t) => t.name)
      .sort()
  },

  listTags(): TagDetail[] {
    const counts = new Map<string, number>()
    for (const e of state.entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return state
      .tags!.map((t) => ({ name: t.name, hidden: t.hidden, count: counts.get(t.name) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  addTag(name: string) {
    const n = name.trim()
    if (n) registerTags([n])
    persist()
  },

  renameTag(oldName: string, next: string) {
    const nn = next.trim()
    if (!nn) return
    const reg = state.tags!.find((t) => t.name === oldName)
    if (reg) {
      // Merge if the new name already exists.
      if (state.tags!.some((t) => t.name === nn && t !== reg)) {
        state.tags = state.tags!.filter((t) => t !== reg)
      } else {
        reg.name = nn
      }
    }
    for (const e of state.entries) {
      if (e.tags.includes(oldName)) e.tags = [...new Set(e.tags.map((t) => (t === oldName ? nn : t)))]
    }
    persist()
  },

  setTagHidden(name: string, hidden: boolean) {
    const reg = state.tags!.find((t) => t.name === name)
    if (reg) reg.hidden = hidden
    persist()
  },

  getEntry(id: string): EntryWithTags | null {
    const e = state.entries.find((x) => x.id === id)
    return e ? clone(e) : null
  },

  createEntry(input: EntryInput): string {
    const id = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const now = new Date().toISOString()
    state.entries.unshift({
      id,
      user_id: 'mock',
      type: input.type,
      title: input.title,
      summary: input.summary,
      content: input.content,
      source_url: input.source_url,
      attrs: input.attrs,
      confidence: null,
      status: input.status,
      sort_order: 0,
      closed: false,
      created_at: now,
      updated_at: now,
      tags: input.tags,
    })
    registerTags(input.tags)
    persist()
    return id
  },

  updateEntry(id: string, input: EntryInput) {
    const e = state.entries.find((x) => x.id === id)
    if (!e) return
    Object.assign(e, {
      title: input.title,
      type: input.type,
      summary: input.summary,
      content: input.content,
      source_url: input.source_url,
      attrs: input.attrs,
      status: input.status,
      tags: input.tags,
      updated_at: new Date().toISOString(),
    })
    registerTags(input.tags)
    persist()
  },

  deleteEntry(id: string) {
    const i = state.entries.findIndex((x) => x.id === id)
    if (i >= 0) state.entries.splice(i, 1)
    persist()
  },

  setEntryClosed(id: string, closed: boolean) {
    const e = state.entries.find((x) => x.id === id)
    if (e) {
      e.closed = closed
      e.updated_at = new Date().toISOString()
    }
    persist()
  },
}
// NOTE: the old mock keyword classifier moved to features/capture/ruleClassifier.ts
// (規則分類器 v2 — shared by mock AND supabase modes; see docs/ai-strategy.md).
