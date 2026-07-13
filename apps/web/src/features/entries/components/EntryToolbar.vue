<script setup lang="ts">
import { LayoutGrid, List, Search, Download } from 'lucide-vue-next'
import type { SortMode, ViewMode } from '@/features/entries/types'

const view = defineModel<ViewMode>('view', { required: true })
const sort = defineModel<SortMode>('sort', { required: true })
const search = defineModel<string>('search', { required: true })
// simple: 只留搜尋——待確認審核頁用(排序/視圖/匯出對審核版型不適用)。
withDefaults(defineProps<{ simple?: boolean }>(), { simple: false })
defineEmits<{ export: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- search -->
    <div class="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
      <Search :size="15" class="text-muted" />
      <input
        v-model="search"
        type="search"
        placeholder="搜尋此分類…"
        class="w-full bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
      />
    </div>

    <!-- sort -->
    <select
      v-if="!simple"
      v-model="sort"
      class="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      aria-label="排序"
    >
      <option value="manual">手動排序(可拖曳)</option>
      <option value="newest">最新</option>
      <option value="title">標題</option>
    </select>

    <!-- view toggle -->
    <div v-if="!simple" class="flex rounded-lg border border-line p-0.5">
      <button
        class="rounded-md p-1.5"
        :class="view === 'card' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
        aria-label="卡片模式"
        @click="view = 'card'"
      >
        <LayoutGrid :size="16" />
      </button>
      <button
        class="rounded-md p-1.5"
        :class="view === 'list' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
        aria-label="列表模式"
        @click="view = 'list'"
      >
        <List :size="16" />
      </button>
    </div>

    <button
      v-if="!simple"
      class="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink"
      @click="$emit('export')"
    >
      <Download :size="15" />
      <span class="hidden sm:inline">匯出</span>
    </button>
  </div>
</template>
