<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, Trash2, Store } from 'lucide-vue-next'
import TypeBadge from './TypeBadge.vue'
import TagChips from './TagChips.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import type { EntryWithTags } from '@/features/entries/types'

const props = defineProps<{ entry: EntryWithTags; draggable?: boolean }>()
const emit = defineEmits<{
  edit: [entry: EntryWithTags]
  remove: [entry: EntryWithTags]
  toggleClosed: [entry: EntryWithTags]
}>()
const router = useRouter()
const store = useCategoriesStore()

// 美食 uses 「歇業」 (keep data) instead of hard delete.
const isFood = computed(() => (props.entry.type ? store.typeByKey[props.entry.type]?.domain : null) === '美食')

const attrPairs = computed(() => {
  const a = props.entry.attrs
  if (!a || typeof a !== 'object' || Array.isArray(a)) return []
  return Object.entries(a as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => [k, String(v)] as const)
})

function open() {
  router.push({ name: 'entry-detail', params: { id: props.entry.id } })
}
</script>

<template>
  <article
    class="flex cursor-pointer flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    :class="draggable ? 'cursor-grab active:cursor-grabbing' : ''"
    @click="open"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <TypeBadge :type-key="entry.type" />
        <span
          v-if="entry.status === 'pending_review'"
          class="inline-flex items-center rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-fg"
        >待確認</span>
        <span
          v-if="entry.closed"
          class="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted"
        >已歇業</span>
      </div>
      <div class="flex shrink-0 gap-1">
        <button class="icon-btn" aria-label="編輯" @click.stop="emit('edit', entry)"><Pencil :size="15" /></button>
        <button
          v-if="isFood"
          class="icon-btn hover:text-amber-600"
          :aria-label="entry.closed ? '重新營業' : '標記歇業'"
          :title="entry.closed ? '重新營業' : '標記歇業'"
          @click.stop="emit('toggleClosed', entry)"
        >
          <Store :size="15" />
        </button>
        <button v-else class="icon-btn hover:text-red-600" aria-label="刪除" @click.stop="emit('remove', entry)">
          <Trash2 :size="15" />
        </button>
      </div>
    </div>

    <div class="min-w-0">
      <h3 class="line-clamp-2 break-words font-semibold text-ink">{{ entry.title }}</h3>
      <p v-if="entry.summary" class="mt-1 line-clamp-2 break-words text-sm text-muted">{{ entry.summary }}</p>
    </div>

    <dl v-if="attrPairs.length" class="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
      <div v-for="[k, v] in attrPairs.slice(0, 4)" :key="k" class="flex gap-1">
        <dt class="shrink-0 text-muted">{{ k }}</dt>
        <dd class="truncate text-ink/80">{{ v }}</dd>
      </div>
    </dl>

    <TagChips :tags="entry.tags" />

    <a
      v-if="entry.source_url"
      :href="entry.source_url"
      target="_blank"
      rel="noopener noreferrer"
      class="truncate text-xs text-accent hover:underline"
      @click.stop
    >{{ entry.source_url }}</a>
  </article>
</template>

<style scoped>
.icon-btn {
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--muted);
  transition: background-color 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--canvas);
}
</style>
