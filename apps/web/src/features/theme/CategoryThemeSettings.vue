<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { setCategoryColor } from '@/features/categories/api/categoriesApi'
import { PRESET_COLORS, applyAccent } from './useCategoryTheme'

const props = defineProps<{ open: boolean; activeType?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
const saving = ref<string | null>(null)

async function pick(key: string, color: string) {
  saving.value = key
  try {
    await setCategoryColor(key, color)
    await store.reload()
    // If we're recoloring the category currently in view, reflect it live.
    if (props.activeType === key) applyAccent(color)
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="子分類主色" size="lg" @close="emit('close')">
    <p class="mb-4 text-sm text-muted">
      每個子分類可設定專屬主色。進入該分類時,介面主色(按鈕、連結、色條)會換成這個顏色;大分類主題的底色與文字仍沿用世界配色。
    </p>
    <div class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
      <div v-for="cat in store.categories" :key="cat.key" class="flex items-center gap-3">
        <span class="w-6 text-center">{{ cat.icon || '🏷️' }}</span>
        <span class="w-28 shrink-0 truncate text-sm text-ink">{{ cat.name }}</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="color in PRESET_COLORS"
            :key="color"
            class="h-5 w-5 rounded-full ring-offset-2 ring-offset-surface transition hover:scale-110"
            :class="cat.color === color ? 'ring-2 ring-ink' : ''"
            :style="{ backgroundColor: color }"
            :disabled="saving === cat.key"
            :aria-label="`設定 ${cat.name} 為此色`"
            @click="pick(cat.key, color)"
          />
        </div>
      </div>
    </div>
  </BaseModal>
</template>
