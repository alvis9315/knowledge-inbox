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
import { humanError } from '@/utils/humanError'
import { isMock } from '@/services/dataMode'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<CategoryMeta[]>([])
  const tagNames = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)
  /** Bumped whenever entries change, so open views can reload. */
  const revision = ref(0)

  const touch = async () => {
    revision.value++
    await reload()
    // 使用者視角:操作後畫面必須是乾淨的成功狀態——reload 失敗也算
    // 整個流程失敗,往上拋讓呼叫端報失敗,不得默默吞掉。
    if (error.value) throw new Error(error.value)
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

  const reload = async () => {
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
      error.value = humanError(e, '載入資料失敗,請重新整理再試')
    } finally {
      loading.value = false
    }
  }

  // 記住資料載入當下的來源模式:訪客(mock)↔ 登入(supabase)切換時,
  // 舊快取必須失效重載——否則側欄會殘留另一個模式的資料(筆數對不上)。
  let loadedMode: boolean | null = null

  const init = async () => {
    if (ready.value && loadedMode === isMock()) return
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
      loadedMode = isMock()
      ready.value = true
    } catch (e) {
      error.value = humanError(e, '載入資料失敗,請重新整理再試')
    } finally {
      loading.value = false
    }
  }

  /** Optimistic reorder: reflect immediately, persist async, roll back on error. */
  const reorder = async (orderedKeys: string[]) => {
    const prev = categories.value
    const byKey = new Map(categories.value.map((c) => [c.key, c]))
    categories.value = orderedKeys.map((k) => byKey.get(k)).filter(Boolean) as CategoryMeta[]
    try {
      await reorderCategories(orderedKeys)
    } catch (e) {
      categories.value = prev
      error.value = humanError(e, '排序儲存失敗,已還原原本順序')
    }
  }

  const addCategory = async (input: NewCategoryInput) => {
    await createCategory(input)
    await reload()
    // 使用者視角:按「建立」後畫面必須是乾淨的成功狀態——reload 失敗
    // 也算整個流程失敗,往上拋讓呼叫端顯示失敗訊息,不得默默吞掉。
    if (error.value) throw new Error(error.value)
  }

  /** Reorder the 大類別 (domains); reflect immediately, persist, reload. */
  const reorderDomains = async (orderedDomains: string[]) => {
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
      error.value = humanError(e, '排序儲存失敗,已還原原本順序')
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
