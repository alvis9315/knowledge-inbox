<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Search, CornerDownLeft } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import { fetchEntriesPage } from '@/features/entries/api/entriesApi'
import { SCOPE_ALL } from '@/features/entries/constants'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'
import type { EntryWithTags } from '@/features/entries/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const store = useCategoriesStore()

const term = ref('')
const results = ref<EntryWithTags[]>([])
const searching = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

// No term → jump to 大類別 (popular). Typing → match sub-category names.
const matchedCategories = computed(() => {
  const t = term.value.trim().toLowerCase()
  if (!t) return []
  return store.categories.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 6)
})
const domains = computed(() => store.domains)

watch(
  () => props.open,
  (o) => {
    if (o) {
      term.value = ''
      results.value = []
    }
  },
)

watch(term, (v) => {
  clearTimeout(timer)
  if (!v.trim()) {
    results.value = []
    return
  }
  timer = setTimeout(async () => {
    searching.value = true
    try {
      const { rows } = await fetchEntriesPage({
        type: SCOPE_ALL,
        search: v,
        sort: 'newest',
        page: 1,
        pageSize: 8,
      })
      results.value = rows
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }, 220)
})

function openEntry(id: string) {
  router.push({ name: 'entry-detail', params: { id } })
  emit('close')
}
function openCategory(key: string) {
  router.push({ name: 'category', params: { type: key } })
  emit('close')
}
function openDomain(domain: string) {
  router.push({ name: 'domain', params: { domain } })
  emit('close')
}
</script>

<template>
  <BaseModal :open="props.open" title="搜尋" @close="emit('close')">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3">
        <Search :size="16" class="text-muted" />
        <input
          v-model="term"
          autofocus
          placeholder="搜尋標題 / 摘要 / 內容,或跳到分類…"
          class="w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <div class="max-h-[50vh] overflow-y-auto">
        <template v-if="!term.trim()">
          <p class="px-1 py-1 text-xs font-semibold text-muted">大類別</p>
          <button
            v-for="d in domains"
            :key="d"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-canvas"
            @click="openDomain(d)"
          >
            <span>{{ domainIcon(d) }}</span>
            <span class="flex-1 truncate">{{ d }}</span>
          </button>
        </template>

        <p v-if="matchedCategories.length" class="px-1 py-1 text-xs font-semibold text-muted">分類</p>
        <button
          v-for="c in matchedCategories"
          :key="c.key"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-canvas"
          @click="openCategory(c.key)"
        >
          <span>{{ c.icon || '🏷️' }}</span>
          <span class="flex-1 truncate">{{ c.name }}</span>
          <span class="text-xs text-muted">{{ c.count }}</span>
        </button>

        <p v-if="term.trim()" class="px-1 pb-1 pt-3 text-xs font-semibold text-muted">
          項目 <span v-if="searching">· 搜尋中…</span>
        </p>
        <button
          v-for="e in results"
          :key="e.id"
          class="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-canvas"
          @click="openEntry(e.id)"
        >
          <span class="shrink-0">{{ store.typeByKey[e.type ?? '']?.icon || '📄' }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-ink">{{ e.title }}</span>
            <span v-if="e.summary" class="block truncate text-xs text-muted">{{ e.summary }}</span>
          </span>
          <CornerDownLeft :size="14" class="mt-1 shrink-0 text-muted" />
        </button>
        <p
          v-if="term.trim() && !searching && results.length === 0"
          class="px-2 py-3 text-sm text-muted"
        >
          找不到符合的項目
        </p>
      </div>
    </div>
  </BaseModal>
</template>
