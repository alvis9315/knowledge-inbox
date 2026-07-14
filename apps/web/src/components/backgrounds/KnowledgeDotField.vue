<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import DotFieldControls from './DotFieldControls.vue'

// React Bits "DotField" ported to Vue 3(純 canvas 2D,零依賴:
// 點陣網格 + 游標鼓起(bulge)+ 波浪漂移 + 游標速度驅動的能量感)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface DotFieldConfig {
  dotRadius: number
  dotSpacing: number
  bulgeStrength: number
  waveAmplitude: number
  sparkle: boolean
  enableMouseInteraction: boolean
  gradientFrom: string
  gradientTo: string
}

interface Props {
  dotRadius?: number
  dotSpacing?: number
  cursorRadius?: number
  bulgeStrength?: number
  waveAmplitude?: number
  sparkle?: boolean
  enableMouseInteraction?: boolean
  gradientFrom?: string
  gradientTo?: string
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  dotRadius: 1.5,
  dotSpacing: 14,
  cursorRadius: 400,
  bulgeStrength: 67,
  waveAmplitude: 2,
  sparkle: false,
  enableMouseInteraction: false,
  gradientFrom: '#7c9cff',
  gradientTo: '#a78bfa',
  showControls: false,
  class: '',
})

const cfg = reactive<DotFieldConfig>({
  dotRadius: props.dotRadius,
  dotSpacing: props.dotSpacing,
  bulgeStrength: props.bulgeStrength,
  waveAmplitude: props.waveAmplitude,
  sparkle: props.sparkle,
  enableMouseInteraction: props.enableMouseInteraction,
  gradientFrom: props.gradientFrom,
  gradientTo: props.gradientTo,
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

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = window.matchMedia('(pointer: coarse)').matches

const TWO_PI = Math.PI * 2

interface Dot {
  ax: number
  ay: number
  sx: number
  sy: number
}

let ctx: CanvasRenderingContext2D | null = null
let dots: Dot[] = []
let size = { w: 0, h: 0, left: 0, top: 0 }
const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 }
let engagement = 0
let frameCount = 0
let raf = 0
let speedTimer = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true

// hex → rgba(點陣用半透明漸層,固定 alpha 貼近原版質感)
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

const buildDots = () => {
  const step = cfg.dotRadius + cfg.dotSpacing
  const cols = Math.floor(size.w / step)
  const rows = Math.floor(size.h / step)
  const padX = (size.w % step) / 2
  const padY = (size.h % step) / 2
  dots = new Array(rows * cols)
  let idx = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ax = padX + col * step + step / 2
      const ay = padY + row * step + step / 2
      dots[idx++] = { ax, ay, sx: ax, sy: ay }
    }
  }
}
watch(() => [cfg.dotRadius, cfg.dotSpacing], () => {
  buildDots()
  if (reduceMotion) renderFrame()
})

const doResize = () => {
  const c = containerRef.value
  const cv = canvasRef.value
  if (!c || !cv || !ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = c.getBoundingClientRect()
  cv.width = rect.width * dpr
  cv.height = rect.height * dpr
  cv.style.width = `${rect.width}px`
  cv.style.height = `${rect.height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  size = { w: rect.width, h: rect.height, left: rect.left, top: rect.top }
  buildDots()
  if (reduceMotion) renderFrame()
}

const onMouseMove = (e: MouseEvent) => {
  mouse.x = e.clientX - size.left
  mouse.y = e.clientY - size.top
}

const updateMouseSpeed = () => {
  const dx = mouse.prevX - mouse.x
  const dy = mouse.prevY - mouse.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  mouse.speed += (dist - mouse.speed) * 0.5
  if (mouse.speed < 0.001) mouse.speed = 0
  mouse.prevX = mouse.x
  mouse.prevY = mouse.y
}

const renderFrame = () => {
  if (!ctx) return
  frameCount++
  const t = frameCount * 0.02
  const mouseOn = cfg.enableMouseInteraction && !coarsePointer

  const targetEngagement = mouseOn ? Math.min(mouse.speed / 5, 1) : 0
  engagement += (targetEngagement - engagement) * 0.06
  if (engagement < 0.001) engagement = 0

  ctx.clearRect(0, 0, size.w, size.h)
  const grad = ctx.createLinearGradient(0, 0, size.w, size.h)
  grad.addColorStop(0, rgba(cfg.gradientFrom, 0.35))
  grad.addColorStop(1, rgba(cfg.gradientTo, 0.25))
  ctx.fillStyle = grad

  const cr = props.cursorRadius
  const crSq = cr * cr
  const rad = cfg.dotRadius / 2

  ctx.beginPath()
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]
    const dx = mouse.x - d.ax
    const dy = mouse.y - d.ay
    const distSq = dx * dx + dy * dy

    if (distSq < crSq && engagement > 0.01) {
      const dist = Math.sqrt(distSq)
      const k = 1 - dist / cr
      const push = k * k * cfg.bulgeStrength * engagement
      const angle = Math.atan2(dy, dx)
      d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15
      d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15
    } else {
      d.sx += (d.ax - d.sx) * 0.1
      d.sy += (d.ay - d.sy) * 0.1
    }

    let drawX = d.sx
    let drawY = d.sy
    if (cfg.waveAmplitude > 0) {
      drawY += Math.sin(d.ax * 0.03 + t) * cfg.waveAmplitude
      drawX += Math.cos(d.ay * 0.03 + t * 0.7) * cfg.waveAmplitude * 0.5
    }

    if (cfg.sparkle) {
      const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0
      const r = (hash % 100) < 3 ? rad * 1.8 : rad
      ctx.moveTo(drawX + r, drawY)
      ctx.arc(drawX, drawY, r, 0, TWO_PI)
    } else {
      ctx.moveTo(drawX + rad, drawY)
      ctx.arc(drawX, drawY, rad, 0, TWO_PI)
    }
  }
  ctx.fill()
}

const loop = () => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  renderFrame()
}

onMounted(() => {
  const cv = canvasRef.value
  if (!cv) return
  ctx = cv.getContext('2d', { alpha: true })
  doResize()
  ro = new ResizeObserver(doResize)
  if (containerRef.value) ro.observe(containerRef.value)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  if (containerRef.value) io.observe(containerRef.value)
  if (!coarsePointer) window.addEventListener('mousemove', onMouseMove, { passive: true })
  speedTimer = window.setInterval(updateMouseSpeed, 20)

  if (reduceMotion) renderFrame()
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(speedTimer)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  ctx = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-dotfield" :class="props.class" aria-hidden="true">
    <canvas ref="canvasRef" class="block h-full w-full" />
    <DotFieldControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-dotfield {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: linear-gradient(170deg, #0a0d18 0%, #0d1020 60%, #090b14 100%);
}
</style>
