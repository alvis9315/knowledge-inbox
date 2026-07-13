<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import LoadingState from '@/components/common/LoadingState.vue'
import CategoryCard from '@/features/categories/components/CategoryCard.vue'
import { domainIcon } from '@/features/categories/domainIcons'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import type { CategoryMeta } from '@/features/categories/api/categoriesApi'

const props = defineProps<{ domain: string }>()
const store = useCategoriesStore()

// Local mirror for drag reorder (VueDraggable needs a writable array).
const items = ref<CategoryMeta[]>([])
watch(
  () => [store.categories, props.domain] as const,
  () => {
    items.value = store.categories.filter((c) => c.domain === props.domain)
  },
  { immediate: true, deep: true },
)

/** Persist: rebuild the full ordered key list with this domain's new order. */
function persistOrder() {
  const ordered = store.domains.flatMap((d) =>
    d === props.domain ? items.value.map((c) => c.key) : (store.byDomain[d] ?? []).map((c) => c.key),
  )
  store.reorder(ordered)
}
</script>

<template>
  <section class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <span class="text-2xl">{{ domainIcon(domain) }}</span>
      <div>
        <h1 class="text-xl font-semibold text-ink">{{ domain }}</h1>
        <p class="text-sm text-muted">{{ items.length }} 個子類別 · 可直接拖曳排序</p>
      </div>
    </div>

    <LoadingState
      :loading="store.loading && store.categories.length === 0"
      :error="store.error"
      :empty="!store.loading && items.length === 0"
      empty-text="這個大類別還沒有子類別。"
    >
      <!-- Whole-card drag reorder; order syncs the sidebar + home carousels. -->
      <VueDraggable
        v-model="items"
        :animation="150"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        @update="persistOrder"
      >
        <div v-for="cat in items" :key="cat.key" class="cursor-grab active:cursor-grabbing">
          <CategoryCard :category="cat" />
        </div>
      </VueDraggable>
    </LoadingState>
  </section>
</template>
