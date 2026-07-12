<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pause, Play, Eye } from 'lucide-vue-next'
import { useLocalStorage } from '@vueuse/core'
import LoadingState from '@/components/common/LoadingState.vue'
import CategoryCarousel from '@/features/categories/components/CategoryCarousel.vue'
import CarouselSettings from '@/features/categories/components/CarouselSettings.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

const store = useCategoriesStore()
const playing = ref(true)
const settingsOpen = ref(false)

// Categories hidden from the carousels (editable via the eye button).
const hidden = useLocalStorage<string[]>('ki-carousel-hidden', [])
const visible = computed(() => store.categories.filter((c) => !hidden.value.includes(c.key)))

const topRow = computed(() => visible.value.slice(0, Math.ceil(visible.value.length / 2)))
const bottomRow = computed(() => {
  const rest = visible.value.slice(Math.ceil(visible.value.length / 2))
  return rest.length ? rest : visible.value
})
</script>

<template>
  <section class="flex min-h-full flex-col gap-4">
    <div class="flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink">分類總覽</h1>
        <p class="text-sm text-muted">{{ visible.length }} / {{ store.categories.length }} 個分類 · 點卡片進入項目列表</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink"
          title="選擇顯示的分類"
          @click="settingsOpen = true"
        >
          <Eye :size="15" /> 顯示
        </button>
        <button
          class="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink"
          :aria-label="playing ? '暫停輪播' : '播放輪播'"
          @click="playing = !playing"
        >
          <component :is="playing ? Pause : Play" :size="15" />
          {{ playing ? '暫停' : '播放' }}
        </button>
      </div>
    </div>

    <LoadingState
      :loading="store.loading && store.categories.length === 0"
      :error="store.error"
      :empty="!store.loading && !store.error && visible.length === 0"
      empty-text="沒有要顯示的分類。點右上「顯示」勾選,或用左側「＋」新增。"
    >
      <!-- Full-bleed: cancel the main padding so carousels span the whole width.
           flex-1 rows split the leftover height so cards fill the viewport. -->
      <div class="-mx-4 flex min-h-0 flex-1 flex-col gap-4 sm:-mx-6">
        <CategoryCarousel class="min-h-0 flex-1" :items="topRow" direction="forward" :playing="playing" />
        <CategoryCarousel class="min-h-0 flex-1" :items="bottomRow" direction="backward" :playing="playing" />
      </div>
    </LoadingState>

    <CarouselSettings :open="settingsOpen" @close="settingsOpen = false" />
  </section>
</template>
