<script setup lang="ts">
defineProps<{
  loading?: boolean
  error?: string | null
  empty?: boolean
  emptyText?: string
}>()
</script>

<template>
  <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-16 text-muted">
    <span
      class="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent"
      aria-hidden="true"
    />
    <span class="text-sm">載入中…</span>
  </div>
  <div
    v-else-if="error"
    class="rounded-lg border border-red-300 bg-red-50 px-4 py-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
  >
    {{ error }}
  </div>
  <div
    v-else-if="empty"
    class="rounded-lg border border-dashed border-line px-4 py-16 text-center text-sm text-muted"
  >
    {{ emptyText ?? '目前沒有資料' }}
  </div>
  <slot v-else />
</template>
