<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import ColorBendsControls from './ColorBendsControls.vue'

// React Bits "ColorBends" ported verbatim to Vue 3(three.js ShaderMaterial:
// 彎折色帶流動,最多 8 色,滑鼠視差)。內建控制面板,模式同 KnowledgeThreads。
export interface ColorBendsConfig {
  rotation: number
  speed: number
  autoRotate: number
  scale: number
  frequency: number
  warpStrength: number
  noise: number
  intensity: number
  bandWidth: number
  color1: string
  color2: string
  color3: string
  enableMouseInteraction: boolean
}

interface Props {
  rotation?: number
  speed?: number
  autoRotate?: number
  scale?: number
  frequency?: number
  warpStrength?: number
  mouseInfluence?: number
  parallax?: number
  noise?: number
  iterations?: number
  intensity?: number
  bandWidth?: number
  color1?: string
  color2?: string
  color3?: string
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  rotation: 90,
  speed: 0.2,
  autoRotate: 0,
  scale: 1,
  frequency: 1,
  warpStrength: 1,
  mouseInfluence: 1,
  parallax: 0.5,
  noise: 0.1,
  iterations: 1,
  intensity: 1.2,
  bandWidth: 6,
  color1: '#3b2a66',
  color2: '#1b3a5c',
  color3: '#6d4a8a',
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<ColorBendsConfig>({
  rotation: props.rotation,
  speed: props.speed,
  autoRotate: props.autoRotate,
  scale: props.scale,
  frequency: props.frequency,
  warpStrength: props.warpStrength,
  noise: props.noise,
  intensity: props.intensity,
  bandWidth: props.bandWidth,
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

const MAX_COLORS = 8
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let material: THREE.ShaderMaterial | null = null
let geometry: THREE.PlaneGeometry | null = null
// THREE.Clock 已於 three r185 棄用,改自算 elapsed/dt
let startTime = 0
let lastTime = 0
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
const pointerTarget = new THREE.Vector2(0, 0)
const pointerCurrent = new THREE.Vector2(0, 0)

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const FRAG = `
#define MAX_COLORS ${MAX_COLORS}
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform int uTransparent;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer; // in NDC [-1,1]
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
uniform int uIterations;
uniform float uIntensity;
uniform float uBandWidth;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  vec2 toward = (uPointer - rp);
  q += toward * uMouseInfluence * 0.2;

    for (int j = 0; j < 5; j++) {
      if (j >= uIterations - 1) break;
      vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
      q += (rr - q) * 0.15;
    }

    vec3 col = vec3(0.0);
    float a = 1.0;

    if (uColorCount > 0) {
      vec2 s = q;
      vec3 sumCol = vec3(0.0);
      float cover = 0.0;
      for (int i = 0; i < MAX_COLORS; ++i) {
            if (i >= uColorCount) break;
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3); // strong response across 0..1
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0); // allow >1 to amplify displacement
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float m = mix(m0, m1, kMix);
            float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
            sumCol += uColors[i] * w;
            cover = max(cover, w);
      }
      col = clamp(sumCol, 0.0, 1.0);
      a = uTransparent > 0 ? cover : 1.0;
    } else {
        vec2 s = q;
        for (int k = 0; k < 3; ++k) {
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3);
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float m = mix(m0, m1, kMix);
            col[k] = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
        }
        a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
    }

    col *= uIntensity;

    if (uNoise > 0.0001) {
      float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
      col += (n - 0.5) * uNoise;
      col = clamp(col, 0.0, 1.0);
    }

    vec3 rgb = (uTransparent > 0) ? col * a : col;
    gl_FragColor = vec4(rgb, a);
}
`

const toVec3 = (hex: string) => {
  const h = hex.replace('#', '').trim()
  return new THREE.Vector3(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

const onPointerMove = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  pointerTarget.set(
    ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1,
    -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1),
  )
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !material) return
  renderer.setSize(c.clientWidth || 1, c.clientHeight || 1, false)
  material.uniforms.uCanvas.value.set(c.clientWidth || 1, c.clientHeight || 1)
  if (reduceMotion) renderFrame(0.5)
}

const renderFrame = (dt: number) => {
  if (!renderer || !scene || !camera || !material) return
  const elapsed = (performance.now() - startTime) * 0.001
  const u = material.uniforms
  u.uTime.value = elapsed
  u.uSpeed.value = cfg.speed
  u.uScale.value = cfg.scale
  u.uFrequency.value = cfg.frequency
  u.uWarpStrength.value = cfg.warpStrength
  u.uNoise.value = cfg.noise
  u.uIntensity.value = cfg.intensity
  u.uBandWidth.value = cfg.bandWidth
  u.uMouseInfluence.value = cfg.enableMouseInteraction && !coarsePointer ? props.mouseInfluence : 0

  const palette = [cfg.color1, cfg.color2, cfg.color3].map(toVec3)
  for (let i = 0; i < MAX_COLORS; i++) {
    const vec = u.uColors.value[i] as THREE.Vector3
    if (i < palette.length) vec.copy(palette[i])
    else vec.set(0, 0, 0)
  }
  u.uColorCount.value = palette.length

  const deg = (cfg.rotation % 360) + cfg.autoRotate * elapsed
  const rad = (deg * Math.PI) / 180
  u.uRot.value.set(Math.cos(rad), Math.sin(rad))

  pointerCurrent.lerp(pointerTarget, Math.min(1, dt * 8))
  u.uPointer.value.copy(pointerCurrent)
  renderer.render(scene, camera)
}

const loop = () => {
  raf = requestAnimationFrame(loop)
  const now = performance.now()
  const dt = (now - lastTime) * 0.001
  lastTime = now
  if (!onScreen || document.hidden) return
  renderFrame(dt)
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  geometry = new THREE.PlaneGeometry(2, 2)
  const uColorsArray = Array.from({ length: MAX_COLORS }, () => new THREE.Vector3(0, 0, 0))
  material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uCanvas: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSpeed: { value: cfg.speed },
      uRot: { value: new THREE.Vector2(1, 0) },
      uColorCount: { value: 0 },
      uColors: { value: uColorsArray },
      uTransparent: { value: 1 },
      uScale: { value: cfg.scale },
      uFrequency: { value: cfg.frequency },
      uWarpStrength: { value: cfg.warpStrength },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uMouseInfluence: { value: 0 },
      uParallax: { value: props.parallax },
      uNoise: { value: cfg.noise },
      uIterations: { value: props.iterations },
      uIntensity: { value: cfg.intensity },
      uBandWidth: { value: cfg.bandWidth },
    },
    premultipliedAlpha: true,
    transparent: true,
  })
  scene.add(new THREE.Mesh(geometry, material))

  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })
  c.appendChild(renderer.domElement)
  startTime = performance.now()
  lastTime = startTime

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  io.observe(c)
  if (!coarsePointer) window.addEventListener('pointermove', onPointerMove, { passive: true })

  if (reduceMotion) renderFrame(0.5)
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
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
})
</script>

<template>
  <div ref="containerRef" class="knowledge-colorbends" :class="props.class" aria-hidden="true">
    <ColorBendsControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-colorbends {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0a0a14;
}
.knowledge-colorbends :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
