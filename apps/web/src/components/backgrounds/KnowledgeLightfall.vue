<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import LightfallControls from './LightfallControls.vue'

// React Bits "Lightfall" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 垂直落下的光瀑條紋 + 星點閃爍,最多 8 色盤;游標光暈可開關)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface LightfallConfig {
  speed: number
  streakCount: number
  glow: number
  density: number
  zoom: number
  opacity: number
  color1: string
  color2: string
  color3: string
  bgColor: string
  enableMouseInteraction: boolean
}

interface Props {
  speed?: number
  streakCount?: number
  streakWidth?: number
  streakLength?: number
  glow?: number
  density?: number
  twinkle?: number
  zoom?: number
  backgroundGlow?: number
  opacity?: number
  color1?: string
  color2?: string
  color3?: string
  backgroundColor?: string
  enableMouseInteraction?: boolean
  mouseStrength?: number
  mouseRadius?: number
  mouseDampening?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  speed: 0.5,
  streakCount: 2,
  streakWidth: 1,
  streakLength: 1,
  glow: 1,
  density: 0.6,
  twinkle: 1,
  zoom: 3,
  backgroundGlow: 0.35,
  opacity: 0.9,
  color1: '#A6C8FF',
  color2: '#5227FF',
  color3: '#FF9FFC',
  backgroundColor: '#0a1030',
  enableMouseInteraction: false,
  mouseStrength: 0.5,
  mouseRadius: 1,
  mouseDampening: 0.15,
  showControls: false,
  class: '',
})

