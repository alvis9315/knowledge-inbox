<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import emblaCarouselVue from 'embla-carousel-vue'
import AutoScroll from 'embla-carousel-auto-scroll'
import { useMediaQuery } from '@vueuse/core'
import CategoryCard from './CategoryCard.vue'
import type { CategoryMeta } from '@/features/categories/api/categoriesApi'

const props = defineProps<{
  items: CategoryMeta[]
  direction: 'forward' | 'backward'
  playing: boolean
}>()

const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

// Embla loop needs enough slides to feel continuous — repeat when few.
const displayItems = computed(() => {
  const src = props.items
  if (src.length === 0) return []
  const copies = src.length >= 6 ? 1 : Math.ceil(6 / src.length)
  return Array.from({ length: copies }, () => src).flat()
})

const [emblaRef, emblaApi] = emblaCarouselVue({ loop: true, dragFree: true, align: 'start' }, [
  AutoScroll({
    playOnInit: false,
    speed: 1.2,
    direction: props.direction,
    stopOnInteraction: false,
    stopOnMouseEnter: false,
  }),
])

function sync() {
  const api = emblaApi.value
  if (!api) return
  const auto = api.plugins().autoScroll
  if (!auto) return
  if (props.playing && !reduceMotion.value) auto.play()
  else auto.stop()
}

onMounted(sync)
watch(() => [props.playing, reduceMotion.value, displayItems.value.length], sync)
</script>

<template>
  <!-- Spacing via per-slide margin, NOT `gap`: Embla's loop transforms don't
       honor CSS gap at the wrap seam, which glues two cards together. -->
  <div ref="emblaRef" class="overflow-hidden py-1">
    <div class="flex h-full items-stretch pl-4 sm:pl-6" style="touch-action: pan-y">
      <div v-for="(cat, i) in displayItems" :key="`${cat.key}-${i}`" class="mr-4 w-64 shrink-0 sm:w-72">
        <CategoryCard :category="cat" />
      </div>
    </div>
  </div>
</template>
