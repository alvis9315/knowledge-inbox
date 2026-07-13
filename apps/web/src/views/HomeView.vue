<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pause, Play, Eye } from 'lucide-vue-next'
import { useLocalStorage } from '@vueuse/core'
import LoadingState from '@/components/common/LoadingState.vue'
import CardCarousel from '@/features/categories/components/CardCarousel.vue'
import DomainCard from '@/features/categories/components/DomainCard.vue'
import CarouselSettings from '@/features/categories/components/CarouselSettings.vue'
import BgControlsButton from '@/features/theme/BgControlsButton.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'

// 分類總覽 = 破題首頁:告訴使用者有哪幾個大類別可看(不是列 63 個子分類)。
interface DomainCardMeta {
  key: string
  domain: string
  icon: string
  count: number
  subCount: number
  subNames: string[]
}

const store = useCategoriesStore()
const playing = ref(true)
const settingsOpen = ref(false)

// Domains hidden from the home carousels (editable via the eye button).
const hidden = useLocalStorage<string[]>('ki-carousel-hidden-domains', [])

const cards = computed<DomainCardMeta[]>(() =>
  store.domains
    .filter((d) => !hidden.value.includes(d))
    .map((d) => {
      const subs = store.byDomain[d] ?? []
      return {
        key: d,
        domain: d,
        icon: domainIcon(d),
        count: subs.reduce((n, c) => n + c.count, 0),
        subCount: subs.length,
        subNames: subs.slice(0, 5).map((c) => c.name),
      }
    }),
)

const topRow = computed(() => cards.value.slice(0, Math.ceil(cards.value.length / 2)))
const bottomRow = computed(() => {
  const rest = cards.value.slice(Math.ceil(cards.value.length / 2))
  return rest.length ? rest : cards.value
})
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink">首頁導覽</h1>
        <p class="text-sm text-muted">
          {{ cards.length }} / {{ store.domains.length }} 個大分類 · 點卡片查看該類別
        </p>
      </div>
      <div class="flex items-center gap-2">
        <BgControlsButton />
        <button
          class="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink"
          title="選擇顯示的大分類"
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
      :empty="!store.loading && !store.error && cards.length === 0"
      empty-text="沒有要顯示的大分類。點右上「顯示」勾選。"
    >
      <!-- Full-bleed: cancel the main padding so carousels span the whole width.
           flex-1 rows split the leftover height so cards fill the viewport. -->
      <div class="-mx-4 flex min-h-0 flex-1 flex-col gap-4 sm:-mx-6">
        <CardCarousel
          v-slot="{ item }"
          class="min-h-0 flex-1"
          :items="topRow"
          direction="forward"
          :playing="playing"
        >
          <DomainCard :card="(item as DomainCardMeta)" />
        </CardCarousel>
        <CardCarousel
          v-slot="{ item }"
          class="min-h-0 flex-1"
          :items="bottomRow"
          direction="backward"
          :playing="playing"
        >
          <DomainCard :card="(item as DomainCardMeta)" />
        </CardCarousel>
      </div>
    </LoadingState>

    <CarouselSettings :open="settingsOpen" @close="settingsOpen = false" />
  </section>
</template>