const cfg = reactive<LightfallConfig>({
  speed: props.speed,
  streakCount: props.streakCount,
  glow: props.glow,
  density: props.density,
  zoom: props.zoom,
  opacity: props.opacity,
  color1: props.color1,
  color2: props.color2,
  color3: props.color3,
  bgColor: props.backgroundColor,
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
let lastTime = 0
const mouseTarget = [0, 0]

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

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uBgColor;
uniform vec3  uMouseColor;
uniform float uSpeed;
uniform int   uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

vec3 tanhv(vec3 x) {
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

vec2 sceneC(vec2 frag, vec2 r) {
  vec2 P = (frag + frag - r) / r.x;
  float z = 0.0;
  float d = 1e3;
  vec4 O = vec4(0.0);
  for (int k = 0; k < 39; k++) {
    if (d <= 1e-4) break;
    O = z * normalize(vec4(P, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    d = 1.0 - sqrt(length(O * O));
    z += d;
  }
  return vec2(O.x, atan(O.z, O.y));
}

void mainImage(out vec4 o, vec2 C) {
  vec2 r = iResolution.xy;
  vec2 uv0 = (C + C - r) / r.x;
  float T = 0.1 * iTime * uSpeed + 9.0;
  float angRings = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
  vec2 Y = vec2(5e-3, 6.28318530718 / angRings);

  vec2 c0 = sceneC(C, r);
  vec2 cdx = sceneC(C + vec2(1.0, 0.0), r);
  vec2 cdy = sceneC(C + vec2(0.0, 1.0), r);
  vec2 dCx = cdx - c0;
  vec2 dCy = cdy - c0;
  dCx.y -= 6.28318530718 * floor(dCx.y / 6.28318530718 + 0.5);
  dCy.y -= 6.28318530718 * floor(dCy.y / 6.28318530718 + 0.5);
  vec2 fw = abs(dCx) + abs(dCy);
  C = c0;

  vec2 P = vec2(2.0, 1.0) * uv0 - (r / r.x) * vec2(0.0, 1.0);
  vec4 O = vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(P, P) + 6.0), 0.0);

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mN = (iMouse + iMouse - r) / r.x;
    float md = length(uv0 - mN);
    mGlow = exp(-md * md / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
    O.rgb += uMouseColor * mGlow * 0.25;
  }

  float zr = 5e-4 * uStreakWidth;
  vec2 rr = vec2(max(length(fw), 1e-5));
  float tail = 19.0 / max(uStreakLength, 0.05);

  for (int m = 0; m < 16; m++) {
    if (m >= uStreakCount) break;
    float jf = float(m) + 1.0;
    float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
    Pp -= floor(Pp / Y + 0.5) * Y;
    float h = fract(8663.0 * ic);
    vec3 col = palette(h);
    float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
    weight *= (1.0 + mGlow * 2.0);
    vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
    vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
    O.rgb += dot(sm, vec2(exp(tail * Pp.y), 3.0)) * col * weight;
    C.x += Y.x / 8.0;
  }

  vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
  o = vec4(colr, uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`

const hexToRGB = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

// 三色 → 8 槽色盤 + 平均色(游標光暈用),對齊原版 prepColors。
const palette = () => {
  const base = [cfg.color1, cfg.color2, cfg.color3].map(hexToRGB)
  const arr: [number, number, number][] = []
  for (let i = 0; i < 8; i++) arr.push(base[Math.min(i, base.length - 1)])
  const avg: [number, number, number] = [0, 0, 0]
  for (const c of base) {
    avg[0] += c[0] / base.length
    avg[1] += c[1] / base.length
    avg[2] += c[2] / base.length
  }
  return { arr, count: base.length, avg }
}

const onPointerMove = (e: PointerEvent) => {
  if (!gl || !cfg.enableMouseInteraction) return
  const rect = gl.canvas.getBoundingClientRect()
  const scale = (renderer as any)?.dpr || 1
  mouseTarget[0] = (e.clientX - rect.left) * scale
  mouseTarget[1] = (rect.height - (e.clientY - rect.top)) * scale
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  const rect = c.getBoundingClientRect()
  renderer.setSize(rect.width, rect.height)
  program.uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1]
  if (reduceMotion) renderFrame(900)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  const u = program.uniforms
  u.iTime.value = t * 0.001
  const { arr, count, avg } = palette()
  for (let i = 0; i < 8; i++) u[`uColor${i}`].value = arr[i]
  u.uColorCount.value = count
  u.uMouseColor.value = avg
  u.uBgColor.value = hexToRGB(cfg.bgColor)
  u.uSpeed.value = cfg.speed
  u.uStreakCount.value = Math.max(1, Math.min(16, Math.round(cfg.streakCount)))
  u.uGlow.value = cfg.glow
  u.uDensity.value = cfg.density
  u.uZoom.value = cfg.zoom
  u.uOpacity.value = cfg.opacity
  u.uMouseEnabled.value = cfg.enableMouseInteraction && !coarsePointer ? 1 : 0

  // 游標阻尼跟隨(原版 mouseDampening)
  if (!lastTime) lastTime = t
  const dt = (t - lastTime) / 1000
  lastTime = t
  const tau = Math.max(1e-4, props.mouseDampening)
  const factor = Math.min(1, 1 - Math.exp(-dt / tau))
  const cur = u.iMouse.value
  cur[0] += (mouseTarget[0] - cur[0]) * factor
  cur[1] += (mouseTarget[1] - cur[1]) * factor

  renderer.render({ scene: mesh })
}

const loop = (t: number) => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) { lastTime = t; return }
  renderFrame(t)
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  renderer = new Renderer({ alpha: true, dpr: Math.min(window.devicePixelRatio || 1, 2) })
  gl = renderer.gl
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  gl.canvas.style.display = 'block'
  c.appendChild(gl.canvas)

  const { arr, count, avg } = palette()
  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      iResolution: { value: [1, 1, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: arr[0] },
      uColor1: { value: arr[1] },
      uColor2: { value: arr[2] },
      uColor3: { value: arr[3] },
      uColor4: { value: arr[4] },
      uColor5: { value: arr[5] },
      uColor6: { value: arr[6] },
      uColor7: { value: arr[7] },
      uColorCount: { value: count },
      uBgColor: { value: hexToRGB(cfg.bgColor) },
      uMouseColor: { value: avg },
      uSpeed: { value: cfg.speed },
      uStreakCount: { value: cfg.streakCount },
      uStreakWidth: { value: props.streakWidth },
      uStreakLength: { value: props.streakLength },
      uGlow: { value: cfg.glow },
      uDensity: { value: cfg.density },
      uTwinkle: { value: props.twinkle },
      uZoom: { value: cfg.zoom },
      uBgGlow: { value: props.backgroundGlow },
      uOpacity: { value: cfg.opacity },
      uMouseEnabled: { value: cfg.enableMouseInteraction ? 1 : 0 },
      uMouseStrength: { value: props.mouseStrength },
      uMouseRadius: { value: props.mouseRadius },
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

  if (reduceMotion) renderFrame(900)
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
  <div ref="containerRef" class="knowledge-lightfall" :class="props.class" aria-hidden="true">
    <LightfallControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-lightfall {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #070a1a;
}
.knowledge-lightfall :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
