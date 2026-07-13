<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import emblaCarouselVue from 'embla-carousel-vue'
import AutoScroll from 'embla-carousel-auto-scroll'
import { useMediaQuery } from '@vueuse/core'

// Generic auto-scrolling card carousel. The parent supplies items (each needs a
// stable `key`) and renders each via the default slot, so the carousel stays
// card-agnostic (domain cards, category cards, …).
interface CarouselItem {
  key: string
}
const props = defineProps<{
  items: CarouselItem[]
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
    stopOnMouseEnter: true, // 滑鼠停在該排 → 該排暫停
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
  <!-- Full-height fill via flex (NOT percentage height, which doesn't resolve
       through Embla's viewport): the viewport is a flex column, the slide
       container flex-1 grows to fill it, and items-stretch makes every slide
       (and its card) equal-height.
       Spacing lives INSIDE each slide as padding, NOT margin: Embla measures
       slides by their border box (padding included, margin excluded), so a
       margin gap goes uncounted at the loop seam and shows an uneven gap there.
       Padding keeps every gap — including the wrap seam — identical. -->
  <div ref="emblaRef" class="flex min-h-0 flex-col overflow-hidden py-1">
    <div class="flex min-h-0 flex-1 items-stretch" style="touch-action: pan-y">
      <div v-for="(item, i) in displayItems" :key="`${item.key}-${i}`" class="w-64 shrink-0 pl-4 sm:w-72 sm:pl-6">
        <slot :item="item" />
      </div>
    </div>
  </div>
</template>
