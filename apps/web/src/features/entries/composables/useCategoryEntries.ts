import { computed, ref, watch, type Ref } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { fetchEntriesPage, reorderEntries } from '@/features/entries/api/entriesApi'
import { PAGE_SIZE } from '@/features/entries/constants'
import type { EntryWithTags, SortMode } from '@/features/entries/types'
import { humanError } from '@/utils/humanError'

/**
 * State + actions for a category's paginated, sortable, searchable entry list.
 * 內部以 Vue Query 驅動(每組 分類/頁碼/排序/搜尋 是一個 cache key:
 * 翻頁與返回即時吃快取、重複請求去重、失敗自動重試一次);
 * 對外 API 與舊版完全相同,views 零改動。
 */
export const useCategoryEntries = (type: Ref<string>, revision: Ref<number>) => {
  const page = ref(1)
  const sort = ref<SortMode>('manual')
  const search = ref('')
  const tag = ref<string | null>(null)
  const includeClosed = ref(false)

  // 搜尋 250ms debounce 後才進 query key(避免每個字元打一發請求)。
  const debouncedSearch = ref('')
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      page.value = 1
      debouncedSearch.value = search.value
    }, 250)
  })

  // 分類/排序/標籤/結案篩選/資料版本 變更 → 回第 1 頁(key 變了 query 自動重抓)。
  watch([type, sort, tag, includeClosed, revision], () => {
    page.value = 1
  })

  const query = useQuery({
    queryKey: ['entries', type, page, sort, debouncedSearch, tag, includeClosed, revision],
    queryFn: () =>
      fetchEntriesPage({
        type: type.value,
        search: debouncedSearch.value,
        sort: sort.value,
        page: page.value,
        pageSize: PAGE_SIZE,
        tag: tag.value,
        includeClosed: includeClosed.value,
      }),
    // 翻頁時保留前一頁資料墊底,不閃空白。
    placeholderData: keepPreviousData,
  })

  // rows 是可寫鏡像:拖曳排序(VueDraggable)需要直接改陣列;
  // query 資料更新時覆蓋回來。
  const rows = ref<EntryWithTags[]>([])
  const total = ref(0)
  watch(
    () => query.data.value,
    (d) => {
      if (d) {
        rows.value = [...d.rows]
        total.value = d.total
      }
    },
    { immediate: true },
  )

  const loading = computed(() => query.isFetching.value)
  const localError = ref<string | null>(null)
  const error = computed(() =>
    localError.value ??
    (query.error.value ? humanError(query.error.value, '載入項目失敗,請重新整理再試') : null),
  )

  const load = async () => {
    localError.value = null
    await query.refetch()
  }

  /** Persist a manually dragged order (optimistic — rows already mutated by caller). */
  const persistOrder = async (orderedIds: string[]) => {
    try {
      await reorderEntries(orderedIds)
    } catch (e) {
      localError.value = humanError(e, '排序儲存失敗,請重新整理再試')
      await load()
    }
  }

  return { rows, total, page, sort, search, tag, includeClosed, loading, error, load, persistOrder }
}
