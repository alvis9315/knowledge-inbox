<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import LightPillarControls from './LightPillarControls.vue'

// React Bits "LightPillar" ported verbatim to Vue 3(three.js ShaderMaterial:
// 雙色光柱 raymarch,旋轉 + 波動)。品質固定 high 檔(原版行動裝置降檔
// 邏輯以 dpr 上限 2 代替)。內建控制面板,模式同 KnowledgeThreads。
export interface LightPillarConfig {
  topColor: string
  bottomColor: string
  intensity: number
  rotationSpeed: number
  glowAmount: number
  pillarWidth: number
  pillarHeight: number
  noiseIntensity: number
  pillarRotation: number
  enableMouseInteraction: boolean
}

interface Props {
  topColor?: string
  bottomColor?: string
  intensity?: number
  rotationSpeed?: number
  glowAmount?: number
  pillarWidth?: number
  pillarHeight?: number
  noiseIntensity?: number
  pillarRotation?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  topColor: '#5227FF',
  bottomColor: '#FF9FFC',
  intensity: 1.0,
  rotationSpeed: 0.3,
  glowAmount: 0.005,
  pillarWidth: 3.0,
  pillarHeight: 0.4,
  noiseIntensity: 0.5,
  pillarRotation: 0,
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<LightPillarConfig>({
  topColor: props.topColor,
  bottomColor: props.bottomColor,
  intensity: props.intensity,
  rotationSpeed: props.rotationSpeed,
  glowAmount: props.glowAmount,
  pillarWidth: props.pillarWidth,
  pillarHeight: props.pillarHeight,
  noiseIntensity: props.noiseIntensity,
  pillarRotation: props.pillarRotation,
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
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let time = 0
let lastTime = 0
const mouse = new THREE.Vector2(0, 0)

const VERT = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `

const FRAG = `
      precision highp float;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uIntensity;
      uniform bool uInteractive;
      uniform float uGlowAmount;
      uniform float uPillarWidth;
      uniform float uPillarHeight;
      uniform float uNoiseIntensity;
      uniform float uRotCos;
      uniform float uRotSin;
      uniform float uPillarRotCos;
      uniform float uPillarRotSin;
      uniform float uWaveSin;
      uniform float uWaveCos;
      varying vec2 vUv;

      const float STEP_MULT = 1.0;
      const int MAX_ITER = 80;
      const int WAVE_ITER = 4;

      void main() {
        vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
        uv = vec2(uPillarRotCos * uv.x - uPillarRotSin * uv.y, uPillarRotSin * uv.x + uPillarRotCos * uv.y);

        vec3 ro = vec3(0.0, 0.0, -10.0);
        vec3 rd = normalize(vec3(uv, 1.0));

        float rotC = uRotCos;
        float rotS = uRotSin;
        if(uInteractive && (uMouse.x != 0.0 || uMouse.y != 0.0)) {
          float a = uMouse.x * 6.283185;
          rotC = cos(a);
          rotS = sin(a);
        }

        vec3 col = vec3(0.0);
        float t = 0.1;
        
        for(int i = 0; i < MAX_ITER; i++) {
          vec3 p = ro + rd * t;
          p.xz = vec2(rotC * p.x - rotS * p.z, rotS * p.x + rotC * p.z);

          vec3 q = p;
          q.y = p.y * uPillarHeight + uTime;
          
          float freq = 1.0;
          float amp = 1.0;
          for(int j = 0; j < WAVE_ITER; j++) {
            q.xz = vec2(uWaveCos * q.x - uWaveSin * q.z, uWaveSin * q.x + uWaveCos * q.z);
            q += cos(q.zxy * freq - uTime * float(j) * 2.0) * amp;
            freq *= 2.0;
            amp *= 0.5;
          }
          
          float d = length(cos(q.xz)) - 0.2;
          float bound = length(p.xz) - uPillarWidth;
          float k = 4.0;
          float h = max(k - abs(d - bound), 0.0);
          d = max(d, bound) + h * h * 0.0625 / k;
          d = abs(d) * 0.15 + 0.01;

          float grad = clamp((15.0 - p.y) / 30.0, 0.0, 1.0);
          col += mix(uBottomColor, uTopColor, grad) / d;

          t += d * STEP_MULT;
          if(t > 50.0) break;
        }

        float widthNorm = uPillarWidth / 3.0;
        col = tanh(col * uGlowAmount / widthNorm);
        
        col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;
        
        gl_FragColor = vec4(col * uIntensity, 1.0);
      }
    `

const parseColor = (hex: string) => {
  const c = new THREE.Color(hex)
  return new THREE.Vector3(c.r, c.g, c.b)
}

let mouseThrottle = false
const onMouseMove = (e: MouseEvent) => {
  const c = containerRef.value
  if (!c || !cfg.enableMouseInteraction || mouseThrottle) return
  mouseThrottle = true
  window.setTimeout(() => (mouseThrottle = false), 16)
  const rect = c.getBoundingClientRect()
  mouse.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  )
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !material) return
  renderer.setSize(c.clientWidth, c.clientHeight)
  material.uniforms.uResolution.value.set(c.clientWidth, c.clientHeight)
  if (reduceMotion) renderFrame(true)
}

const renderFrame = (force = false) => {
  if (!renderer || !scene || !camera || !material) return
  if (!force) time += 0.016 * cfg.rotationSpeed
  const u = material.uniforms
  u.uTime.value = time
  u.uRotCos.value = Math.cos(time * 0.3)
  u.uRotSin.value = Math.sin(time * 0.3)
  u.uTopColor.value = parseColor(cfg.topColor)
  u.uBottomColor.value = parseColor(cfg.bottomColor)
  u.uIntensity.value = cfg.intensity
  u.uGlowAmount.value = cfg.glowAmount
  u.uPillarWidth.value = cfg.pillarWidth
  u.uPillarHeight.value = cfg.pillarHeight
  u.uNoiseIntensity.value = cfg.noiseIntensity
  const rad = (cfg.pillarRotation * Math.PI) / 180
  u.uPillarRotCos.value = Math.cos(rad)
  u.uPillarRotSin.value = Math.sin(rad)
  u.uInteractive.value = cfg.enableMouseInteraction && !coarsePointer
  renderer.render(scene, camera)
}

const loop = (t: number) => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) { lastTime = t; return }
  // 60fps 節流同原版
  if (t - lastTime < 1000 / 60) return
  lastTime = t
  renderFrame()
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp',
      stencil: false,
      depth: false,
    })
  } catch {
    return
  }
  renderer.setSize(c.clientWidth, c.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  c.appendChild(renderer.domElement)

  material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(c.clientWidth, c.clientHeight) },
      uMouse: { value: mouse },
      uTopColor: { value: parseColor(cfg.topColor) },
      uBottomColor: { value: parseColor(cfg.bottomColor) },
      uIntensity: { value: cfg.intensity },
      uInteractive: { value: cfg.enableMouseInteraction },
      uGlowAmount: { value: cfg.glowAmount },
      uPillarWidth: { value: cfg.pillarWidth },
      uPillarHeight: { value: cfg.pillarHeight },
      uNoiseIntensity: { value: cfg.noiseIntensity },
      uRotCos: { value: 1.0 },
      uRotSin: { value: 0.0 },
      uPillarRotCos: { value: Math.cos((cfg.pillarRotation * Math.PI) / 180) },
      uPillarRotSin: { value: Math.sin((cfg.pillarRotation * Math.PI) / 180) },
      uWaveSin: { value: Math.sin(0.4) },
      uWaveCos: { value: Math.cos(0.4) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  geometry = new THREE.PlaneGeometry(2, 2)
  scene.add(new THREE.Mesh(geometry, material))

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  io.observe(c)
  if (!coarsePointer) window.addEventListener('mousemove', onMouseMove, { passive: true })

  if (reduceMotion) {
    time = 2
    renderFrame(true)
  } else {
    raf = requestAnimationFrame(loop)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  material?.dispose()
  geometry?.dispose()
  renderer = null
  scene = null
  camera = null
  material = null
  geometry = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-lightpillar" :class="props.class" aria-hidden="true">
    <LightPillarControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-lightpillar {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #06040f;
}
.knowledge-lightpillar :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
