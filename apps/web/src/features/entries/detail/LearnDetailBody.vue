<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink, GraduationCap } from 'lucide-vue-next'
import TagChips from '@/features/entries/components/TagChips.vue'
import type { EntryWithTags } from '@/features/entries/types'

const props = defineProps<{ entry: EntryWithTags }>()

function attr(key: string): string {
  const a = props.entry.attrs
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const v = (a as Record<string, unknown>)[key]
    return v != null ? String(v) : ''
  }
  return ''
}

const level = computed(() => attr('難度'))
const resource = computed(() => attr('資源連結'))
const note = computed(() => attr('筆記') || props.entry.content || '')
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="level" class="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
        <GraduationCap :size="14" /> {{ level }}
      </span>
    </div>

    <p v-if="entry.summary" class="text-muted">{{ entry.summary }}</p>

    <a
      v-if="resource"
      :href="resource"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex w-fit items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-accent hover:bg-canvas"
    >
      <ExternalLink :size="15" /> 開啟學習資源
    </a>

    <div v-if="note" class="rounded-lg border-l-4 border-accent bg-canvas p-4">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">筆記</p>
      <div class="whitespace-pre-wrap text-sm text-ink/90">{{ note }}</div>
    </div>

    <TagChips :tags="entry.tags" />
  </div>
</template>
