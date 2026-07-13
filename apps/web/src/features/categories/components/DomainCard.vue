<script setup lang="ts">
import { RouterLink } from 'vue-router'

// A 大類別 (domain) card for the home overview — the "破題" entry point that
// tells the user which big categories exist. Clicking opens the domain view
// (its 子類別 grid).
defineProps<{
  card: {
    domain: string
    icon: string
    count: number
    subCount: number
    subNames: string[]
  }
}>()
</script>

<template>
  <RouterLink
    v-tilt
    :to="{ name: 'domain', params: { domain: card.domain } }"
    class="flex h-full w-full flex-col gap-2 rounded-xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
  >
    <div class="flex items-center justify-between">
      <span class="text-3xl leading-none">{{ card.icon }}</span>
      <span class="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
        {{ card.count }} 筆
      </span>
    </div>
    <h3 class="text-lg font-semibold text-ink">{{ card.domain }}</h3>
    <span class="text-xs text-muted">{{ card.subCount }} 個子分類</span>
    <ul
      v-if="card.subNames.length"
      class="mt-1 flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-hidden"
    >
      <li
        v-for="(n, i) in card.subNames"
        :key="i"
        class="rounded-md bg-canvas px-2 py-0.5 text-xs text-muted"
      >
        {{ n }}
      </li>
    </ul>
    <p v-else class="mt-1 flex-1 text-xs text-muted/70">尚無子分類</p>
  </RouterLink>
</template>
