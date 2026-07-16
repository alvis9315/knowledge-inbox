<script setup lang="ts">
import { Dices } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'
import { toast } from '@/composables/useToast'
import { THEME_PRESETS } from './themePresets'
import { applyTheme, domainThemeKey, setDomainTheme, homeThemeKey, setHomeTheme } from './useCategoryTheme'

const props = defineProps<{ open: boolean; activeDomain?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()

const preview = (key: string) => {
  const p = THEME_PRESETS.find((x) => x.key === key)?.preset
  return p ? { bg: p.canvas, accent: p.accent } : { bg: '#f6f7f9', accent: '#2563eb' }
}
const change = (domain: string, key: string) => {
  setDomainTheme(domain, key)
  if (props.activeDomain === domain) applyTheme(domain) // reflect live if we're in it
}

const PRESET_OPTIONS = THEME_PRESETS.map((p) => ({ value: p.key, label: p.label }))
const HOME_OPTIONS = [{ value: '__follow__', label: '跟隨登入頁' }, ...PRESET_OPTIONS]
const changeHome = (key: string) => {
  setHomeTheme(key === '__follow__' ? null : key)
  if (props.activeDomain == null) applyTheme(null) // 正在首頁就即時反映
}

// 🎲 隨機配主題:每個大分類抽一套(不重複,池夠大;排除圖片封面
// ——沒上傳封面會開天窗)。首頁導覽不動,骰不喜歡就再骰。
const rollThemes = () => {
  const pool = THEME_PRESETS.filter((p) => p.key !== 'photo-cover').map((p) => p.key)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  store.domains.forEach((d, i) => change(d, shuffled[i % shuffled.length]))
  toast.success('已隨機配好主題,不喜歡就再骰一次 🎲')
}
</script>

<template>
  <BaseModal :open="props.open" title="主題風格" size="lg" @close="emit('close')">
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <p class="text-sm font-medium text-ink">為每個大分類指定一套世界主題。</p>
      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:bg-canvas hover:text-ink"
        title="隨機幫每個大分類配一套主題(首頁導覽不動)"
        @click="rollThemes"
      >
        <Dices :size="15" /> 隨機配
      </button>
    </div>
    <ul class="mb-3 space-y-0.5 text-xs text-muted">
      <li>· 主題 = 底色 + 文字 + 主色,一進該大分類整個介面就切換</li>
      <li>· 子類別若另設主色,只覆蓋主色,底色文字仍照這裡</li>
    </ul>
    <div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto thin-scroll">
      <!-- 首頁導覽(總覽/全部/待確認)的主題;未指定=跟隨登入頁 -->
      <div class="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5">
        <span class="text-lg">🏠</span>
        <span class="w-24 shrink-0 truncate text-sm font-medium text-ink">首頁導覽</span>
        <div class="ml-auto w-40">
          <SearchableSelect
            :model-value="homeThemeKey() ?? '__follow__'"
            :options="HOME_OPTIONS"
            :searchable="false"
            :clearable="false"
            @update:model-value="changeHome($event ?? '__follow__')"
          />
        </div>
      </div>
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
