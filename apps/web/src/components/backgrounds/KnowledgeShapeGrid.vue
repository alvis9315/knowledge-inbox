<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ShapeGridControls from './ShapeGridControls.vue'

// React Bits "ShapeGrid" ported to Vue 3(純 canvas 2D,零依賴:
// 匀速平移的幾何格線,方形/圓形/六角/三角四種形狀,游標亮格)。
// 簡化說明:hover 亮格僅支援 square/circle(格點對齊數學單純);
// hex/tri 的 hover 命中原版數學較長,對 app 背景(互動預設關)價值低,略。
export type GridShape = 'square' | 'circle' | 'hexagon' | 'triangle'
export type GridDirection = 'right' | 'left' | 'up' | 'down' | 'diagonal'

export interface ShapeGridConfig {
  shape: GridShape
  direction: GridDirection
  speed: number
  squareSize: number
  borderColor: string
  hoverFillColor: string
  enableMouseInteraction: boolean
}

interface Props {
  shape?: GridShape
  direction?: GridDirection
  speed?: number
  squareSize?: number
  borderColor?: string
  hoverFillColor?: string
  vignetteColor?: string
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  shape: 'square',
  direction: 'diagonal',
  speed: 0.5,
  squareSize: 40,
  borderColor: '#26314f',
  hoverFillColor: '#1b2440',
  vignetteColor: '#070a14',
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<ShapeGridConfig>({
  shape: props.shape,
  direction: props.direction,
  speed: props.speed,
  squareSize: props.squareSize,
  borderColor: props.borderColor,
  hoverFillColor: props.hoverFillColor,
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

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = window.matchMedia('(pointer: coarse)').matches

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
const gridOffset = { x: 0, y: 0 }
let hovered: { x: number; y: number } | null = null
const cellOpacities = new Map<string, number>()

const resizeCanvas = () => {
  const cv = canvasRef.value
  if (!cv) return
  cv.width = cv.offsetWidth
  cv.height = cv.offsetHeight
  if (reduceMotion) frame(false)
}

const drawHex = (c: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
  c.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const vx = cx + size * Math.cos(angle)
    const vy = cy + size * Math.sin(angle)
    if (i === 0) c.moveTo(vx, vy)
    else c.lineTo(vx, vy)
  }
  c.closePath()
}

const drawGrid = () => {
  const cv = canvasRef.value
  if (!cv || !ctx) return
  const c = ctx
  const size = cfg.squareSize
  c.clearRect(0, 0, cv.width, cv.height)

  const cellFill = (key: string, draw: () => void) => {
    const alpha = cellOpacities.get(key)
    if (alpha) {
      c.globalAlpha = alpha
      draw()
      c.fillStyle = cfg.hoverFillColor
      c.fill()
      c.globalAlpha = 1
    }
  }

  if (cfg.shape === 'hexagon') {
    const hexHoriz = size * 1.5
    const hexVert = size * Math.sqrt(3)
    const colShift = Math.floor(gridOffset.x / hexHoriz)
    const offsetX = ((gridOffset.x % hexHoriz) + hexHoriz) % hexHoriz
    const offsetY = ((gridOffset.y % hexVert) + hexVert) % hexVert
    const cols = Math.ceil(cv.width / hexHoriz) + 3
    const rows = Math.ceil(cv.height / hexVert) + 3
    for (let col = -2; col < cols; col++) {
      for (let row = -2; row < rows; row++) {
        const cx = col * hexHoriz + offsetX
        const cy = row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + offsetY
        drawHex(c, cx, cy, size)
        c.strokeStyle = cfg.borderColor
        c.stroke()
      }
    }
  } else if (cfg.shape === 'triangle') {
    const halfW = size / 2
    const colShift = Math.floor(gridOffset.x / halfW)
    const rowShift = Math.floor(gridOffset.y / size)
    const offsetX = ((gridOffset.x % halfW) + halfW) % halfW
    const offsetY = ((gridOffset.y % size) + size) % size
    const cols = Math.ceil(cv.width / halfW) + 4
    const rows = Math.ceil(cv.height / size) + 4
    for (let col = -2; col < cols; col++) {
      for (let row = -2; row < rows; row++) {
        const cx = col * halfW + offsetX
        const cy = row * size + size / 2 + offsetY
        const flip = ((((col + colShift + row + rowShift) % 2) + 2) % 2) !== 0
        c.beginPath()
        if (flip) {
          c.moveTo(cx, cy + size / 2)
          c.lineTo(cx + size / 2, cy - size / 2)
          c.lineTo(cx - size / 2, cy - size / 2)
        } else {
          c.moveTo(cx, cy - size / 2)
          c.lineTo(cx + size / 2, cy + size / 2)
          c.lineTo(cx - size / 2, cy + size / 2)
        }
        c.closePath()
        c.strokeStyle = cfg.borderColor
        c.stroke()
      }
    }
  } else {
    const offsetX = ((gridOffset.x % size) + size) % size
    const offsetY = ((gridOffset.y % size) + size) % size
    const cols = Math.ceil(cv.width / size) + 3
    const rows = Math.ceil(cv.height / size) + 3
    for (let col = -2; col < cols; col++) {
      for (let row = -2; row < rows; row++) {
        const key = `${col},${row}`
        if (cfg.shape === 'circle') {
          const cx = col * size + size / 2 + offsetX
          const cy = row * size + size / 2 + offsetY
          cellFill(key, () => {
            c.beginPath()
            c.arc(cx, cy, size / 2, 0, Math.PI * 2)
            c.closePath()
          })
          c.beginPath()
          c.arc(cx, cy, size / 2, 0, Math.PI * 2)
          c.closePath()
          c.strokeStyle = cfg.borderColor
          c.stroke()
        } else {
          const sx = col * size + offsetX
          const sy = row * size + offsetY
          const alpha = cellOpacities.get(key)
          if (alpha) {
            c.globalAlpha = alpha
            c.fillStyle = cfg.hoverFillColor
            c.fillRect(sx, sy, size, size)
            c.globalAlpha = 1
          }
          c.strokeStyle = cfg.borderColor
          c.strokeRect(sx, sy, size, size)
        }
      }
    }
  }

  // 中央亮、四周沉的暗角(原版單 stop 漸層形同 no-op,這裡補第二個 stop)
  const gradient = c.createRadialGradient(
    cv.width / 2, cv.height / 2, 0,
    cv.width / 2, cv.height / 2,
    Math.sqrt(cv.width ** 2 + cv.height ** 2) / 2,
  )
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, props.vignetteColor)
  c.fillStyle = gradient
  c.fillRect(0, 0, cv.width, cv.height)
}

const updateCellOpacities = () => {
  const targets = new Map<string, number>()
  if (hovered && cfg.enableMouseInteraction && !coarsePointer) {
    targets.set(`${hovered.x},${hovered.y}`, 1)
  }
  for (const [key] of targets) {
    if (!cellOpacities.has(key)) cellOpacities.set(key, 0)
  }
  for (const [key, opacity] of cellOpacities) {
    const target = targets.get(key) ?? 0
    const next = opacity + (target - opacity) * 0.15
    if (next < 0.005) cellOpacities.delete(key)
    else cellOpacities.set(key, next)
  }
}

const frame = (advance = true) => {
  if (advance) {
    const size = cfg.squareSize
    const effectiveSpeed = Math.max(cfg.speed, 0.1)
    const isHex = cfg.shape === 'hexagon'
    const wrapX = isHex ? size * 1.5 * 2 : size
    const wrapY = isHex ? size * Math.sqrt(3) : cfg.shape === 'triangle' ? size * 2 : size
    switch (cfg.direction) {
      case 'right': gridOffset.x = (gridOffset.x - effectiveSpeed + wrapX) % wrapX; break
      case 'left': gridOffset.x = (gridOffset.x + effectiveSpeed + wrapX) % wrapX; break
      case 'up': gridOffset.y = (gridOffset.y + effectiveSpeed + wrapY) % wrapY; break
      case 'down': gridOffset.y = (gridOffset.y - effectiveSpeed + wrapY) % wrapY; break
      case 'diagonal':
        gridOffset.x = (gridOffset.x - effectiveSpeed + wrapX) % wrapX
        gridOffset.y = (gridOffset.y - effectiveSpeed + wrapY) % wrapY
        break
    }
  }
  updateCellOpacities()
  drawGrid()
}

const loop = () => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  frame()
}

