<script setup lang="ts">
import { computed } from 'vue'
import LoadingState from '@/components/common/LoadingState.vue'
import CategoryCard from '@/features/categories/components/CategoryCard.vue'
import { domainIcon } from '@/features/categories/domainIcons'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

const props = defineProps<{ domain: string }>()
const store = useCategoriesStore()

const items = computed(() => store.categories.filter((c) => c.domain === props.domain))
</script>

<template>
  <section class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <span class="text-2xl">{{ domainIcon(domain) }}</span>
      <div>
        <h1 class="text-xl font-semibold text-ink">{{ domain }}</h1>
        <p class="text-sm text-muted">{{ items.length }} 個子類別</p>
      </div>
    </div>

    <LoadingState
      :loading="store.loading && store.categories.length === 0"
      :error="store.error"
      :empty="!store.loading && items.length === 0"
      empty-text="這個大類別還沒有子類別。"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CategoryCard v-for="cat in items" :key="cat.key" :category="cat" />
      </div>
    </LoadingState>
  </section>
</template>
