<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { gsap } from 'gsap'
import GridMotionControls from './GridMotionControls.vue'

// React Bits "GridMotion" ported verbatim to Vue 3(gsap:
// 4×7 斜排卡片牆,滑鼠 X 驅動逐排慣性平移)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface GridMotionConfig {
  gradientColor: string
  cardColor: string
  maxMove: number
  enableMouseInteraction: boolean
}

interface Props {
  items?: string[]
  gradientColor?: string
  cardColor?: string
  maxMove?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  gradientColor: '#1b2440',
  cardColor: '#10142a',
  maxMove: 300,
  // 這顆的動態全靠滑鼠,預設開(無滑鼠時為靜態斜牆,也成立)
  enableMouseInteraction: true,
  showControls: false,
  class: '',
})

const cfg = reactive<GridMotionConfig>({
  gradientColor: props.gradientColor,
  cardColor: props.cardColor,
  maxMove: props.maxMove,
  enableMouseInteraction: props.enableMouseInteraction,
})

const emitCtl = defineEmits<{ controlsDone: [cfg: Record<string, unknown>]; controlsCancel: [] }>()
// 開面板時快照,取消=還原。
let cfgSnapshot: Record<string, unknown> | null = null
watch(() => props.showControls, (o) => {
  if (o) cfgSnapshot = JSON.parse(JSON.stringify(cfg))
}, { immediate: true })
const ctlDone = () => {
  emitCtl('controlsDone', JSON.parse(JSON.stringify(cfg)))
}
const ctlCancel = () => {
  if (cfgSnapshot) Object.assign(cfg, cfgSnapshot)
  emitCtl('controlsCancel')
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = window.matchMedia('(pointer: coarse)').matches

const TOTAL = 28
const contents = (): string[] => {
  if (props.items.length > 0) return props.items.slice(0, TOTAL)
  return Array.from({ length: TOTAL }, (_, i) => `Item ${i + 1}`)
}

const rowRefs = ref<HTMLElement[]>([])
let mouseX = window.innerWidth / 2
let removeTicker: (() => void) | null = null

const onMouseMove = (e: MouseEvent) => {
  mouseX = e.clientX
}

const updateMotion = () => {
  if (!cfg.enableMouseInteraction || coarsePointer || reduceMotion) return
  const baseDuration = 0.8
  const inertiaFactors = [0.6, 0.4, 0.3, 0.2]
  rowRefs.value.forEach((row, index) => {
    if (!row) return
    const direction = index % 2 === 0 ? 1 : -1
    const moveAmount = ((mouseX / window.innerWidth) * cfg.maxMove - cfg.maxMove / 2) * direction
    gsap.to(row, {
      x: moveAmount,
      duration: baseDuration + inertiaFactors[index % inertiaFactors.length],
      ease: 'power3.out',
      overwrite: 'auto',
    })
  })
}

onMounted(() => {
  gsap.ticker.lagSmoothing(0)
  removeTicker = gsap.ticker.add(updateMotion) as unknown as () => void
  window.addEventListener('mousemove', onMouseMove)
})

onBeforeUnmount(() => {
  if (typeof removeTicker === 'function') removeTicker()
  else gsap.ticker.remove(updateMotion)
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<template>
  <div class="knowledge-gridmotion" :class="props.class" aria-hidden="true">
    <section
      class="gm-intro"
      :style="{ background: `radial-gradient(circle, ${cfg.gradientColor} 0%, transparent 100%)` }"
    >
      <div class="gm-grid">
        <div
          v-for="rowIndex in 4"
          :key="rowIndex"
          :ref="(el) => { if (el) rowRefs[rowIndex - 1] = el as HTMLElement }"
          class="gm-row"
        >
          <div v-for="itemIndex in 7" :key="itemIndex" class="gm-item">
            <div class="gm-item-inner" :style="{ backgroundColor: cfg.cardColor }">
              <div
                v-if="contents()[(rowIndex - 1) * 7 + (itemIndex - 1)]?.startsWith('http')"
                class="gm-item-img"
                :style="{ backgroundImage: `url(${contents()[(rowIndex - 1) * 7 + (itemIndex - 1)]})` }"
              />
              <div v-else class="gm-item-content">
                {{ contents()[(rowIndex - 1) * 7 + (itemIndex - 1)] }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <GridMotionControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-gridmotion {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #070a14;
}
.gm-intro {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gm-grid {
  gap: 1rem;
  flex: none;
  position: relative;
  width: 150vw;
  height: 150vh;
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  grid-template-columns: 100%;
  transform: rotate(-15deg);
  transform-origin: center center;
}
.gm-row {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(7, 1fr);
  will-change: transform;
}
.gm-item {
  position: relative;
}
.gm-item-inner {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 1.1rem;
}
.gm-item-img {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: 50% 50%;
  position: absolute;
  inset: 0;
}
.gm-item-content {
  padding: 1rem;
  text-align: center;
}
</style>
