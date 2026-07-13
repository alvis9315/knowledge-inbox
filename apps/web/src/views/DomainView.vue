<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { LayoutGrid, List, LayoutDashboard, ChevronRight } from 'lucide-vue-next'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import BgControlsButton from '@/features/theme/BgControlsButton.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import CategoryCard from '@/features/categories/components/CategoryCard.vue'
import { domainIcon } from '@/features/categories/domainIcons'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import type { CategoryMeta } from '@/features/categories/api/categoriesApi'

const props = defineProps<{ domain: string }>()
const store = useCategoriesStore()

// ── 篩選/排序/視圖(比照項目清單) ──
type SortMode = 'manual' | 'name' | 'count'
const sortMode = ref<SortMode>('manual')
const view = ref<'grid' | 'list' | 'masonry'>('grid')

const SORT_OPTIONS = [
  { value: 'manual', label: '手動排序(可拖曳)' },
  { value: 'name', label: '名稱' },
  { value: 'count', label: '筆數多 → 少' },
]

// Local mirror for drag reorder (VueDraggable needs a writable array).
const items = ref<CategoryMeta[]>([])
watch(
  () => [store.categories, props.domain] as const,
  () => {
    items.value = store.categories.filter((c) => c.domain === props.domain)
  },
  { immediate: true, deep: true },
)

const sorted = computed(() => {
  if (sortMode.value === 'name') return [...items.value].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  if (sortMode.value === 'count') return [...items.value].sort((a, b) => b.count - a.count)
  return items.value
})

// 拖曳只在「手動排序 + 一般網格」時啟用(排序後/瀑布流下拖曳無意義)。
const canDrag = computed(() => sortMode.value === 'manual' && view.value === 'grid')

/** Masonry 大小分級:項目越多的子類別卡越大(相對於本大類別最大值)。 */
function masonrySpan(c: CategoryMeta): string {
  const max = Math.max(1, ...items.value.map((x) => x.count))
  const ratio = c.count / max
  if (ratio >= 0.66 && c.count > 1) return 'sm:col-span-2 sm:row-span-2'
  if (ratio >= 0.33 && c.count > 0) return 'sm:row-span-2'
  return ''
}

/** Persist: rebuild the full ordered key list with this domain's new order. */
function persistOrder() {
  const ordered = store.domains.flatMap((d) =>
    d === props.domain ? items.value.map((c) => c.key) : (store.byDomain[d] ?? []).map((c) => c.key),
  )
  store.reorder(ordered)
}
</script>

<template>
  <section class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ domainIcon(domain) }}</span>
        <div>
          <h1 class="text-xl font-semibold text-ink">{{ domain }}</h1>
          <p class="text-sm text-muted">{{ items.length }} 個子類別</p>
        </div>
      </div>

      <!-- 排序 + 視圖切換 -->
      <div class="ml-auto flex items-center gap-2">
        <div class="w-44">
          <SearchableSelect
            :model-value="sortMode"
            :options="SORT_OPTIONS"
            :searchable="false"
            :clearable="false"
            @update:model-value="sortMode = ($event ?? 'manual') as SortMode"
          />
        </div>
        <BgControlsButton />
        <div class="flex rounded-lg border border-line p-0.5">
          <button
            class="rounded-md p-1.5"
            :class="view === 'grid' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
            aria-label="網格模式"
            @click="view = 'grid'"
          >
            <LayoutGrid :size="16" />
          </button>
          <button
            class="rounded-md p-1.5"
            :class="view === 'list' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
            aria-label="列表模式"
            @click="view = 'list'"
          >
            <List :size="16" />
          </button>
          <button
            class="rounded-md p-1.5"
            :class="view === 'masonry' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
            aria-label="瀑布流模式"
            title="瀑布流(項目越多的子類別卡越大)"
            @click="view = 'masonry'"
          >
            <LayoutDashboard :size="16" />
          </button>
        </div>
      </div>
    </div>

    <LoadingState
      :loading="store.loading && store.categories.length === 0"
      :error="store.error"
      :empty="!store.loading && items.length === 0"
      empty-text="這個大類別還沒有子類別。"
    >
      <!-- Masonry:項目多的卡大張(dense 填滿空隙) -->
      <div
        v-if="view === 'masonry'"
        class="grid auto-rows-[8.5rem] grid-flow-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <div v-for="cat in sorted" :key="cat.key" :class="masonrySpan(cat)">
          <CategoryCard :category="cat" />
        </div>
      </div>

      <!-- 清單模式 -->
      <div v-else-if="view === 'list'" class="flex flex-col gap-2">
        <RouterLink
          v-for="cat in sorted"
          :key="cat.key"
          :to="{ name: 'category', params: { type: cat.key } }"
          class="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span class="text-xl leading-none">{{ cat.icon || '🏷️' }}</span>
          <span class="flex-1 truncate font-medium text-ink">{{ cat.name }}</span>
          <span class="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{{ cat.count }} 筆</span>
          <ChevronRight :size="15" class="shrink-0 text-muted" />
        </RouterLink>
      </div>

      <!-- 網格(手動模式可整卡拖曳;順序同步側欄 + 首頁) -->
      <VueDraggable
        v-else
        v-model="items"
        :disabled="!canDrag"
        :animation="150"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        @update="persistOrder"
      >
        <div
          v-for="cat in canDrag ? items : sorted"
          :key="cat.key"
          :class="canDrag ? 'cursor-grab active:cursor-grabbing' : ''"
        >
          <CategoryCard :category="cat" />
        </div>
      </VueDraggable>
    </LoadingState>
  </section>
</template>
