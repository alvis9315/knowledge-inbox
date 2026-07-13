<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.page * props.pageSize, props.total))

const go = (p: number) => {
  if (p >= 1 && p <= totalPages.value) emit('update:page', p)
}
</script>

<template>
  <div v-if="total > pageSize" class="flex items-center justify-between gap-3 text-sm text-muted">
    <span>{{ from }}–{{ to }} / 共 {{ total }} 筆</span>
    <div class="flex items-center gap-1">
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line disabled:opacity-40 hover:bg-canvas"
        :disabled="page <= 1"
        aria-label="上一頁"
        @click="go(page - 1)"
      >
        <ChevronLeft :size="16" />
      </button>
      <span class="px-2 text-ink">{{ page }} / {{ totalPages }}</span>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line disabled:opacity-40 hover:bg-canvas"
        :disabled="page >= totalPages"
        aria-label="下一頁"
        @click="go(page + 1)"
      >
        <ChevronRight :size="16" />
      </button>
    </div>
  </div>
</template>
