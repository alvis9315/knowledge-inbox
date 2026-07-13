<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { setCategoryColor } from '@/features/categories/api/categoriesApi'
import { domainIcon } from '@/features/categories/domainIcons'
import { PRESET_COLORS, applyAccent } from './useCategoryTheme'
import { toast } from '@/composables/useToast'
import { humanError } from '@/utils/humanError'

const props = defineProps<{ open: boolean; activeType?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
const saving = ref<string | null>(null)

// 大類別篩選:先選大類別,再列該大類別的子類別(好找)。
const filterDomain = ref<string>('')
watch(
  () => props.open,
  (o) => {
    if (o) {
      // 預設帶入目前所在分類的大類別,否則第一個。
      const active = props.activeType ? store.typeByKey[props.activeType] : undefined
      filterDomain.value = active?.domain ?? store.domains[0] ?? ''
    }
  },
)
const filtered = computed(() => store.byDomain[filterDomain.value] ?? [])

async function pick(key: string, color: string) {
  saving.value = key
  try {
    await setCategoryColor(key, color)
    await store.reload()
    // If we're recoloring the category currently in view, reflect it live.
    if (props.activeType === key) applyAccent(color)
  } catch (e) {
    toast.error(humanError(e, '主色儲存失敗,請稍後再試'))
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="子類主色" size="lg" @close="emit('close')">
    <p class="mb-1.5 text-sm font-medium text-ink">為子類別挑一個專屬主色。</p>
    <ul class="mb-3 space-y-0.5 text-xs text-muted">
      <li>· 進入該分類時,按鈕、連結、頂部色條會換成這個顏色</li>
      <li>· 底色與文字不受影響,仍由「大類主題」的世界配色決定</li>
    </ul>

    <!-- 大類別篩選 chips -->
    <div class="mb-4 flex flex-wrap gap-1.5">
      <button
        v-for="d in store.domains"
        :key="d"
        type="button"
        class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition"
        :class="filterDomain === d
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line text-muted hover:bg-canvas hover:text-ink'"
        @click="filterDomain = d"
      >
        <span>{{ domainIcon(d) }}</span> {{ d }}
      </button>
    </div>

    <!-- 固定高度:切換大類別時彈窗不再變大變小跳動 -->
    <div class="flex h-[46vh] flex-col gap-3 overflow-y-auto pt-1.5 thin-scroll">
      <div v-for="cat in filtered" :key="cat.key" class="flex items-center gap-3">
        <span class="w-6 shrink-0 text-center">{{ cat.icon || '🏷️' }}</span>
        <span class="w-28 shrink-0 truncate text-sm text-ink">{{ cat.name }}</span>
        <ColorPicker
          :model-value="cat.color"
          :presets="PRESET_COLORS"
          :disabled="saving === cat.key"
          @update:model-value="pick(cat.key, $event)"
        />
      </div>
      <p v-if="filtered.length === 0" class="py-6 text-center text-sm text-muted">這個大類別還沒有子類別。</p>
    </div>
  </BaseModal>
</template>
