<script setup lang="ts">
import { computed, reactive, ref, toRef, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { FileText, Braces, Sheet, ArrowLeft } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseConfirm from '@/components/common/BaseConfirm.vue'
import BasePagination from '@/components/common/BasePagination.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import EntryCard from '@/features/entries/components/EntryCard.vue'
import EntryListItem from '@/features/entries/components/EntryListItem.vue'
import EntryToolbar from '@/features/entries/components/EntryToolbar.vue'
import EntryForm from '@/features/entries/components/EntryForm.vue'
import ReviewItem from '@/features/entries/components/ReviewItem.vue'
import NewCategoryModal from '@/features/categories/components/NewCategoryModal.vue'
import { learnFromCorrection } from '@/features/capture/ruleClassifier'
import { toast } from '@/composables/useToast'
import { humanError } from '@/utils/humanError'
import { useCategoryEntries } from '@/features/entries/composables/useCategoryEntries'
import { useExport, type ExportFormat } from '@/features/entries/composables/useExport'
import { updateEntry, deleteEntry, setEntryClosed, fetchEntriesPage } from '@/features/entries/api/entriesApi'
import { SCOPE_ALL, SCOPE_PENDING, isRealCategory, PAGE_SIZE } from '@/features/entries/constants'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import type { EntryInput, EntryWithTags, ViewMode } from '@/features/entries/types'

const props = defineProps<{ type: string }>()
const store = useCategoriesStore()
const route = useRoute()
const { exportEntries } = useExport()

const typeRef = toRef(props, 'type')
const revision = computed(() => store.revision)
const { rows, total, page, sort, search, tag, includeClosed, loading, error, load, persistOrder } =
  useCategoryEntries(typeRef, revision)

const view = ref<ViewMode>('card')
const isFoodCategory = computed(() => store.typeByKey[props.type]?.domain === '美食')
const isReview = computed(() => props.type === SCOPE_PENDING)

// ── 待確認審核:每列選定的分類(預設 = 分類器建議)──
const reviewChoice = reactive<Record<string, string | null>>({})
watch(rows, () => {
  for (const e of rows.value) if (!(e.id in reviewChoice)) reviewChoice[e.id] = e.type
})
const filingId = ref<string | null>(null)

async function fileReviewed(entry: EntryWithTags, payload: { title: string; tags: string[] }) {
  const type = reviewChoice[entry.id]
  if (!type) return
  filingId.value = entry.id
  try {
    await updateEntry(entry.id, {
      title: payload.title,
      type,
      summary: entry.summary,
      content: entry.content,
      source_url: entry.source_url,
      attrs: entry.attrs,
      status: 'filed',
      tags: payload.tags,
    })
    // 回饋自學:人核准的分類把這段文字的詞加權進字典(越用越準)。
    learnFromCorrection(`${payload.title} ${entry.content ?? ''}`, type)
    await store.touch()
    await load()
    const c = store.typeByKey[type]
    toast.success(`已歸檔到「${c ? `${c.domain} / ${c.name}` : type}」`)
  } catch (e) {
    toast.error(humanError(e, '歸檔失敗,請稍後再試'))
  } finally {
    filingId.value = null
  }
}

// 快捷新增分類(審核列 cascader 的 ＋):帶入大類別 preset,建立後自動選進該列。
const newCatOpen = ref(false)
const newCatFor = ref<string | null>(null)
const newCatPreset = ref<{ domain: string | null; newDomain: boolean }>({ domain: null, newDomain: false })
function openNewCategory(entryId: string, preset: { domain: string | null; newDomain: boolean }) {
  newCatFor.value = entryId
  newCatPreset.value = preset
  newCatOpen.value = true
}
function onCategoryCreated(key: string) {
  if (newCatFor.value) reviewChoice[newCatFor.value] = key
}

// Tag filter (searchable dropdown). ?tag= (a clicked tag) drives it, even when
// we're already on this page.
const tagOptions = computed(() => store.tagNames.map((t) => ({ value: t, label: `#${t}` })))
watch(
  () => route.query.tag,
  (q) => (tag.value = typeof q === 'string' ? q : null),
  { immediate: true },
)

const heading = computed(() => {
  if (props.type === SCOPE_ALL) return { icon: '📥', name: '全部' }
  if (props.type === SCOPE_PENDING) return { icon: '🕓', name: '待確認' }
  const c = store.typeByKey[props.type]
  return { icon: c?.icon || '🏷️', name: c?.name ?? props.type }
})

const canDrag = computed(() => sort.value === 'manual' && isRealCategory(props.type))

// Back button: a real subcategory returns to its 大類別 view; 全部/待確認 → 總覽.
const backLink = computed(() => {
  const domain = store.typeByKey[props.type]?.domain
  if (isRealCategory(props.type) && domain) {
    return { to: { name: 'domain', params: { domain } }, label: `回「${domain}」` }
  }
  return { to: { name: 'home' }, label: '回總覽' }
})

// Load on mount + whenever the store becomes ready (session established).
watch(() => store.ready, (r) => r && load(), { immediate: true })

/** vue-draggable-plus writes the reordered array back into `rows`; persist ids. */
function onReorder() {
  persistOrder(rows.value.map((e) => e.id))
}

// ── edit / delete ──
const editing = ref<EntryWithTags | null>(null)
const editOpen = ref(false)
const saveError = ref<string | null>(null)

function openEdit(entry: EntryWithTags) {
  editing.value = entry
  saveError.value = null
  editOpen.value = true
}
async function handleSave(input: EntryInput, id?: string) {
  saveError.value = null
  try {
    if (id) await updateEntry(id, input)
    editOpen.value = false
    await store.touch()
    await load()
  } catch (e) {
    saveError.value = humanError(e, '儲存失敗,請稍後再試')
  }
}
// ── confirm (delete / 歇業) via a modern modal ──
interface ConfirmSpec {
  title: string
  message: string
  variant: 'primary' | 'danger'
  confirmText: string
  action: () => Promise<void>
}
const confirm = ref<ConfirmSpec | null>(null)
const confirmBusy = ref(false)

function askRemove(entry: EntryWithTags) {
  confirm.value = {
    title: '刪除項目',
    message: `確定刪除「${entry.title}」?此動作無法復原。`,
    variant: 'danger',
    confirmText: '刪除',
    action: async () => {
      await deleteEntry(entry.id)
      await store.touch()
      await load()
    },
  }
}
async function handleToggleClosed(entry: EntryWithTags) {
  if (entry.closed) {
    // Reopen — no confirmation needed.
    try {
      await setEntryClosed(entry.id, false)
      await store.touch()
      await load()
      toast.success(`「${entry.title}」已重新營業`)
    } catch (e) {
      toast.error(humanError(e, '操作失敗,請稍後再試'))
    }
    return
  }
  confirm.value = {
    title: '標記歇業',
    message: `確定「${entry.title}」已不再營業?資料不會刪除,之後預設只顯示營業中的店家(可勾選「顯示歇業」查看)。`,
    variant: 'primary',
    confirmText: '標記歇業',
    action: async () => {
      await setEntryClosed(entry.id, true)
      await store.touch()
      await load()
    },
  }
}
async function runConfirm() {
  if (!confirm.value) return
  confirmBusy.value = true
  try {
    await confirm.value.action()
    confirm.value = null
  } catch (e) {
    toast.error(humanError(e, '操作失敗,請稍後再試'))
  } finally {
    confirmBusy.value = false
  }
}

// ── export ──
const exportOpen = ref(false)
const exporting = ref(false)
async function doExport(format: ExportFormat) {
  exporting.value = true
  try {
    // Export the whole (filtered) category, not just the current page.
    const { rows: all } = await fetchEntriesPage({
      type: props.type,
      search: search.value,
      sort: sort.value,
      page: 1,
      pageSize: 1000,
    })
    await exportEntries(format, all, heading.value.name)
    exportOpen.value = false
    toast.success(`已匯出「${heading.value.name}」`)
  } catch (e) {
    toast.error(humanError(e, '匯出失敗,請稍後再試'))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-5">
    <RouterLink
      :to="backLink.to"
      class="inline-flex w-fit items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:-translate-x-0.5 hover:bg-canvas"
    >
      <ArrowLeft :size="16" /> {{ backLink.label }}
    </RouterLink>
    <div class="flex items-center gap-3">
      <span class="text-2xl">{{ heading.icon }}</span>
      <div>
        <h1 class="text-xl font-semibold text-ink">{{ heading.name }}</h1>
        <p class="text-sm text-muted">{{ total }} 筆</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="min-w-56 flex-1">
        <EntryToolbar v-model:view="view" v-model:sort="sort" v-model:search="search" :simple="isReview" @export="exportOpen = true" />
      </div>
      <div v-if="tagOptions.length" class="flex items-center gap-2">
        <span class="shrink-0 text-sm text-muted">標籤</span>
        <div class="w-48">
          <SearchableSelect v-model="tag" :options="tagOptions" placeholder="全部標籤" />
        </div>
      </div>
      <label v-if="isFoodCategory" class="flex items-center gap-1.5 text-sm text-muted">
        <input v-model="includeClosed" type="checkbox" class="rounded border-line text-accent focus:ring-accent" />
        顯示歇業
      </label>
    </div>

    <p v-if="canDrag && rows.length > 1" class="-mt-2 text-xs text-muted">
      手動排序模式:直接拖曳卡片即可調整順序。
    </p>

    <LoadingState
      :loading="loading && rows.length === 0"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      empty-text="這個分類還沒有項目。"
    >
      <!-- Review mode (待確認): suggestion + human confirm/correct → feedback learning -->
      <div v-if="isReview" class="flex flex-col gap-3">
        <ReviewItem
          v-for="entry in rows"
          :key="entry.id"
          v-model="reviewChoice[entry.id]"
          :entry="entry"
          :busy="filingId === entry.id"
          @file="fileReviewed(entry, $event)"
          @remove="askRemove(entry)"
          @new-category="openNewCategory(entry.id, $event)"
        />
      </div>

      <!-- Card mode -->
      <VueDraggable
        v-else-if="view === 'card'"
        v-model="rows"
        :disabled="!canDrag"
        :animation="150"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        @update="onReorder"
      >
        <EntryCard
          v-for="entry in rows"
          :key="entry.id"
          :entry="entry"
          :draggable="canDrag"
          @edit="openEdit"
          @remove="askRemove"
          @toggle-closed="handleToggleClosed"
        />
      </VueDraggable>

      <!-- Masonry mode(自然瀑布流:內容多的卡自然較高;不支援拖曳) -->
      <div v-else-if="view === 'masonry'" class="columns-1 gap-4 md:columns-2 lg:columns-3">
        <div v-for="entry in rows" :key="entry.id" class="mb-4 break-inside-avoid">
          <EntryCard
            :entry="entry"
            :draggable="false"
            @edit="openEdit"
            @remove="askRemove"
            @toggle-closed="handleToggleClosed"
          />
        </div>
      </div>

      <!-- List mode -->
      <VueDraggable
        v-else
        v-model="rows"
        :disabled="!canDrag"
        :animation="150"
        class="flex flex-col gap-2"
        @update="onReorder"
      >
        <EntryListItem
          v-for="entry in rows"
          :key="entry.id"
          :entry="entry"
          :draggable="canDrag"
          @edit="openEdit"
          @remove="askRemove"
          @toggle-closed="handleToggleClosed"
        />
      </VueDraggable>
    </LoadingState>

    <BasePagination :page="page" :page-size="PAGE_SIZE" :total="total" @update:page="page = $event" />

    <!-- edit modal -->
    <BaseModal :open="editOpen" title="編輯項目" @close="editOpen = false">
      <p v-if="saveError" class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ saveError }}</p>
      <EntryForm :entry="editing" @save="handleSave" @cancel="editOpen = false" />
    </BaseModal>

    <!-- export modal -->
    <BaseModal :open="exportOpen" title="匯出" @close="exportOpen = false">
      <p class="mb-4 text-sm text-muted">匯出「{{ heading.name }}」目前篩選的所有項目:</p>
      <div class="grid grid-cols-3 gap-3">
        <BaseButton variant="secondary" :disabled="exporting" @click="doExport('md')"><FileText :size="15" /> Markdown</BaseButton>
        <BaseButton variant="secondary" :disabled="exporting" @click="doExport('json')"><Braces :size="15" /> JSON</BaseButton>
        <BaseButton variant="secondary" :disabled="exporting" @click="doExport('excel')"><Sheet :size="15" /> Excel</BaseButton>
      </div>
    </BaseModal>

    <!-- quick-add category from a review row -->
    <NewCategoryModal
      :open="newCatOpen"
      :preset-domain="newCatPreset.domain"
      :start-new-domain="newCatPreset.newDomain"
      @close="newCatOpen = false"
      @created="onCategoryCreated"
    />

    <!-- confirm (delete / 歇業) -->
    <BaseConfirm
      :open="!!confirm"
      :title="confirm?.title"
      :variant="confirm?.variant"
      :confirm-text="confirm?.confirmText"
      :busy="confirmBusy"
      @confirm="runConfirm"
      @close="confirm = null"
    >
      {{ confirm?.message }}
    </BaseConfirm>
  </section>
</template>
