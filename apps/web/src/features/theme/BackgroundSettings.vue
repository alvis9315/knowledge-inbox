<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import { topbarOpacity, sidebarOpacity } from './chromeOpacity'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal :open="props.open" title="介面背景" @close="emit('close')">
    <p class="mb-1.5 text-sm font-medium text-ink">調整頂欄與側欄的透明度。</p>
    <ul class="mb-4 space-y-0.5 text-xs text-muted">
      <li>· 僅在「登入風格活背景」的頁面生效(總覽/全部/待確認)</li>
      <li>· 進入大類別時仍以「大類主題」的世界配色為準</li>
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
    </div>
  </BaseModal>
</template>
