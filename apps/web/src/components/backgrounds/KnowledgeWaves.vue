<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import WavesControls from './WavesControls.vue'

// React Bits "Waves" ported to Vue 3(純 canvas 2D,零 WebGL 依賴:
// Perlin noise 驅動的直線網格波動 + 游標排斥彈簧)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface WavesConfig {
  lineColor: string
  waveAmpX: number
  waveAmpY: number
  speed: number
  xGap: number
  yGap: number
  enableMouseInteraction: boolean
}

interface Props {
  lineColor?: string
  waveAmpX?: number
  waveAmpY?: number
  speed?: number
  xGap?: number
  yGap?: number
  enableMouseInteraction?: boolean
  friction?: number
  tension?: number
  maxCursorMove?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  lineColor: '#33507a',
  waveAmpX: 32,
  waveAmpY: 16,
  speed: 1,
  xGap: 12,
  yGap: 34,
  enableMouseInteraction: false,
  friction: 0.925,
  tension: 0.005,
  maxCursorMove: 100,
  showControls: false,
  class: '',
})

const cfg = reactive<WavesConfig>({
  lineColor: props.lineColor,
  waveAmpX: props.waveAmpX,
  waveAmpY: props.waveAmpY,
  speed: props.speed,
  xGap: props.xGap,
  yGap: props.yGap,
  enableMouseInteraction: props.enableMouseInteraction,
})

const emitCtl = defineEmits<{ controlsDone: [cfg: Record<string, unknown>]; controlsCancel: [] }>()
// 開面板時快照,取消=還原。
let cfgSnapshot: Record<string, unknown> | null = null
watch(() => props.showControls, (o) => {
  if (o) cfgSnapshot = JSON.parse(JSON.stringify(cfg))
})
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
const mouseOn = () => cfg.enableMouseInteraction && !coarsePointer

// ── Perlin noise(官方原樣,JS 版)──
class Grad {
  constructor(public x: number, public y: number, public z: number) {}
  dot2(x: number, y: number) { return this.x * x + this.y * y }
}
class Noise {
  grad3 = [
    new Grad(1, 1, 0), new Grad(-1, 1, 0), new Grad(1, -1, 0), new Grad(-1, -1, 0),
    new Grad(1, 0, 1), new Grad(-1, 0, 1), new Grad(1, 0, -1), new Grad(-1, 0, -1),
    new Grad(0, 1, 1), new Grad(0, -1, 1), new Grad(0, 1, -1), new Grad(0, -1, -1),
  ]
  p = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240,
    21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88,
    237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83,
    111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216,
    80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186,
    3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
    17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193,
    238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
    184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128,
    195, 78, 66, 215, 61, 156, 180,
  ]
  perm = new Array<number>(512)
  gradP = new Array<Grad>(512)
  constructor(seed = 0) { this.seed(seed) }
  seed(seed: number) {
    if (seed > 0 && seed < 1) seed *= 65536
    seed = Math.floor(seed)
    if (seed < 256) seed |= seed << 8
    for (let i = 0; i < 256; i++) {
      const v = i & 1 ? this.p[i] ^ (seed & 255) : this.p[i] ^ ((seed >> 8) & 255)
      this.perm[i] = this.perm[i + 256] = v
      this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12]
    }
  }
  fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10) }
  lerp(a: number, b: number, t: number) { return (1 - t) * a + t * b }
  perlin2(x: number, y: number) {
    let X = Math.floor(x)
    let Y = Math.floor(y)
    x -= X; y -= Y; X &= 255; Y &= 255
    const n00 = this.gradP[X + this.perm[Y]].dot2(x, y)
    const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1)
    const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y)
    const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1)
    const u = this.fade(x)
    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(y))
  }
}

interface Point {
  x: number; y: number
  wave: { x: number; y: number }
  cursor: { x: number; y: number; vx: number; vy: number }
}

const noise = new Noise(Math.random())
let lines: Point[][] = []
let bounding = { width: 0, height: 0, left: 0, top: 0 }
const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false }
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true

const setSize = () => {
  const c = containerRef.value
  const cv = canvasRef.value
  if (!c || !cv) return
  bounding = c.getBoundingClientRect()
  cv.width = bounding.width
  cv.height = bounding.height
}

const setLines = () => {
  const { width, height } = bounding
  lines = []
  const oWidth = width + 200
  const oHeight = height + 30
  const totalLines = Math.ceil(oWidth / cfg.xGap)
  const totalPoints = Math.ceil(oHeight / cfg.yGap)
  const xStart = (width - cfg.xGap * totalLines) / 2
  const yStart = (height - cfg.yGap * totalPoints) / 2
  for (let i = 0; i <= totalLines; i++) {
    const pts: Point[] = []
    for (let j = 0; j <= totalPoints; j++) {
      pts.push({
        x: xStart + cfg.xGap * i,
        y: yStart + cfg.yGap * j,
        wave: { x: 0, y: 0 },
        cursor: { x: 0, y: 0, vx: 0, vy: 0 },
      })
    }
    lines.push(pts)
  }
}
// 網格密度改變需要重建點陣。
watch(() => [cfg.xGap, cfg.yGap], () => { setLines() })

