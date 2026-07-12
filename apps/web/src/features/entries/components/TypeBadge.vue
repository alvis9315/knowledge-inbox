<script setup lang="ts">
import { computed } from 'vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

const props = defineProps<{ typeKey: string | null }>()
const store = useCategoriesStore()

const def = computed(() => (props.typeKey ? store.typeByKey[props.typeKey] : undefined))
const label = computed(() => def.value?.name ?? props.typeKey ?? '未分類')
const domain = computed(() => def.value?.domain)
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    :class="
      domain === '技術'
        ? 'bg-tech-soft text-tech-fg'
        : domain === '生活'
          ? 'bg-life-soft text-life-fg'
          : 'bg-canvas text-muted'
    "
  >
    <span v-if="def?.icon">{{ def.icon }}</span>
    {{ label }}
  </span>
</template>
