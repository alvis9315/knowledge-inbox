import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
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

/**
 * 分類 store(Vue Query phase 2):讀路徑改 query 驅動——
 * 去重/重試/快取交給 query;資料來源(mock/db)進 key,模式切換自動失效
 * (取代舊的 loadedMode 手工追蹤)。對外 API 與行為契約完全不變:
 * categories 仍是可寫 ref(樂觀排序需要)、touch/addCategory 失敗照樣往上拋。
 */
export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<CategoryMeta[]>([])
  const tagNames = ref<string[]>([])
  const error = ref<string | null>(null)
  const ready = ref(false)
  /** Bumped whenever entries change, so open views can reload. */
  const revision = ref(0)

  // 讀路徑:三合一(分類+標籤+icon)一個 query。
  // enabled 閘門:等 init() 的 ensureSession 完成才開抓——session 未恢復時
  // 對 supabase 查詢會被 RLS 濾成空,快取到空資料就是側欄空白 bug。
  const dataSource = computed(() => (isMock() ? 'mock' : 'db'))
  const fetchEnabled = ref(false)
  const query = useQuery({
    queryKey: ['categories-meta', dataSource],
    queryFn: async () => {
      const [cats, tags, icons] = await Promise.all([
        fetchCategoriesWithMeta(),
        fetchAllTagNames(),
        fetchDomainIcons(),
      ])
      return { cats, tags, icons }
    },
    enabled: fetchEnabled,
    // 刻意不用 keepPreviousData:跨模式(mock↔db)殘影就是之前的筆數 bug。
  })

  // categories 是可寫鏡像:拖曳排序要直接改陣列;query 更新時覆蓋回來。
  watch(
    () => query.data.value,
    (d) => {
      if (!d) return
      categories.value = d.cats
      tagNames.value = d.tags
      setDomainIconOverrides(d.icons)
      ready.value = true
    },
    { immediate: true },
  )
  // query 層的錯誤翻成中文進同一個 error ref(操作類錯誤也寫這裡)。
  watch(
    () => query.error.value,
    (e) => {
      if (e) error.value = humanError(e, '載入資料失敗,請重新整理再試')
    },
  )
  const loading = computed(() => query.isFetching.value)

  const reload = async () => {
    error.value = null
    const r = await query.refetch()
    if (r.error) error.value = humanError(r.error, '載入資料失敗,請重新整理再試')
  }

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

  const init = async () => {
    error.value = null
    try {
      await ensureSession()
    } catch (e) {
      error.value = humanError(e, '載入資料失敗,請重新整理再試')
      return
    }
    if (!fetchEnabled.value) {
      fetchEnabled.value = true // enabled 翻正會自動觸發首抓
      return
    }
    // 已啟用過(如登入↔訪客切換後重進):key 換了會自抓;同 key 則刷新一次。
    await reload()
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
