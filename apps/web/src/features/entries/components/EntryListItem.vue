<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, Trash2, Store } from 'lucide-vue-next'
import TypeBadge from './TypeBadge.vue'
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
const isFood = computed(() => (props.entry.type ? store.typeByKey[props.entry.type]?.domain : null) === '美食')

function open() {
  router.push({ name: 'entry-detail', params: { id: props.entry.id } })
}
</script>

<template>
  <div
    class="flex cursor-pointer items-center gap-3 rounded-lg border border-line entry-bg px-3 py-2.5 transition hover:bg-canvas"
    :class="draggable ? 'cursor-grab active:cursor-grabbing' : ''"
    @click="open"
  >
    <TypeBadge :type-key="entry.type" />
    <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ entry.title }}</span>
    <span
      v-if="entry.status === 'pending_review'"
      class="hidden shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn-fg sm:inline"
    >待確認</span>
    <span
      v-if="entry.closed"
      class="hidden shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted sm:inline"
    >已歇業</span>
    <span class="hidden shrink-0 text-xs text-muted md:inline">
      {{ new Date(entry.created_at).toLocaleDateString() }}
    </span>
    <div class="flex shrink-0 gap-1">
      <button class="icon-btn" aria-label="編輯" @click.stop="emit('edit', entry)"><Pencil :size="14" /></button>
      <button
        v-if="isFood"
        class="icon-btn hover:text-amber-600"
        :title="entry.closed ? '重新營業' : '標記歇業'"
        @click.stop="emit('toggleClosed', entry)"
      >
        <Store :size="14" />
      </button>
      <button v-else class="icon-btn hover:text-red-600" aria-label="刪除" @click.stop="emit('remove', entry)">
        <Trash2 :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.icon-btn {
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--muted);
}
.icon-btn:hover {
  color: var(--ink);
}
</style>
