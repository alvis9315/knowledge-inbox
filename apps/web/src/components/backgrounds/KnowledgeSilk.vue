<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import SilkControls from './SilkControls.vue'

// React Bits "Silk" 移植到 Vue 3。原版是 three.js + R3F 的全螢幕 plane,
// shader 本身與框架無關,這裡改掛在 ogl 全螢幕三角形上(不引入 three.js,
// 沿用專案既有 WebGL 依賴)。絲綢感波紋 + 顆粒噪點。
export interface SilkConfig {
  color: string
  speed: number
  scale: number
  rotation: number
  noiseIntensity: number
}

interface Props {
  color?: string
  speed?: number
  scale?: number
  rotation?: number
  noiseIntensity?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: '#7B7481',
  speed: 5,
  scale: 1,
  rotation: 0,
  noiseIntensity: 1.5,
  showControls: false,
  class: '',
})

const cfg = reactive<SilkConfig>({
  color: props.color,
  speed: props.speed,
  scale: props.scale,
  rotation: props.rotation,
  noiseIntensity: props.noiseIntensity,
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

/* eslint-disable @typescript-eslint/no-explicit-any */
let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null
let gl: any = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let lastT = 0

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
varying vec2 vUv;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  gl_FragColor = col;
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

function resize() {
  const c = containerRef.value
  if (!c || !renderer) return
  renderer.setSize(c.clientWidth, c.clientHeight)
  if (reduceMotion) renderFrame(lastT)
}

function renderFrame(t: number) {
  if (!renderer || !program || !mesh) return
  // 原版 useFrame:uTime += 0.1 * delta(秒)
  const delta = Math.min((t - lastT) / 1000, 0.1)
  lastT = t
  program.uniforms.uTime.value += 0.1 * delta
  program.uniforms.uColor.value = hexToRgb(cfg.color)
  program.uniforms.uSpeed.value = cfg.speed
  program.uniforms.uScale.value = cfg.scale
  program.uniforms.uRotation.value = cfg.rotation
  program.uniforms.uNoiseIntensity.value = cfg.noiseIntensity
  renderer.render({ scene: mesh })
}

function loop(t: number) {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) { lastT = t; return }
  renderFrame(t)
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2) })
  gl = renderer.gl
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: hexToRgb(cfg.color) },
      uSpeed: { value: cfg.speed },
      uScale: { value: cfg.scale },
      uRotation: { value: cfg.rotation },
      uNoiseIntensity: { value: cfg.noiseIntensity },
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

  if (reduceMotion) renderFrame(16)
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  if (gl?.canvas?.parentNode) gl.canvas.parentNode.removeChild(gl.canvas)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  renderer = null
  program = null
  mesh = null
  gl = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-silk" :class="props.class" aria-hidden="true">
    <SilkControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-silk {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #141218;
}
.knowledge-silk :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
