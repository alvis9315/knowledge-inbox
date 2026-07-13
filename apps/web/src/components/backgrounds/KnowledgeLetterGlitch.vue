<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import LetterGlitchControls from './LetterGlitchControls.vue'

// React Bits "LetterGlitch" ported to Vue 3(純 canvas 2D,零依賴:
// 等寬字符網格隨機跳字+三色漸變,外圈暗角)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface LetterGlitchConfig {
  color1: string
  color2: string
  color3: string
  glitchSpeed: number
  smooth: boolean
}

interface Props {
  color1?: string
  color2?: string
  color3?: string
  glitchSpeed?: number
  smooth?: boolean
  outerVignette?: boolean
  centerVignette?: boolean
  characters?: string
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  color1: '#2b4539',
  color2: '#61dca3',
  color3: '#61b3dc',
  glitchSpeed: 50,
  smooth: true,
  outerVignette: true,
  centerVignette: false,
  characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789',
  showControls: false,
  class: '',
})

const cfg = reactive<LetterGlitchConfig>({
  color1: props.color1,
  color2: props.color2,
  color3: props.color3,
  glitchSpeed: props.glitchSpeed,
  smooth: props.smooth,
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

const FONT_SIZE = 16
const CHAR_W = 10
const CHAR_H = 20
const CHARS = Array.from(props.characters)

interface Letter {
  char: string
  color: string
  targetColor: string
  colorProgress: number
}

let ctx: CanvasRenderingContext2D | null = null
let letters: Letter[] = []
let grid = { columns: 0, rows: 0 }
let raf = 0
let lastGlitch = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true

const glitchColors = () => [cfg.color1, cfg.color2, cfg.color3]
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]
const randColor = () => {
  const cs = glitchColors()
  return cs[Math.floor(Math.random() * cs.length)]
}

// 支援 hex 與 rgb() 兩種格式(漸變中的字色是 rgb 字串;原版只解 hex,
// 導致漸變做到一半卡住——這裡補上讓 smooth 真正走完)。
const parseColor = (c: string): { r: number; g: number; b: number } | null => {
  const rgbM = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(c)
  if (rgbM) return { r: +rgbM[1], g: +rgbM[2], b: +rgbM[3] }
  const hex = c.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (_, r, g, b) => r + r + g + g + b + b)
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null
}
const lerpColor = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, f: number) => {
  return `rgb(${Math.round(a.r + (b.r - a.r) * f)}, ${Math.round(a.g + (b.g - a.g) * f)}, ${Math.round(a.b + (b.b - a.b) * f)})`
}

const initLetters = (columns: number, rows: number) => {
  grid = { columns, rows }
  letters = Array.from({ length: columns * rows }, () => ({
    char: randChar(),
    color: randColor(),
    targetColor: randColor(),
    colorProgress: 1,
  }))
}

const resizeCanvas = () => {
  const c = containerRef.value
  const cv = canvasRef.value
  if (!c || !cv) return
  const dpr = window.devicePixelRatio || 1
  const rect = c.getBoundingClientRect()
  cv.width = rect.width * dpr
  cv.height = rect.height * dpr
  cv.style.width = `${rect.width}px`
  cv.style.height = `${rect.height}px`
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  initLetters(Math.ceil(rect.width / CHAR_W), Math.ceil(rect.height / CHAR_H))
  drawLetters()
}

const drawLetters = () => {
  const cv = canvasRef.value
  if (!ctx || !cv || letters.length === 0) return
  const { width, height } = cv.getBoundingClientRect()
  ctx.clearRect(0, 0, width, height)
  ctx.font = `${FONT_SIZE}px monospace`
  ctx.textBaseline = 'top'
  letters.forEach((letter, index) => {
    ctx!.fillStyle = letter.color
    ctx!.fillText(letter.char, (index % grid.columns) * CHAR_W, Math.floor(index / grid.columns) * CHAR_H)
  })
}

const updateLetters = () => {
  if (letters.length === 0) return
  const updateCount = Math.max(1, Math.floor(letters.length * 0.05))
  for (let i = 0; i < updateCount; i++) {
    const index = Math.floor(Math.random() * letters.length)
    const l = letters[index]
    if (!l) continue
    l.char = randChar()
    l.targetColor = randColor()
    if (!cfg.smooth) {
      l.color = l.targetColor
      l.colorProgress = 1
    } else {
      l.colorProgress = 0
    }
  }
}

const smoothTransitions = () => {
  let needsRedraw = false
  for (const l of letters) {
    if (l.colorProgress < 1) {
      l.colorProgress = Math.min(1, l.colorProgress + 0.05)
      const a = parseColor(l.color)
      const b = parseColor(l.targetColor)
      if (a && b) {
        l.color = lerpColor(a, b, l.colorProgress)
        needsRedraw = true
      }
    }
  }
  if (needsRedraw) drawLetters()
}

const animate = () => {
  raf = requestAnimationFrame(animate)
  if (!onScreen || document.hidden) return
  const now = Date.now()
  if (now - lastGlitch >= cfg.glitchSpeed) {
    updateLetters()
    drawLetters()
    lastGlitch = now
  }
  if (cfg.smooth) smoothTransitions()
}

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
  if (!reduceMotion) raf = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  ctx = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-letterglitch" :class="props.class" aria-hidden="true">
    <canvas ref="canvasRef" class="block h-full w-full" />
    <div v-if="outerVignette" class="lg-vignette-outer" />
    <div v-if="centerVignette" class="lg-vignette-center" />
    <LetterGlitchControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-letterglitch {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #000000;
}
.lg-vignette-outer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 1) 100%);
}
.lg-vignette-center {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 60%);
}
</style>
