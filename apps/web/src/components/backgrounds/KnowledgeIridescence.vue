<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import IridescenceControls from './IridescenceControls.vue'

// React Bits "Iridescence" ported verbatim to Vue 3(OGL + 官方 GLSL:
// cos/sin 迭代干涉的虹彩流動,uColor 作整體色調乘數)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface IridescenceConfig {
  color: string
  speed: number
  amplitude: number
  enableMouseInteraction: boolean
}

interface Props {
  color?: string
  speed?: number
  amplitude?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  // 官方預設 [1,1,1] 全亮度虹彩;app 背景調暗一階保閱讀性
  color: '#46608c',
  speed: 0.7,
  amplitude: 0.1,
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<IridescenceConfig>({
  color: props.color,
  speed: props.speed,
  amplitude: props.amplitude,
  enableMouseInteraction: props.enableMouseInteraction,
})

const emitCtl = defineEmits<{ controlsDone: [cfg: Record<string, unknown>]; controlsCancel: [] }>()
// 開面板時快照,取消=還原。
let cfgSnapshot: Record<string, unknown> | null = null
watch(() => props.showControls, (o) => {
  if (o) cfgSnapshot = JSON.parse(JSON.stringify(cfg))
})
function ctlDone() {
  emitCtl('controlsDone', JSON.parse(JSON.stringify(cfg)))
}
function ctlCancel() {
  if (cfgSnapshot) Object.assign(cfg, cfgSnapshot)
  emitCtl('controlsCancel')
}

const containerRef = ref<HTMLDivElement | null>(null)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = window.matchMedia('(pointer: coarse)').matches

/* eslint-disable @typescript-eslint/no-explicit-any */
let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null
let gl: any = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true

const VERT = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`

const FRAG = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function onPointerMove(e: PointerEvent) {
  const c = containerRef.value
  if (!c || !program || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  program.uniforms.uMouse.value[0] = (e.clientX - rect.left) / rect.width
  program.uniforms.uMouse.value[1] = 1.0 - (e.clientY - rect.top) / rect.height
}

function resize() {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  renderer.setSize(c.offsetWidth, c.offsetHeight)
  program.uniforms.uResolution.value = new Color(
    gl.canvas.width,
    gl.canvas.height,
    gl.canvas.width / gl.canvas.height,
  )
  if (reduceMotion) renderFrame(0)
}

function renderFrame(t: number) {
  if (!renderer || !program || !mesh) return
  program.uniforms.uTime.value = t * 0.001
  program.uniforms.uColor.value = new Color(...hexToRgb(cfg.color))
  program.uniforms.uSpeed.value = cfg.speed
  program.uniforms.uAmplitude.value = cfg.amplitude
  if (!cfg.enableMouseInteraction) {
    program.uniforms.uMouse.value[0] = 0.5
    program.uniforms.uMouse.value[1] = 0.5
  }
  renderer.render({ scene: mesh })
}

function loop(t: number) {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  renderFrame(t)
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  renderer = new Renderer()
  gl = renderer.gl
  gl.clearColor(1, 1, 1, 1)
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(...hexToRgb(cfg.color)) },
      uResolution: { value: new Color(1, 1, 1) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uAmplitude: { value: cfg.amplitude },
      uSpeed: { value: cfg.speed },
    },
  })
  mesh = new Mesh(gl, { geometry: new Triangle(gl), program })

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  io.observe(c)
  if (!coarsePointer) window.addEventListener('pointermove', onPointerMove)

  if (reduceMotion) renderFrame(0)
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  if (gl?.canvas?.parentNode) gl.canvas.parentNode.removeChild(gl.canvas)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  renderer = null
  program = null
  mesh = null
  gl = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-iridescence" :class="props.class" aria-hidden="true">
    <IridescenceControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-iridescence {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0a1020;
}
.knowledge-iridescence :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
