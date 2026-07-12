<script setup lang="ts">
import { computed } from 'vue'
import TagChips from '@/features/entries/components/TagChips.vue'
import type { EntryWithTags } from '@/features/entries/types'

const props = defineProps<{ entry: EntryWithTags }>()

const attrPairs = computed(() => {
  const a = props.entry.attrs
  if (!a || typeof a !== 'object' || Array.isArray(a)) return []
  return Object.entries(a as Record<string, unknown>).filter(([, v]) => v !== null && String(v).trim() !== '')
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="entry.summary" class="text-muted">{{ entry.summary }}</p>

    <dl v-if="attrPairs.length" class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div v-for="[k, v] in attrPairs" :key="k" class="flex gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
        <dt class="shrink-0 font-medium text-muted">{{ k }}</dt>
        <dd class="text-ink">{{ v }}</dd>
      </div>
    </dl>

    <div v-if="entry.content" class="whitespace-pre-wrap rounded-lg bg-canvas p-4 text-sm text-ink/90">
      {{ entry.content }}
    </div>

    <TagChips :tags="entry.tags" />
  </div>
</template>
