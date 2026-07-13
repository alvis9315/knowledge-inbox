<script setup lang="ts">
import { computed } from 'vue'
import { MapPin, Clock, Utensils } from 'lucide-vue-next'
import TagChips from '@/features/entries/components/TagChips.vue'
import type { EntryWithTags } from '@/features/entries/types'

const props = defineProps<{ entry: EntryWithTags }>()

const attr = (key: string): string => {
  const a = props.entry.attrs
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const v = (a as Record<string, unknown>)[key]
    return v != null ? String(v) : ''
  }
  return ''
}

const mapsUrl = computed(() => {
  const q = [attr('地址'), props.entry.title].filter(Boolean).join(' ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- price + city headline -->
    <div class="flex flex-wrap items-center gap-3">
      <span v-if="attr('價位')" class="rounded-lg bg-accent-soft px-3 py-1 text-lg font-semibold text-accent">
        {{ attr('價位') }}
      </span>
      <span v-if="attr('城市')" class="inline-flex items-center gap-1 text-sm text-muted">
        <MapPin :size="14" /> {{ attr('城市') }}
      </span>
      <span v-if="attr('營業時間')" class="inline-flex items-center gap-1 text-sm text-muted">
        <Clock :size="14" /> {{ attr('營業時間') }}
      </span>
    </div>

    <p v-if="entry.summary" class="text-muted">{{ entry.summary }}</p>

    <div v-if="attr('推薦品項')" class="flex items-center gap-2 rounded-lg border border-accent-soft bg-accent-soft px-4 py-3">
      <Utensils :size="16" class="text-accent" />
      <span class="text-sm text-ink"><b>推薦</b>:{{ attr('推薦品項') }}</span>
    </div>

    <a
      v-if="attr('地址') || entry.title"
      :href="mapsUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex w-fit items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-canvas"
    >
      <MapPin :size="15" /> 在 Google 地圖查看
      <span v-if="attr('地址')" class="text-muted">· {{ attr('地址') }}</span>
    </a>

    <div v-if="entry.content" class="whitespace-pre-wrap rounded-lg bg-canvas p-4 text-sm text-ink/90">
      {{ entry.content }}
    </div>

    <TagChips :tags="entry.tags" />
  </div>
</template>
