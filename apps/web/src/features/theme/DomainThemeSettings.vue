<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
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

const PRESET_OPTIONS = THEME_PRESETS.map((p) => ({ value: p.key, label: p.label }))
</script>

<template>
  <BaseModal :open="props.open" title="主題風格" size="lg" @close="emit('close')">
    <p class="mb-1.5 text-sm font-medium text-ink">為每個大分類指定一套世界主題。</p>
    <ul class="mb-3 space-y-0.5 text-xs text-muted">
      <li>· 主題 = 底色 + 文字 + 主色,一進該大分類整個介面就切換</li>
      <li>· 子類別若另設主色,只覆蓋主色,底色文字仍照這裡</li>
    </ul>
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
        <div class="ml-auto w-40">
          <SearchableSelect
            :model-value="domainThemeKey(d)"
            :options="PRESET_OPTIONS"
            :searchable="false"
            :clearable="false"
            @update:model-value="change(d, $event ?? 'default')"
          />
        </div>
      </div>
    </div>
  </BaseModal>
</template>
