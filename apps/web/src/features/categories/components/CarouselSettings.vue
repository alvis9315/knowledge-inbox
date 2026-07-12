<script setup lang="ts">
import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import BaseModal from '@/components/common/BaseModal.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
// Category keys hidden from the home carousels.
const hidden = useLocalStorage<string[]>('ki-carousel-hidden', [])

const byDomain = computed(() => store.byDomain)
const isVisible = (key: string) => !hidden.value.includes(key)

function setVisible(key: string, visible: boolean) {
  const set = new Set(hidden.value)
  visible ? set.delete(key) : set.add(key)
  hidden.value = [...set]
}
function setDomainVisible(domain: string, visible: boolean) {
  const set = new Set(hidden.value)
  for (const c of byDomain.value[domain] ?? []) (visible ? set.delete(c.key) : set.add(c.key))
  hidden.value = [...set]
}
function domainAllVisible(domain: string) {
  return (byDomain.value[domain] ?? []).every((c) => isVisible(c.key))
}
</script>

<template>
  <BaseModal :open="props.open" title="首頁輪播顯示的分類" size="lg" @close="emit('close')">
    <p class="mb-4 text-sm text-muted">勾選要顯示在首頁輪播的分類;取消勾選即隱藏(資料不受影響)。點大類別可整批開關。</p>
    <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto thin-scroll">
      <div v-for="d in store.domains" :key="d">
        <label class="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            class="rounded border-line text-accent focus:ring-accent"
            :checked="domainAllVisible(d)"
            @change="setDomainVisible(d, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ domainIcon(d) }}</span> {{ d }}
        </label>
        <div class="ml-6 grid grid-cols-2 gap-1 sm:grid-cols-3">
          <label
            v-for="c in byDomain[d]"
            :key="c.key"
            class="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-muted"
          >
            <input
              type="checkbox"
              class="rounded border-line text-accent focus:ring-accent"
              :checked="isVisible(c.key)"
              @change="setVisible(c.key, ($event.target as HTMLInputElement).checked)"
            />
            <span class="truncate">{{ c.icon }} {{ c.name }}</span>
          </label>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
