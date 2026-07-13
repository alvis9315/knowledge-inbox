<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { CategoryMeta } from '@/features/categories/api/categoriesApi'

defineProps<{ category: CategoryMeta }>()
</script>

<template>
  <RouterLink
    v-tilt
    :to="{ name: 'category', params: { type: category.key } }"
    class="flex h-full w-full flex-col gap-2 rounded-xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div class="flex items-center justify-between">
      <span class="text-2xl leading-none">{{ category.icon || '🏷️' }}</span>
      <span class="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
        {{ category.count }} 筆
      </span>
    </div>
    <h3 class="font-semibold text-ink">{{ category.name }}</h3>
    <span class="text-xs text-muted">{{ category.domain }}</span>
    <ul
      v-if="category.recentTitles.length"
      class="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden"
    >
      <li v-for="(t, i) in category.recentTitles" :key="i" class="truncate text-xs text-muted">
        · {{ t }}
      </li>
    </ul>
    <p v-else class="mt-1 flex-1 text-xs text-muted/70">尚無項目</p>
  </RouterLink>
</template>
