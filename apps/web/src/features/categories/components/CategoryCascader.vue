<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDown, ChevronRight, ChevronLeft, Search, Check, X, Plus } from 'lucide-vue-next'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'

/**
 * 階層式分類選擇器(cascader):打開先列大類別 → 點入換該大類別的子類別
 * (‹ 返回);搜尋時跨層直搜全部子類別。＋ 跟著層級走:大類別層=建新
 * 大類別、子類別層=在該大類別底下新增子類別(自動帶入)。
 * v-model 是子類別 key。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | null
    placeholder?: string
    clearable?: boolean
    /** 顯示各層的 ＋ 新增按鈕(需父層接 create-domain / create-sub)。 */
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
const { open, style } = useAnchoredPanel(root, { panelMaxHeight: 340 })
onClickOutside(root, () => (open.value = false), { ignore: [panel] })

const term = ref('')
const curDomain = ref<string | null>(null)

const selected = computed(() => (props.modelValue ? store.typeByKey[props.modelValue] : undefined))

// 搜尋時跨層直搜子類別(想快的人不用鑽層)。
const searching = computed(() => term.value.trim().length > 0)
const searchResults = computed(() => {
  const t = term.value.trim().toLowerCase()
  return store.categories
    .filter((c) => c.name.toLowerCase().includes(t) || c.domain.toLowerCase().includes(t))
    .slice(0, 50)
})

const subs = computed(() => (curDomain.value ? (store.byDomain[curDomain.value] ?? []) : []))

function toggle() {
  open.value = !open.value
  if (open.value) {
    term.value = ''
    // 已有選擇 → 直接開在該大類別的子類別層,方便改選鄰近分類。
    curDomain.value = selected.value?.domain ?? null
  }
}
function pick(key: string) {
  emit('update:modelValue', key)
  open.value = false
}
function clear() {
  emit('update:modelValue', null)
  open.value = false
}
function onAction() {
  if (curDomain.value) emit('createSub', curDomain.value)
  else emit('createDomain')
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
        <!-- search + contextual ＋ -->
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
            :title="curDomain ? `在「${curDomain}」新增子類別` : '建立新大類別'"
            @click.stop="onAction"
          >
            <Plus :size="13" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto py-1 thin-scroll">
          <!-- 搜尋:跨層直列子類別 -->
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

          <!-- 層 1:大類別 -->
          <template v-else-if="!curDomain">
            <button
              v-for="d in store.domains"
              :key="d"
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
              @click="curDomain = d"
            >
              <span class="shrink-0">{{ domainIcon(d) }}</span>
              <span class="flex-1 truncate">{{ d }}</span>
              <span class="shrink-0 text-xs text-muted">{{ (store.byDomain[d] ?? []).length }}</span>
              <ChevronRight :size="14" class="shrink-0 text-muted" />
            </button>
          </template>

          <!-- 層 2:子類別(頂部 ‹ 返回) -->
          <template v-else>
            <button
              type="button"
              class="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-muted hover:bg-canvas hover:text-ink"
              @click="curDomain = null"
            >
              <ChevronLeft :size="14" class="shrink-0" />
              {{ domainIcon(curDomain) }} {{ curDomain }}
            </button>
            <div class="mx-3 border-t border-line" />
            <div v-if="subs.length === 0" class="px-3 py-2 text-sm text-muted">這個大類別還沒有子類別</div>
            <button
              v-for="c in subs"
              :key="c.key"
              type="button"
              class="flex w-full items-center gap-2 py-2 pl-6 pr-3 text-left text-sm text-ink hover:bg-canvas"
              @click="pick(c.key)"
            >
              <span class="shrink-0">{{ c.icon || '🏷️' }}</span>
              <span class="flex-1 truncate">{{ c.name }}</span>
              <Check v-if="c.key === modelValue" :size="14" class="shrink-0 text-accent" />
            </button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
