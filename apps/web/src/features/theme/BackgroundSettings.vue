<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import { topbarOpacity, sidebarOpacity, cardOpacity, entryOpacity } from './chromeOpacity'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal :open="props.open" title="透明度調整" @close="emit('close')">
    <p class="mb-1.5 text-sm font-medium text-ink">調整介面各區塊的透明度,讓活背景透出來。</p>
    <ul class="mb-4 space-y-0.5 text-xs text-muted">
      <li>· 只在有活背景的頁面生效;純色主題頁不受影響</li>
    </ul>
    <div class="flex flex-col gap-4">
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">頂欄透明度
          <span class="font-mono text-muted">{{ 100 - topbarOpacity }}%</span>
        </span>
        <input v-model.number="topbarOpacity" type="range" min="15" max="95" step="5" class="w-full accent-[var(--accent)]" style="direction: rtl" />
      </label>
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">側欄透明度
          <span class="font-mono text-muted">{{ 100 - sidebarOpacity }}%</span>
        </span>
        <input v-model.number="sidebarOpacity" type="range" min="15" max="95" step="5" class="w-full accent-[var(--accent)]" style="direction: rtl" />
      </label>
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">分類卡片透明度
          <span class="font-mono text-muted">{{ 100 - cardOpacity }}%</span>
        </span>
        <input v-model.number="cardOpacity" type="range" min="20" max="100" step="4" class="w-full accent-[var(--accent)]" style="direction: rtl" />
      </label>
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">項目卡片透明度
          <span class="font-mono text-muted">{{ 100 - entryOpacity }}%</span>
        </span>
        <input v-model.number="entryOpacity" type="range" min="20" max="100" step="4" class="w-full accent-[var(--accent)]" style="direction: rtl" />
      </label>
    </div>
  </BaseModal>
</template>
