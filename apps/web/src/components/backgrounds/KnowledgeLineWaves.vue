<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import LineWavesControls from './LineWavesControls.vue'

// React Bits "LineWaves" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 斜向雙層波線 + 三色循環,可游標扭曲)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface LineWavesConfig {
  speed: number
  innerLineCount: number
  outerLineCount: number
  warpIntensity: number
  rotation: number
  colorCycleSpeed: number
  brightness: number
  color1: string
  color2: string
  color3: string
  enableMouseInteraction: boolean
}

interface Props {
  speed?: number
  innerLineCount?: number
  outerLineCount?: number
  warpIntensity?: number
  rotation?: number
  edgeFadeWidth?: number
  colorCycleSpeed?: number
  brightness?: number
  color1?: string
  color2?: string
  color3?: string
  enableMouseInteraction?: boolean
  mouseInfluence?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  speed: 0.3,
  innerLineCount: 32.0,
  outerLineCount: 36.0,
  warpIntensity: 1.0,
  rotation: -45,
  edgeFadeWidth: 0.0,
  colorCycleSpeed: 1.0,
  brightness: 0.25,
  color1: '#8fb7ff',
  color2: '#a78bfa',
  color3: '#61dca3',
  enableMouseInteraction: false,
  mouseInfluence: 2.0,
  showControls: false,
  class: '',
})

