<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import { topbarOpacity, sidebarOpacity, cardOpacity, entryOpacity, cardGlass } from './chromeOpacity'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal :open="props.open" title="玻璃質感" @close="emit('close')">
    <p class="mb-1.5 text-sm font-medium text-ink">把介面調成玻璃,讓活背景透出來。</p>
    <ul class="mb-4 space-y-0.5 text-xs text-muted">
      <li>· 只在有活背景的頁面生效;純色主題頁不受影響</li>
    </ul>
    <label class="mb-4 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm text-ink">
      <span>卡片毛玻璃<span class="ml-1 text-xs text-muted">(輪播若卡頓可關)</span></span>
      <input v-model="cardGlass" type="checkbox" class="h-4 w-4 accent-[var(--accent)]" />
    </label>
    <div class="flex flex-col gap-4">
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">頂欄
          <span class="font-mono text-muted">{{ 100 - topbarOpacity }}%</span>
        </span>
        <input v-model.number="topbarOpacity" type="range" min="15" max="95" step="5" class="grad-range w-full" style="direction: rtl" />
      </label>
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">側欄
          <span class="font-mono text-muted">{{ 100 - sidebarOpacity }}%</span>
        </span>
        <input v-model.number="sidebarOpacity" type="range" min="15" max="95" step="5" class="grad-range w-full" style="direction: rtl" />
      </label>
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">分類卡片
          <span class="font-mono text-muted">{{ 100 - cardOpacity }}%</span>
        </span>
        <input v-model.number="cardOpacity" type="range" min="20" max="100" step="4" class="grad-range w-full" style="direction: rtl" />
      </label>
      <label class="flex flex-col gap-1 text-sm text-ink">
        <span class="flex items-center justify-between">項目卡片
          <span class="font-mono text-muted">{{ 100 - entryOpacity }}%</span>
        </span>
        <input v-model.number="entryOpacity" type="range" min="20" max="100" step="4" class="grad-range w-full" style="direction: rtl" />
      </label>
    </div>
  </BaseModal>
</template>

<style scoped>
/* 漸層滑軌:白(少)→ 當前主題代表色(多),示意透明程度 */
.grad-range {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #ffffff, var(--accent));
  outline: none;
}
.grad-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.grad-range::-moz-range-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #ffffff, var(--accent));
}
.grad-range::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
</style>
