<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'
import { THEME_PRESETS } from './themePresets'
import { applyTheme, domainThemeKey, setDomainTheme } from './useCategoryTheme'

const props = defineProps<{ open: boolean; activeDomain?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()

function preview(key: string) {
  const p = THEME_PRESETS.find((x) => x.key === key)?.preset
  return p ? { bg: p.canvas, accent: p.accent } : { bg: '#f6f7f9', accent: '#2563eb' }
}
function change(domain: string, key: string) {
  setDomainTheme(domain, key)
  if (props.activeDomain === domain) applyTheme(domain) // reflect live if we're in it
}
</script>

<template>
  <BaseModal :open="props.open" title="大分類主題" size="lg" @close="emit('close')">
    <p class="mb-4 text-sm text-muted">
      為每個大分類指定一套世界主題(底色 + 文字 + accent)。進入該大分類的分類或項目時,整個介面會套用,像進入另一個世界。
    </p>
    <div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto thin-scroll">
      <div v-for="d in store.domains" :key="d" class="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2">
        <span class="text-lg">{{ domainIcon(d) }}</span>
        <span class="w-24 shrink-0 truncate text-sm font-medium text-ink">{{ d }}</span>
        <span
          class="flex h-6 w-10 shrink-0 items-center justify-center rounded border border-line"
          :style="{ background: preview(domainThemeKey(d)).bg }"
        >
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: preview(domainThemeKey(d)).accent }" />
        </span>
        <select
          :value="domainThemeKey(d)"
          class="ml-auto rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          @change="change(d, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in THEME_PRESETS" :key="p.key" :value="p.key">{{ p.label }}</option>
        </select>
      </div>
    </div>
  </BaseModal>
</template>
