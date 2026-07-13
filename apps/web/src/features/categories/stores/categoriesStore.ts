import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TypeDefinition } from '@inbox/shared-types'
import { ensureSession } from '@/services/session'
import {
  createCategory,
  fetchCategoriesWithMeta,
  fetchDomainIcons,
  reorderCategories,
  reorderDomains as reorderDomainsApi,
  type CategoryMeta,
  type NewCategoryInput,
} from '@/features/categories/api/categoriesApi'
import { fetchAllTagNames } from '@/features/tags/api/tagsApi'
import { setDomainIconOverrides } from '@/features/categories/domainIcons'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<CategoryMeta[]>([])
  const tagNames = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)
  /** Bumped whenever entries change, so open views can reload. */
  const revision = ref(0)

  async function touch() {
    revision.value++
    await reload()
  }

  const typeByKey = computed<Record<string, CategoryMeta>>(() =>
    Object.fromEntries(categories.value.map((c) => [c.key, c])),
  )
  // First-appearance order (categories are already sorted by sort_order), so the
  // 大類別 keep their intended order rather than an alphabetical one.
  const domains = computed(() => [...new Set(categories.value.map((c) => c.domain))])

  /** Categories grouped by domain, preserving sort_order within each group. */
  const byDomain = computed<Record<string, CategoryMeta[]>>(() => {
    const groups: Record<string, CategoryMeta[]> = {}
    for (const c of categories.value) (groups[c.domain] ??= []).push(c)
    return groups
  })

  /** Plain TypeDefinition list, for schema-driven forms. */
  const typeDefinitions = computed<TypeDefinition[]>(() => categories.value)

  async function reload() {
    loading.value = true
    error.value = null
    try {
      const [cats, tags, icons] = await Promise.all([
        fetchCategoriesWithMeta(),
        fetchAllTagNames(),
        fetchDomainIcons(),
      ])
      categories.value = cats
      tagNames.value = tags
      setDomainIconOverrides(icons)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function init() {
    if (ready.value) return
    loading.value = true
    error.value = null
    try {
      await ensureSession()
      const [cats, tags, icons] = await Promise.all([
        fetchCategoriesWithMeta(),
        fetchAllTagNames(),
        fetchDomainIcons(),
      ])
      categories.value = cats
      tagNames.value = tags
      setDomainIconOverrides(icons)
      ready.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** Optimistic reorder: reflect immediately, persist async, roll back on error. */
  async function reorder(orderedKeys: string[]) {
    const prev = categories.value
    const byKey = new Map(categories.value.map((c) => [c.key, c]))
    categories.value = orderedKeys.map((k) => byKey.get(k)).filter(Boolean) as CategoryMeta[]
    try {
      await reorderCategories(orderedKeys)
    } catch (e) {
      categories.value = prev
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function addCategory(input: NewCategoryInput) {
    await createCategory(input)
    await reload()
  }

  /** Reorder the 大類別 (domains); reflect immediately, persist, reload. */
  async function reorderDomains(orderedDomains: string[]) {
    const prev = categories.value
    const rank = new Map(orderedDomains.map((d, i) => [d, i]))
    categories.value = [...categories.value].sort((a, b) => {
      const da = rank.get(a.domain) ?? 999
      const db = rank.get(b.domain) ?? 999
      return da - db
    })
    try {
      await reorderDomainsApi(orderedDomains)
    } catch (e) {
      categories.value = prev
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  return {
    categories,
    tagNames,
    loading,
    error,
    ready,
    revision,
    typeByKey,
    domains,
    byDomain,
    typeDefinitions,
    init,
    reload,
    touch,
    reorder,
    reorderDomains,
    addCategory,
  }
})
