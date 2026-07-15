<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import DotGridControls from './DotGridControls.vue'

gsap.registerPlugin(InertiaPlugin)

// React Bits "DotGrid" ported verbatim to Vue 3(gsap InertiaPlugin:
// 圓點網格,快速滑過拋射慣性彈開、點擊震波,elastic 回彈)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface DotGridConfig {
  dotSize: number
  gap: number
  baseColor: string
  activeColor: string
  proximity: number
  shockStrength: number
  enableMouseInteraction: boolean
}

interface Props {
  dotSize?: number
  gap?: number
  baseColor?: string
  activeColor?: string
  proximity?: number
  speedTrigger?: number
  shockRadius?: number
  shockStrength?: number
  maxSpeed?: number
  resistance?: number
  returnDuration?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  dotSize: 10,
  gap: 28,
  baseColor: '#2b3560',
  activeColor: '#8aa5ff',
  proximity: 150,
  speedTrigger: 100,
  shockRadius: 250,
  shockStrength: 5,
  maxSpeed: 5000,
  resistance: 750,
  returnDuration: 1.5,
  // 這顆的魅力全在互動,預設開(靜態時就是乾淨點陣)
  enableMouseInteraction: true,
  showControls: false,
  class: '',
})

const cfg = reactive<DotGridConfig>({
  dotSize: props.dotSize,
  gap: props.gap,
  baseColor: props.baseColor,
  activeColor: props.activeColor,
  proximity: props.proximity,
  shockStrength: props.shockStrength,
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

const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = window.matchMedia('(pointer: coarse)').matches

interface Dot {
  cx: number
  cy: number
  xOffset: number
  yOffset: number
  _inertiaApplied: boolean
}

let dots: Dot[] = []
const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, lastTime: 0, lastX: 0, lastY: 0 }
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let circlePath: Path2D | null = null

const hexToRgb = (hex: string) => {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!m) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

const rebuildPath = () => {
  circlePath = new Path2D()
  circlePath.arc(0, 0, cfg.dotSize / 2, 0, Math.PI * 2)
}

const buildGrid = () => {
  const wrap = wrapperRef.value
  const canvas = canvasRef.value
  if (!wrap || !canvas) return
  const { width, height } = wrap.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const cell = cfg.dotSize + cfg.gap
  const cols = Math.floor((width + cfg.gap) / cell)
  const rows = Math.floor((height + cfg.gap) / cell)
  const startX = (width - (cell * cols - cfg.gap)) / 2 + cfg.dotSize / 2
  const startY = (height - (cell * rows - cfg.gap)) / 2 + cfg.dotSize / 2
  dots = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      dots.push({ cx: startX + x * cell, cy: startY + y * cell, xOffset: 0, yOffset: 0, _inertiaApplied: false })
    }
  }
  rebuildPath()
}
watch(() => [cfg.dotSize, cfg.gap], () => {
  buildGrid()
  if (reduceMotion) draw()
})

const draw = () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || !circlePath) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const baseRgb = hexToRgb(cfg.baseColor)
  const activeRgb = hexToRgb(cfg.activeColor)
  const proxSq = cfg.proximity * cfg.proximity
  const { x: px, y: py } = pointer
  for (const dot of dots) {
    const dx = dot.cx - px
    const dy = dot.cy - py
    const dsq = dx * dx + dy * dy
    let style = cfg.baseColor
    if (dsq <= proxSq && cfg.enableMouseInteraction) {
      const t = 1 - Math.sqrt(dsq) / cfg.proximity
      const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t)
      const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t)
      const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t)
      style = `rgb(${r},${g},${b})`
    }
    ctx.save()
    ctx.translate(dot.cx + dot.xOffset, dot.cy + dot.yOffset)
    ctx.fillStyle = style
    ctx.fill(circlePath)
    ctx.restore()
  }
}

const loop = () => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  draw()
}

// throttle 50ms(原版同款)
let lastCall = 0
const onMove = (e: MouseEvent) => {
  if (!cfg.enableMouseInteraction) return
  const now = performance.now()
  if (now - lastCall < 50) return
  lastCall = now

  const pr = pointer
  const dt = pr.lastTime ? now - pr.lastTime : 16
  let vx = ((e.clientX - pr.lastX) / dt) * 1000
  let vy = ((e.clientY - pr.lastY) / dt) * 1000
  let speed = Math.hypot(vx, vy)
  if (speed > props.maxSpeed) {
    const scale = props.maxSpeed / speed
    vx *= scale
    vy *= scale
    speed = props.maxSpeed
  }
  pr.lastTime = now
  pr.lastX = e.clientX
  pr.lastY = e.clientY

  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  pr.x = e.clientX - rect.left
  pr.y = e.clientY - rect.top

  for (const dot of dots) {
    const dist = Math.hypot(dot.cx - pr.x, dot.cy - pr.y)
    if (speed > props.speedTrigger && dist < cfg.proximity && !dot._inertiaApplied) {
      dot._inertiaApplied = true
      gsap.killTweensOf(dot)
      gsap.to(dot, {
        inertia: { xOffset: dot.cx - pr.x + vx * 0.005, yOffset: dot.cy - pr.y + vy * 0.005, resistance: props.resistance },
        onComplete: () => {
          gsap.to(dot, { xOffset: 0, yOffset: 0, duration: props.returnDuration, ease: 'elastic.out(1,0.75)' })
          dot._inertiaApplied = false
        },
      })
    }
  }
}

const onClick = (e: MouseEvent) => {
  if (!cfg.enableMouseInteraction) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  for (const dot of dots) {
    const dist = Math.hypot(dot.cx - cx, dot.cy - cy)
    if (dist < props.shockRadius && !dot._inertiaApplied) {
      dot._inertiaApplied = true
      gsap.killTweensOf(dot)
      const falloff = Math.max(0, 1 - dist / props.shockRadius)
      gsap.to(dot, {
        inertia: {
          xOffset: (dot.cx - cx) * cfg.shockStrength * falloff,
          yOffset: (dot.cy - cy) * cfg.shockStrength * falloff,
          resistance: props.resistance,
        },
        onComplete: () => {
          gsap.to(dot, { xOffset: 0, yOffset: 0, duration: props.returnDuration, ease: 'elastic.out(1,0.75)' })
          dot._inertiaApplied = false
        },
      })
    }
  }
}

onMounted(() => {
  buildGrid()
  ro = new ResizeObserver(buildGrid)
  if (wrapperRef.value) ro.observe(wrapperRef.value)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  if (wrapperRef.value) io.observe(wrapperRef.value)
  if (!coarsePointer) {
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('click', onClick)
  }
  if (reduceMotion) draw()
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('click', onClick)
  for (const dot of dots) gsap.killTweensOf(dot)
})
</script>

<template>
  <div ref="wrapperRef" class="knowledge-dotgrid" :class="props.class" aria-hidden="true">
    <canvas ref="canvasRef" class="block h-full w-full" />
    <DotGridControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-dotgrid {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0a0d18;
}
</style>
