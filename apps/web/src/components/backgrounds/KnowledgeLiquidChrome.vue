<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import LiquidChromeControls from './LiquidChromeControls.vue'

// React Bits "LiquidChrome" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 迭代 cos 扭曲的液態金屬流動 + 3x3 超取樣抗鋸齒 + 游標漣漪)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface LiquidChromeConfig {
  baseColor: string
  speed: number
  amplitude: number
  frequencyX: number
  frequencyY: number
  enableMouseInteraction: boolean
}

interface Props {
  baseColor?: string
  speed?: number
  amplitude?: number
  frequencyX?: number
  frequencyY?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  // 官方預設 [0.1,0.1,0.1] 銀灰;app 底色帶一點藍
  baseColor: '#141c2b',
  speed: 0.2,
  amplitude: 0.3,
  frequencyX: 3,
  frequencyY: 3,
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<LiquidChromeConfig>({
  baseColor: props.baseColor,
  speed: props.speed,
  amplitude: props.amplitude,
  frequencyX: props.frequencyX,
  frequencyY: props.frequencyY,
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
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform vec3 uBaseColor;
uniform float uAmplitude;
uniform float uFrequencyX;
uniform float uFrequencyY;
uniform vec2 uMouse;
varying vec2 vUv;

vec4 renderImage(vec2 uvCoord) {
    vec2 fragCoord = uvCoord * uResolution.xy;
    vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

    for (float i = 1.0; i < 10.0; i++){
        uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
        uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
    }

    vec2 diff = (uvCoord - uMouse);
    float dist = length(diff);
    float falloff = exp(-dist * 20.0);
    float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
    uv += (diff / (dist + 0.0001)) * ripple * falloff;

    vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
    return vec4(color, 1.0);
}

void main() {
    vec4 col = vec4(0.0);
    int samples = 0;
    for (int i = -1; i <= 1; i++){
        for (int j = -1; j <= 1; j++){
            vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
            col += renderImage(vUv + offset);
            samples++;
        }
    }
    gl_FragColor = col / float(samples);
}
`

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

const onPointerMove = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c || !program || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  const m = program.uniforms.uMouse.value
  m[0] = (e.clientX - rect.left) / rect.width
  m[1] = 1 - (e.clientY - rect.top) / rect.height
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  renderer.setSize(c.offsetWidth, c.offsetHeight)
  const res = program.uniforms.uResolution.value
  res[0] = gl.canvas.width
  res[1] = gl.canvas.height
  res[2] = gl.canvas.width / gl.canvas.height
  if (reduceMotion) renderFrame(0)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  program.uniforms.uTime.value = t * 0.001 * cfg.speed
  program.uniforms.uBaseColor.value = new Float32Array(hexToRgb(cfg.baseColor))
  program.uniforms.uAmplitude.value = cfg.amplitude
  program.uniforms.uFrequencyX.value = cfg.frequencyX
  program.uniforms.uFrequencyY.value = cfg.frequencyY
  renderer.render({ scene: mesh })
}

const loop = (t: number) => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  renderFrame(t)
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  renderer = new Renderer({ antialias: true })
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
      uResolution: { value: new Float32Array([1, 1, 1]) },
      uBaseColor: { value: new Float32Array(hexToRgb(cfg.baseColor)) },
      uAmplitude: { value: cfg.amplitude },
      uFrequencyX: { value: cfg.frequencyX },
      uFrequencyY: { value: cfg.frequencyY },
      uMouse: { value: new Float32Array([0, 0]) },
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
  <div ref="containerRef" class="knowledge-liquidchrome" :class="props.class" aria-hidden="true">
    <LiquidChromeControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-liquidchrome {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0a0d14;
}
.knowledge-liquidchrome :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
