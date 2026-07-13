<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import BaseModal from '@/components/common/BaseModal.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
// Domains hidden from the home carousels.
const hidden = useLocalStorage<string[]>('ki-carousel-hidden-domains', [])
const isVisible = (d: string) => !hidden.value.includes(d)

const setVisible = (d: string, visible: boolean) => {
  const set = new Set(hidden.value)
  visible ? set.delete(d) : set.add(d)
  hidden.value = [...set]
}
</script>

<template>
  <BaseModal :open="props.open" title="首頁顯示的大分類" size="md" @close="emit('close')">
    <p class="mb-1.5 text-sm font-medium text-ink">勾選要顯示在首頁的大分類。</p>
    <ul class="mb-3 space-y-0.5 text-xs text-muted">
      <li>· 取消勾選只是不顯示,資料不受影響</li>
    </ul>
    <div class="flex flex-col gap-1">
      <label
        v-for="d in store.domains"
        :key="d"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas"
      >
        <input
          type="checkbox"
          class="rounded border-line text-accent focus:ring-accent"
          :checked="isVisible(d)"
          @change="setVisible(d, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ domainIcon(d) }}</span> {{ d }}
      </label>
    </div>
  </BaseModal>
</template>