const cfg = reactive<LineWavesConfig>({
  speed: props.speed,
  innerLineCount: props.innerLineCount,
  outerLineCount: props.outerLineCount,
  warpIntensity: props.warpIntensity,
  rotation: props.rotation,
  colorCycleSpeed: props.colorCycleSpeed,
  brightness: props.brightness,
  color1: props.color1,
  color2: props.color2,
  color3: props.color3,
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
const currentMouse = [0.5, 0.5]
let targetMouse = [0.5, 0.5]

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
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uInnerLines;
uniform float uOuterLines;
uniform float uWarpIntensity;
uniform float uRotation;
uniform float uEdgeFadeWidth;
uniform float uColorCycleSpeed;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define HALF_PI 1.5707963

float hashF(float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

float smoothNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hashF(i), hashF(i + 1.0), u);
}

float displaceA(float coord, float t) {
  float result = sin(coord * 2.123) * 0.2;
  result += sin(coord * 3.234 + t * 4.345) * 0.1;
  result += sin(coord * 0.589 + t * 0.934) * 0.5;
  return result;
}

float displaceB(float coord, float t) {
  float result = sin(coord * 1.345) * 0.3;
  result += sin(coord * 2.734 + t * 3.345) * 0.2;
  result += sin(coord * 0.189 + t * 0.934) * 0.3;
  return result;
}

vec2 rotate2D(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  vec2 coords = gl_FragCoord.xy / uResolution.xy;
  coords = coords * 2.0 - 1.0;
  coords = rotate2D(coords, uRotation);

  float halfT = uTime * uSpeed * 0.5;
  float fullT = uTime * uSpeed;

  float mouseWarp = 0.0;
  if (uEnableMouse) {
    vec2 mPos = rotate2D(uMouse * 2.0 - 1.0, uRotation);
    float mDist = length(coords - mPos);
    mouseWarp = uMouseInfluence * exp(-mDist * mDist * 4.0);
  }

  float warpAx = coords.x + displaceA(coords.y, halfT) * uWarpIntensity + mouseWarp;
  float warpAy = coords.y - displaceA(coords.x * cos(fullT) * 1.235, halfT) * uWarpIntensity;
  float warpBx = coords.x + displaceB(coords.y, halfT) * uWarpIntensity + mouseWarp;
  float warpBy = coords.y - displaceB(coords.x * sin(fullT) * 1.235, halfT) * uWarpIntensity;

  vec2 fieldA = vec2(warpAx, warpAy);
  vec2 fieldB = vec2(warpBx, warpBy);
  vec2 blended = mix(fieldA, fieldB, mix(fieldA, fieldB, 0.5));

  float fadeTop = smoothstep(uEdgeFadeWidth, uEdgeFadeWidth + 0.4, blended.y);
  float fadeBottom = smoothstep(-uEdgeFadeWidth, -(uEdgeFadeWidth + 0.4), blended.y);
  float vMask = 1.0 - max(fadeTop, fadeBottom);

  float tileCount = mix(uOuterLines, uInnerLines, vMask);
  float scaledY = blended.y * tileCount;
  float nY = smoothNoise(abs(scaledY));

  float ridge = pow(
    step(abs(nY - blended.x) * 2.0, HALF_PI) * cos(2.0 * (nY - blended.x)),
    5.0
  );

  float lines = 0.0;
  for (float i = 1.0; i < 3.0; i += 1.0) {
    lines += pow(max(fract(scaledY), fract(-scaledY)), i * 2.0);
  }

  float pattern = vMask * lines;

  float cycleT = fullT * uColorCycleSpeed;
  float rChannel = (pattern + lines * ridge) * (cos(blended.y + cycleT * 0.234) * 0.5 + 1.0);
  float gChannel = (pattern + vMask * ridge) * (sin(blended.x + cycleT * 1.745) * 0.5 + 1.0);
  float bChannel = (pattern + lines * ridge) * (cos(blended.x + cycleT * 0.534) * 0.5 + 1.0);

  vec3 col = (rChannel * uColor1 + gChannel * uColor2 + bChannel * uColor3) * uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
`

const hexToVec3 = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

const onPointerMove = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  targetMouse = [(e.clientX - rect.left) / rect.width, 1.0 - (e.clientY - rect.top) / rect.height]
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  renderer.setSize(c.offsetWidth, c.offsetHeight)
  program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height]
  if (reduceMotion) renderFrame(800)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  program.uniforms.uTime.value = t * 0.001
  program.uniforms.uSpeed.value = cfg.speed
  program.uniforms.uInnerLines.value = cfg.innerLineCount
  program.uniforms.uOuterLines.value = cfg.outerLineCount
  program.uniforms.uWarpIntensity.value = cfg.warpIntensity
  program.uniforms.uRotation.value = (cfg.rotation * Math.PI) / 180
  program.uniforms.uColorCycleSpeed.value = cfg.colorCycleSpeed
  program.uniforms.uBrightness.value = cfg.brightness
  program.uniforms.uColor1.value = hexToVec3(cfg.color1)
  program.uniforms.uColor2.value = hexToVec3(cfg.color2)
  program.uniforms.uColor3.value = hexToVec3(cfg.color3)
  const mouseOn = cfg.enableMouseInteraction && !coarsePointer
  program.uniforms.uEnableMouse.value = mouseOn
  if (mouseOn) {
    currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0])
    currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1])
    program.uniforms.uMouse.value[0] = currentMouse[0]
    program.uniforms.uMouse.value[1] = currentMouse[1]
  } else {
    program.uniforms.uMouse.value[0] = 0.5
    program.uniforms.uMouse.value[1] = 0.5
  }
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
  renderer = new Renderer({ alpha: true, premultipliedAlpha: false })
  gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: [1, 1, 1] },
      uSpeed: { value: cfg.speed },
      uInnerLines: { value: cfg.innerLineCount },
      uOuterLines: { value: cfg.outerLineCount },
      uWarpIntensity: { value: cfg.warpIntensity },
      uRotation: { value: (cfg.rotation * Math.PI) / 180 },
      uEdgeFadeWidth: { value: props.edgeFadeWidth },
      uColorCycleSpeed: { value: cfg.colorCycleSpeed },
      uBrightness: { value: cfg.brightness },
      uColor1: { value: hexToVec3(cfg.color1) },
      uColor2: { value: hexToVec3(cfg.color2) },
      uColor3: { value: hexToVec3(cfg.color3) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseInfluence: { value: props.mouseInfluence },
      uEnableMouse: { value: cfg.enableMouseInteraction },
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

  if (reduceMotion) renderFrame(800)
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
  <div ref="containerRef" class="knowledge-linewaves" :class="props.class" aria-hidden="true">
    <LineWavesControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-linewaves {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #06070f;
}
.knowledge-linewaves :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