const movePoints = (time: number) => {
  const sx = cfg.speed
  for (const pts of lines) {
    for (const p of pts) {
      const move = noise.perlin2(
        (p.x + time * 0.0125 * sx) * 0.002,
        (p.y + time * 0.005 * sx) * 0.0015,
      ) * 12
      p.wave.x = Math.cos(move) * cfg.waveAmpX
      p.wave.y = Math.sin(move) * cfg.waveAmpY

      if (mouseOn()) {
        const dx = p.x - mouse.sx
        const dy = p.y - mouse.sy
        const dist = Math.hypot(dx, dy)
        const l = Math.max(175, mouse.vs)
        if (dist < l) {
          const s = 1 - dist / l
          const f = Math.cos(dist * 0.001) * s
          p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065
          p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065
        }
      }

      p.cursor.vx += (0 - p.cursor.x) * props.tension
      p.cursor.vy += (0 - p.cursor.y) * props.tension
      p.cursor.vx *= props.friction
      p.cursor.vy *= props.friction
      p.cursor.x += p.cursor.vx * 2
      p.cursor.y += p.cursor.vy * 2
      p.cursor.x = Math.min(props.maxCursorMove, Math.max(-props.maxCursorMove, p.cursor.x))
      p.cursor.y = Math.min(props.maxCursorMove, Math.max(-props.maxCursorMove, p.cursor.y))
    }
  }
}

const moved = (p: Point, withCursor = true) => {
  const x = p.x + p.wave.x + (withCursor ? p.cursor.x : 0)
  const y = p.y + p.wave.y + (withCursor ? p.cursor.y : 0)
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
}

const drawLines = () => {
  if (!ctx) return
  ctx.clearRect(0, 0, bounding.width, bounding.height)
  ctx.beginPath()
  ctx.strokeStyle = cfg.lineColor
  for (const points of lines) {
    let p1 = moved(points[0], false)
    ctx.moveTo(p1.x, p1.y)
    points.forEach((p, idx) => {
      const isLast = idx === points.length - 1
      p1 = moved(p, !isLast)
      const p2 = moved(points[idx + 1] || points[points.length - 1], !isLast)
      ctx!.lineTo(p1.x, p1.y)
      if (isLast) ctx!.moveTo(p2.x, p2.y)
    })
  }
  ctx.stroke()
}

const tick = (t: number) => {
  raf = requestAnimationFrame(tick)
  if (!onScreen || document.hidden) return
  mouse.sx += (mouse.x - mouse.sx) * 0.1
  mouse.sy += (mouse.y - mouse.sy) * 0.1
  const dx = mouse.x - mouse.lx
  const dy = mouse.y - mouse.ly
  const d = Math.hypot(dx, dy)
  mouse.v = d
  mouse.vs += (d - mouse.vs) * 0.1
  mouse.vs = Math.min(100, mouse.vs)
  mouse.lx = mouse.x
  mouse.ly = mouse.y
  mouse.a = Math.atan2(dy, dx)
  movePoints(t)
  drawLines()
}

const updateMouse = (x: number, y: number) => {
  mouse.x = x - bounding.left
  mouse.y = y - bounding.top
  if (!mouse.set) {
    mouse.sx = mouse.x
    mouse.sy = mouse.y
    mouse.lx = mouse.x
    mouse.ly = mouse.y
    mouse.set = true
  }
}
const onMouseMove = (e: MouseEvent) => { updateMouse(e.clientX, e.clientY) }

const onResize = () => {
  setSize()
  setLines()
  if (reduceMotion) { movePoints(0); drawLines() }
}

onMounted(() => {
  const cv = canvasRef.value
  if (!cv) return
  ctx = cv.getContext('2d')
  setSize()
  setLines()
  ro = new ResizeObserver(onResize)
  if (containerRef.value) ro.observe(containerRef.value)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  if (containerRef.value) io.observe(containerRef.value)
  if (!coarsePointer) window.addEventListener('mousemove', onMouseMove)

  if (reduceMotion) { movePoints(0); drawLines() }
  else raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  ctx = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-waves" :class="props.class" aria-hidden="true">
    <canvas ref="canvasRef" class="block h-full w-full" />
    <WavesControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-waves {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: linear-gradient(160deg, #060b14 0%, #0a1322 55%, #0c1830 100%);
}
</style>
