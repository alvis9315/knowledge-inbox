<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import PixelSnowControls from './PixelSnowControls.vue'

// React Bits "PixelSnow" ported verbatim to Vue 3(three.js ShaderMaterial:
// 像素化飄雪,方塊/圓點/雪花三種顆粒,多層景深淡出)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export type SnowVariant = 'square' | 'round' | 'snowflake'

export interface PixelSnowConfig {
  color: string
  variant: SnowVariant
  speed: number
  density: number
  pixelResolution: number
  direction: number
  brightness: number
}

interface Props {
  color?: string
  flakeSize?: number
  minFlakeSize?: number
  pixelResolution?: number
  speed?: number
  depthFade?: number
  farPlane?: number
  brightness?: number
  gamma?: number
  density?: number
  variant?: SnowVariant
  direction?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: '#cdd8ff',
  flakeSize: 0.01,
  minFlakeSize: 1.25,
  pixelResolution: 200,
  speed: 1.25,
  depthFade: 8,
  farPlane: 20,
  brightness: 1,
  gamma: 0.4545,
  density: 0.3,
  variant: 'square',
  direction: 125,
  showControls: false,
  class: '',
})

const cfg = reactive<PixelSnowConfig>({
  color: props.color,
  variant: props.variant,
  speed: props.speed,
  density: props.density,
  pixelResolution: props.pixelResolution,
  direction: props.direction,
  brightness: props.brightness,
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

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let material: THREE.ShaderMaterial | null = null
let geometry: THREE.PlaneGeometry | null = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let startTime = 0

const VERT = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`

const FRAG = `
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uFlakeSize;
uniform float uMinFlakeSize;
uniform float uPixelResolution;
uniform float uSpeed;
uniform float uDepthFade;
uniform float uFarPlane;
uniform vec3 uColor;
uniform float uBrightness;
uniform float uGamma;
uniform float uDensity;
uniform float uVariant;
uniform float uDirection;

// Precomputed constants
#define PI 3.14159265
#define PI_OVER_6 0.5235988
#define PI_OVER_3 1.0471976
#define INV_SQRT3 0.57735027
#define M1 1597334677U
#define M2 3812015801U
#define M3 3299493293U
#define F0 2.3283064e-10

// Optimized hash - inline multiplication
#define hash(n) (n * (n ^ (n >> 15)))
#define coord3(p) (uvec3(p).x * M1 ^ uvec3(p).y * M2 ^ uvec3(p).z * M3)

// Precomputed camera basis vectors (normalized vec3(1,1,1), vec3(1,0,-1))
const vec3 camK = vec3(0.57735027, 0.57735027, 0.57735027);
const vec3 camI = vec3(0.70710678, 0.0, -0.70710678);
const vec3 camJ = vec3(-0.40824829, 0.81649658, -0.40824829);

// Precomputed branch direction
const vec2 b1d = vec2(0.574, 0.819);

vec3 hash3(uint n) {
  uvec3 hashed = hash(n) * uvec3(1U, 511U, 262143U);
  return vec3(hashed) * F0;
}

float snowflakeDist(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x);
  a = abs(mod(a + PI_OVER_6, PI_OVER_3) - PI_OVER_6);
  vec2 q = r * vec2(cos(a), sin(a));
  float dMain = max(abs(q.y), max(-q.x, q.x - 1.0));
  float b1t = clamp(dot(q - vec2(0.4, 0.0), b1d), 0.0, 0.4);
  float dB1 = length(q - vec2(0.4, 0.0) - b1t * b1d);
  float b2t = clamp(dot(q - vec2(0.7, 0.0), b1d), 0.0, 0.25);
  float dB2 = length(q - vec2(0.7, 0.0) - b2t * b1d);
  return min(dMain, min(dB1, dB2)) * 10.0;
}

void main() {
  // Precompute reciprocals to avoid division
  float invPixelRes = 1.0 / uPixelResolution;
  float pixelSize = max(1.0, floor(0.5 + uResolution.x * invPixelRes));
  float invPixelSize = 1.0 / pixelSize;
  
  vec2 fragCoord = floor(gl_FragCoord.xy * invPixelSize);
  vec2 res = uResolution * invPixelSize;
  float invResX = 1.0 / res.x;

  vec3 ray = normalize(vec3((fragCoord - res * 0.5) * invResX, 1.0));
  ray = ray.x * camI + ray.y * camJ + ray.z * camK;

  // Precompute time-based values
  float timeSpeed = uTime * uSpeed;
  float windX = cos(uDirection) * 0.4;
  float windY = sin(uDirection) * 0.4;
  vec3 camPos = (windX * camI + windY * camJ + 0.1 * camK) * timeSpeed;
  vec3 pos = camPos;

  // Precompute ray reciprocal for strides
  vec3 absRay = max(abs(ray), vec3(0.001));
  vec3 strides = 1.0 / absRay;
  vec3 raySign = step(ray, vec3(0.0));
  vec3 phase = fract(pos) * strides;
  phase = mix(strides - phase, phase, raySign);

  // Precompute for intersection test
  float rayDotCamK = dot(ray, camK);
  float invRayDotCamK = 1.0 / rayDotCamK;
  float invDepthFade = 1.0 / uDepthFade;
  float halfInvResX = 0.5 * invResX;
  vec3 timeAnim = timeSpeed * 0.1 * vec3(7.0, 8.0, 5.0);

  float t = 0.0;
  for (int i = 0; i < 128; i++) {
    if (t >= uFarPlane) break;
    
    vec3 fpos = floor(pos);
    uint cellCoord = coord3(fpos);
    float cellHash = hash3(cellCoord).x;

    if (cellHash < uDensity) {
      vec3 h = hash3(cellCoord);
      
      // Optimized flake position calculation
      vec3 sinArg1 = fpos.yzx * 0.073;
      vec3 sinArg2 = fpos.zxy * 0.27;
      vec3 flakePos = 0.5 - 0.5 * cos(4.0 * sin(sinArg1) + 4.0 * sin(sinArg2) + 2.0 * h + timeAnim);
      flakePos = flakePos * 0.8 + 0.1 + fpos;

      float toIntersection = dot(flakePos - pos, camK) * invRayDotCamK;
      
      if (toIntersection > 0.0) {
        vec3 testPos = pos + ray * toIntersection - flakePos;
        float testX = dot(testPos, camI);
        float testY = dot(testPos, camJ);
        vec2 testUV = abs(vec2(testX, testY));
        
        float depth = dot(flakePos - camPos, camK);
        float flakeSize = max(uFlakeSize, uMinFlakeSize * depth * halfInvResX);
        
        // Avoid branching with step functions where possible
        float dist;
        if (uVariant < 0.5) {
          dist = max(testUV.x, testUV.y);
        } else if (uVariant < 1.5) {
          dist = length(testUV);
        } else {
          float invFlakeSize = 1.0 / flakeSize;
          dist = snowflakeDist(vec2(testX, testY) * invFlakeSize) * flakeSize;
        }

        if (dist < flakeSize) {
          float flakeSizeRatio = uFlakeSize / flakeSize;
          float intensity = exp2(-(t + toIntersection) * invDepthFade) *
                           min(1.0, flakeSizeRatio * flakeSizeRatio) * uBrightness;
          gl_FragColor = vec4(uColor * pow(vec3(intensity), vec3(uGamma)), 1.0);
          return;
        }
      }
    }

    float nextStep = min(min(phase.x, phase.y), phase.z);
    vec3 sel = step(phase, vec3(nextStep));
    phase = phase - nextStep + strides * sel;
    t += nextStep;
    pos = mix(pos + ray * nextStep, floor(pos + ray * nextStep + 0.5), sel);
  }

  gl_FragColor = vec4(0.0);
}
`

const variantValue = () => (cfg.variant === 'round' ? 1.0 : cfg.variant === 'snowflake' ? 2.0 : 0.0)

const syncUniforms = () => {
  if (!material) return
  const u = material.uniforms
  u.uSpeed.value = cfg.speed
  u.uDensity.value = cfg.density
  u.uPixelResolution.value = cfg.pixelResolution
  u.uVariant.value = variantValue()
  u.uDirection.value = (cfg.direction * Math.PI) / 180
  u.uBrightness.value = cfg.brightness
  const c = new THREE.Color(cfg.color)
  u.uColor.value.set(c.r, c.g, c.b)
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !material) return
  renderer.setSize(c.offsetWidth || 1, c.offsetHeight || 1)
  material.uniforms.uResolution.value.set(c.offsetWidth || 1, c.offsetHeight || 1)
  if (reduceMotion) renderFrame()
}

const renderFrame = () => {
  if (!renderer || !scene || !camera || !material) return
  syncUniforms()
  material.uniforms.uTime.value = (performance.now() - startTime) * 0.001
  renderer.render(scene, camera)
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
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })
  c.appendChild(renderer.domElement)

  const col = new THREE.Color(cfg.color)
  material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uFlakeSize: { value: props.flakeSize },
      uMinFlakeSize: { value: props.minFlakeSize },
      uPixelResolution: { value: cfg.pixelResolution },
      uSpeed: { value: cfg.speed },
      uDepthFade: { value: props.depthFade },
      uFarPlane: { value: props.farPlane },
      uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
      uBrightness: { value: cfg.brightness },
      uGamma: { value: props.gamma },
      uDensity: { value: cfg.density },
      uVariant: { value: variantValue() },
      uDirection: { value: (cfg.direction * Math.PI) / 180 },
    },
    transparent: true,
  })
  geometry = new THREE.PlaneGeometry(2, 2)
  scene.add(new THREE.Mesh(geometry, material))
  startTime = performance.now()

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  io.observe(c)

  if (reduceMotion) {
    material.uniforms.uTime.value = 12
    renderFrame()
  } else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
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
  <div ref="containerRef" class="knowledge-pixelsnow" :class="props.class" aria-hidden="true">
    <PixelSnowControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-pixelsnow {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0a0e1c;
}
.knowledge-pixelsnow :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
