<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import { EffectComposer, RenderPass, EffectPass, Effect } from 'postprocessing'
import DitherControls from './DitherControls.vue'

// React Bits "Dither" ported to Vue 3。原版是 R3F + wrapEffect,
// 這裡改寫為原生 three + postprocessing(自訂 Effect 子類 +
// EffectComposer),shader 原樣:fbm 波浪 → Bayer 8x8 抖動復古化。
export interface DitherConfig {
  waveSpeed: number
  waveFrequency: number
  waveAmplitude: number
  colorNum: number
  pixelSize: number
  mouseRadius: number
  waveColor: string
  enableMouseInteraction: boolean
}

interface Props {
  waveSpeed?: number
  waveFrequency?: number
  waveAmplitude?: number
  waveColor?: string
  colorNum?: number
  pixelSize?: number
  mouseRadius?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  waveSpeed: 0.05,
  waveFrequency: 3,
  waveAmplitude: 0.3,
  waveColor: '#5a6a9a',
  colorNum: 4,
  pixelSize: 2,
  mouseRadius: 1,
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<DitherConfig>({
  waveSpeed: props.waveSpeed,
  waveFrequency: props.waveFrequency,
  waveAmplitude: props.waveAmplitude,
  colorNum: props.colorNum,
  pixelSize: props.pixelSize,
  mouseRadius: props.mouseRadius,
  waveColor: props.waveColor,
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

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let material: THREE.ShaderMaterial | null = null
let geometry: THREE.PlaneGeometry | null = null
let composer: EffectComposer | null = null
let retro: RetroEffect | null = null
// THREE.Clock 已於 three r185 棄用,改自算 elapsed
let startTime = 0
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
const mousePos = new THREE.Vector2(0, 0)

const WAVE_VERT = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;
}
`

const WAVE_FRAG = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2)); 
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv);
  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }
  vec3 col = mix(vec3(0.0), waveColor, f);
  gl_FragColor = vec4(col, 1.0);
}
`

const DITHER_FRAG = `
precision highp float;
uniform float colorNum;
uniform float pixelSize;
const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  float bias = 0.2;
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void mainImage(in vec4 inputColor, in vec2 uv, out vec4 outputColor) {
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(uv / normalizedPixelSize);
  vec4 color = texture2D(inputBuffer, uvPixel);
  color.rgb = dither(uv, color.rgb);
  outputColor = color;
}
`

class RetroEffect extends Effect {
  constructor() {
    super('RetroEffect', DITHER_FRAG, {
      uniforms: new Map<string, THREE.Uniform>([
        ['colorNum', new THREE.Uniform(4.0)],
        ['pixelSize', new THREE.Uniform(2.0)],
      ]),
    })
  }
}

const onPointerMove = (e: PointerEvent) => {
  if (!renderer || !cfg.enableMouseInteraction) return
  const rect = renderer.domElement.getBoundingClientRect()
  const dpr = renderer.getPixelRatio()
  mousePos.set((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr)
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !material || !composer) return
  const w = c.clientWidth || 1
  const h = c.clientHeight || 1
  renderer.setSize(w, h)
  composer.setSize(w, h)
  const dpr = renderer.getPixelRatio()
  material.uniforms.resolution.value.set(Math.floor(w * dpr), Math.floor(h * dpr))
  if (reduceMotion) renderFrame()
}

const renderFrame = () => {
  if (!composer || !material || !retro) return
  const u = material.uniforms
  if (!reduceMotion) u.time.value = (performance.now() - startTime) * 0.001
  u.waveSpeed.value = cfg.waveSpeed
  u.waveFrequency.value = cfg.waveFrequency
  u.waveAmplitude.value = cfg.waveAmplitude
  u.waveColor.value.set(cfg.waveColor)
  const interactive = cfg.enableMouseInteraction && !coarsePointer
  u.enableMouseInteraction.value = interactive ? 1 : 0
  u.mouseRadius.value = cfg.mouseRadius
  if (interactive) u.mousePos.value.copy(mousePos)
  retro.uniforms.get('colorNum')!.value = cfg.colorNum
  retro.uniforms.get('pixelSize')!.value = cfg.pixelSize
  composer.render()
}

const loop = () => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  renderFrame()
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1)
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })
  c.appendChild(renderer.domElement)

  material = new THREE.ShaderMaterial({
    vertexShader: WAVE_VERT,
    fragmentShader: WAVE_FRAG,
    uniforms: {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      waveSpeed: { value: cfg.waveSpeed },
      waveFrequency: { value: cfg.waveFrequency },
      waveAmplitude: { value: cfg.waveAmplitude },
      waveColor: { value: new THREE.Color(cfg.waveColor) },
      mousePos: { value: new THREE.Vector2(0, 0) },
      enableMouseInteraction: { value: 0 },
      mouseRadius: { value: cfg.mouseRadius },
    },
  })
  geometry = new THREE.PlaneGeometry(2, 2)
  scene.add(new THREE.Mesh(geometry, material))

  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  retro = new RetroEffect()
  composer.addPass(new EffectPass(camera, retro))
  startTime = performance.now()

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  io.observe(c)
  if (!coarsePointer) window.addEventListener('pointermove', onPointerMove, { passive: true })

  if (reduceMotion) {
    if (material) material.uniforms.time.value = 8
    renderFrame()
  } else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  composer?.dispose()
  geometry?.dispose()
  material?.dispose()
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  renderer = null
  scene = null
  camera = null
  material = null
  geometry = null
  composer = null
  retro = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-dither" :class="props.class" aria-hidden="true">
    <DitherControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-dither {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #05060d;
}
.knowledge-dither :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
