import { ref, watch, type Ref } from 'vue'
import { fetchEntriesPage, reorderEntries } from '@/features/entries/api/entriesApi'
import { PAGE_SIZE } from '@/features/entries/constants'
import type { EntryWithTags, SortMode } from '@/features/entries/types'
import { humanError } from '@/utils/humanError'

/** State + actions for a category's paginated, sortable, searchable entry list. */
export function useCategoryEntries(type: Ref<string>, revision: Ref<number>) {
  const rows = ref<EntryWithTags[]>([])
  const total = ref(0)
  const page = ref(1)
  const sort = ref<SortMode>('manual')
  const search = ref('')
  const tag = ref<string | null>(null)
  const includeClosed = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let searchTimer: ReturnType<typeof setTimeout> | undefined

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetchEntriesPage({
        type: type.value,
        search: search.value,
        sort: sort.value,
        page: page.value,
        pageSize: PAGE_SIZE,
        tag: tag.value,
        includeClosed: includeClosed.value,
      })
      rows.value = res.rows
      total.value = res.total
    } catch (e) {
      error.value = humanError(e, '載入項目失敗,請重新整理再試')
    } finally {
      loading.value = false
    }
  }

  // Reset to page 1 and reload when the category, sort, tag, closed, or revision changes.
  watch([type, sort, tag, includeClosed, revision], () => {
    page.value = 1
    load()
  })
  watch(page, load)
  // Debounce search input.
  watch(search, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      page.value = 1
      load()
    }, 250)
  })

  /** Persist a manually dragged order (optimistic — rows already mutated by caller). */
  async function persistOrder(orderedIds: string[]) {
    try {
      await reorderEntries(orderedIds)
    } catch (e) {
      error.value = humanError(e, '排序儲存失敗,請重新整理再試')
      await load()
    }
  }

  return { rows, total, page, sort, search, tag, includeClosed, loading, error, load, persistOrder }
}
