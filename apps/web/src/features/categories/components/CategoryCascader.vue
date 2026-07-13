<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDown, ChevronRight, Search, Check, X, Plus } from 'lucide-vue-next'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'

/**
 * 階層式分類選擇器(手風琴):大類別全部固定在清單上,點擊就地展開該
 * 大類別的子類別(縮排,同側欄的心智模型),再點收合;搜尋時跨層直搜
 * 全部子類別。＋:搜尋框旁=建新大類別;展開的子類別清單尾=在該大類別
 * 新增子類別(自動帶入)。v-model 是子類別 key。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | null
    placeholder?: string
    clearable?: boolean
    /** 顯示各層的 ＋ 新增(需父層接 create-domain / create-sub)。 */
    allowCreate?: boolean
  }>(),
  { placeholder: '選擇分類…', clearable: true, allowCreate: false },
)
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  createDomain: []
  createSub: [domain: string]
}>()

const store = useCategoriesStore()
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, style } = useAnchoredPanel(root, { panelMaxHeight: 360 })
onClickOutside(root, () => (open.value = false), { ignore: [panel] })

const term = ref('')
const expanded = ref<string | null>(null) // 展開中的大類別(手風琴:一次一個)

const selected = computed(() => (props.modelValue ? store.typeByKey[props.modelValue] : undefined))

// 搜尋時跨層直搜子類別(想快的人不用鑽層)。
const searching = computed(() => term.value.trim().length > 0)
const searchResults = computed(() => {
  const t = term.value.trim().toLowerCase()
  return store.categories
    .filter((c) => c.name.toLowerCase().includes(t) || c.domain.toLowerCase().includes(t))
    .slice(0, 50)
})

const toggle = () => {
  open.value = !open.value
  if (open.value) {
    term.value = ''
    // 已有選擇 → 自動展開它所屬的大類別。
    expanded.value = selected.value?.domain ?? null
  }
}
const toggleDomain = (d: string) => {
  expanded.value = expanded.value === d ? null : d
}
const pick = (key: string) => {
  emit('update:modelValue', key)
  open.value = false
}
const clear = () => {
  emit('update:modelValue', null)
  open.value = false
}
const createSub = (domain: string) => {
  emit('createSub', domain)
  open.value = false
}
const createDomain = () => {
  emit('createDomain')
  open.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      @click="toggle"
    >
      <span v-if="selected" class="shrink-0">{{ selected.icon || '🏷️' }}</span>
      <span class="flex-1 truncate text-left" :class="selected ? '' : 'text-muted'">
        {{ selected ? `${selected.domain} / ${selected.name}` : placeholder }}
      </span>
      <X
        v-if="clearable && selected"
        :size="14"
        class="shrink-0 text-muted hover:text-ink"
        @click.stop="clear"
      />
      <ChevronDown :size="15" class="shrink-0 text-muted" />
    </button>

    <Teleport to="body">
      <div v-if="open" ref="panel" :style="style" class="rounded-lg border border-line bg-surface shadow-lg">
        <!-- search + 建新大類別 -->
        <div class="flex shrink-0 items-center gap-2 border-b border-line px-3">
          <Search :size="14" class="shrink-0 text-muted" />
          <input
            v-model="term"
            autofocus
            placeholder="搜尋所有分類…"
            class="w-full bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            v-if="allowCreate"
            type="button"
            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-muted transition hover:bg-canvas hover:text-ink"
            title="建立新大類別"
            @click.stop="createDomain"
          >
            <Plus :size="13" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto py-1 thin-scroll">
          <!-- 搜尋:跨層直列 -->
          <template v-if="searching">
            <div v-if="searchResults.length === 0" class="px-3 py-2 text-sm text-muted">找不到符合分類</div>
            <button
              v-for="c in searchResults"
              :key="c.key"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
              @click="pick(c.key)"
            >
              <span class="shrink-0">{{ c.icon || '🏷️' }}</span>
              <span class="flex-1 truncate">{{ c.domain }} / {{ c.name }}</span>
              <Check v-if="c.key === modelValue" :size="14" class="shrink-0 text-accent" />
            </button>
          </template>

          <!-- 手風琴:大類別固定在列,點擊就地展開子類別 -->
          <template v-else>
            <div v-for="d in store.domains" :key="d">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-ink hover:bg-canvas"
                @click="toggleDomain(d)"
              >
                <ChevronRight
                  :size="14"
                  class="shrink-0 text-muted transition-transform"
                  :class="expanded === d ? 'rotate-90' : ''"
                />
                <span class="shrink-0">{{ domainIcon(d) }}</span>
                <span class="flex-1 truncate">{{ d }}</span>
                <span class="shrink-0 text-xs text-muted">{{ (store.byDomain[d] ?? []).length }}</span>
              </button>

              <div v-if="expanded === d" class="ml-5 border-l border-line">
                <button
                  v-for="c in store.byDomain[d] ?? []"
                  :key="c.key"
                  type="button"
                  class="flex w-full items-center gap-2 py-1.5 pl-4 pr-3 text-left text-sm text-ink hover:bg-canvas"
                  @click="pick(c.key)"
                >
                  <span class="shrink-0">{{ c.icon || '🏷️' }}</span>
                  <span class="flex-1 truncate">{{ c.name }}</span>
                  <Check v-if="c.key === modelValue" :size="14" class="shrink-0 text-accent" />
                </button>
                <button
                  v-if="allowCreate"
                  type="button"
                  class="flex w-full items-center gap-2 py-1.5 pl-4 pr-3 text-left text-sm text-accent hover:bg-canvas"
                  @click="createSub(d)"
                >
                  <Plus :size="13" class="shrink-0" /> 在「{{ d }}」新增子類別
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