// hover 命中(square/circle;格點對齊)
const onMouseMove = (e: MouseEvent) => {
  const cv = canvasRef.value
  if (!cv || !cfg.enableMouseInteraction) return
  if (cfg.shape === 'hexagon' || cfg.shape === 'triangle') return
  const rect = cv.getBoundingClientRect()
  const size = cfg.squareSize
  const offsetX = ((gridOffset.x % size) + size) % size
  const offsetY = ((gridOffset.y % size) + size) % size
  hovered = {
    x: Math.floor((e.clientX - rect.left - offsetX) / size),
    y: Math.floor((e.clientY - rect.top - offsetY) / size),
  }
}
const onMouseLeave = () => (hovered = null)

onMounted(() => {
  const cv = canvasRef.value
  if (!cv) return
  ctx = cv.getContext('2d')
  resizeCanvas()
  ro = new ResizeObserver(resizeCanvas)
  if (containerRef.value) ro.observe(containerRef.value)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  if (containerRef.value) io.observe(containerRef.value)
  if (!coarsePointer) {
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseout', onMouseLeave)
  }

  if (reduceMotion) frame(false)
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseout', onMouseLeave)
  ctx = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-shapegrid" :class="props.class" aria-hidden="true">
    <canvas ref="canvasRef" class="block h-full w-full" />
    <ShapeGridControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-shapegrid {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #070a14;
}
</style>
