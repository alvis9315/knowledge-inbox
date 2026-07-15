<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import FloatingLinesControls from './FloatingLinesControls.vue'

// React Bits "FloatingLines" ported to Vue 3(three.js ShaderMaterial:
// 三段漂浮波線,滑鼠彎折 + 視差,3 色漸層)。
// 簡化說明:三段波固定全開,lineCount/lineDistance 用單值套三段
//(原版可逐段配置;app 背景用不到逐段微調)。
export interface FloatingLinesConfig {
  animationSpeed: number
  lineCount: number
  lineDistance: number
  bendRadius: number
  bendStrength: number
  color1: string
  color2: string
  color3: string
  enableMouseInteraction: boolean
}

interface Props {
  animationSpeed?: number
  lineCount?: number
  lineDistance?: number
  bendRadius?: number
  bendStrength?: number
  mouseDamping?: number
  parallaxStrength?: number
  color1?: string
  color2?: string
  color3?: string
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  animationSpeed: 1,
  lineCount: 6,
  lineDistance: 5,
  bendRadius: 5.0,
  bendStrength: -0.5,
  mouseDamping: 0.05,
  parallaxStrength: 0.2,
  color1: '#4a5f9e',
  color2: '#8a6fc8',
  color3: '#c86fb8',
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<FloatingLinesConfig>({
  animationSpeed: props.animationSpeed,
  lineCount: props.lineCount,
  lineDistance: props.lineDistance,
  bendRadius: props.bendRadius,
  bendStrength: props.bendStrength,
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

const MAX_GRADIENT_STOPS = 8
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let material: THREE.ShaderMaterial | null = null
let geometry: THREE.PlaneGeometry | null = null
// THREE.Clock 已於 three r185 棄用,改自算 elapsed
let startTime = 0
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
const targetMouse = new THREE.Vector2(-1000, -1000)
const currentMouse = new THREE.Vector2(-1000, -1000)
let targetInfluence = 0
let currentInfluence = 0
const targetParallax = new THREE.Vector2(0, 0)
const currentParallax = new THREE.Vector2(0, 0)

const VERT = `
precision highp float;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = `
precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform float animationSpeed;

uniform bool enableTop;
uniform bool enableMiddle;
uniform bool enableBottom;

uniform int topLineCount;
uniform int middleLineCount;
uniform int bottomLineCount;

uniform float topLineDistance;
uniform float middleLineDistance;
uniform float bottomLineDistance;

uniform vec3 topWavePosition;
uniform vec3 middleWavePosition;
uniform vec3 bottomWavePosition;

uniform vec2 iMouse;
uniform bool interactive;
uniform float bendRadius;
uniform float bendStrength;
uniform float bendInfluence;

uniform bool parallax;
uniform float parallaxStrength;
uniform vec2 parallaxOffset;

uniform vec3 lineGradient[8];
uniform int lineGradientCount;

const vec3 BLACK = vec3(0.0);
const vec3 PINK  = vec3(233.0, 71.0, 245.0) / 255.0;
const vec3 BLUE  = vec3(47.0,  75.0, 162.0) / 255.0;

mat2 rotate(float r) {
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}

vec3 background_color(vec2 uv) {
  vec3 col = vec3(0.0);

  float y = sin(uv.x - 0.2) * 0.3 - 0.1;
  float m = uv.y - y;

  col += mix(BLUE, BLACK, smoothstep(0.0, 1.0, abs(m)));
  col += mix(PINK, BLACK, smoothstep(0.0, 1.0, abs(m - 0.8)));
  return col * 0.5;
}

vec3 getLineColor(float t, vec3 baseColor) {
  if (lineGradientCount <= 0) {
    return baseColor;
  }

  vec3 gradientColor;
  
  if (lineGradientCount == 1) {
    gradientColor = lineGradient[0];
  } else {
    float clampedT = clamp(t, 0.0, 0.9999);
    float scaled = clampedT * float(lineGradientCount - 1);
    int idx = int(floor(scaled));
    float f = fract(scaled);
    int idx2 = min(idx + 1, lineGradientCount - 1);

    vec3 c1 = lineGradient[idx];
    vec3 c2 = lineGradient[idx2];
    
    gradientColor = mix(c1, c2, f);
  }
  
  return gradientColor * 0.5;
}

  float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv, bool shouldBend) {
  float time = iTime * animationSpeed;

  float x_offset   = offset;
  float x_movement = time * 0.1;
  float amp        = sin(offset + time * 0.2) * 0.3;
  float y          = sin(uv.x + x_offset + x_movement) * amp;

  if (shouldBend) {
    vec2 d = screenUv - mouseUv;
    float influence = exp(-dot(d, d) * bendRadius); // radial falloff around cursor
    float bendOffset = (mouseUv.y - screenUv.y) * influence * bendStrength * bendInfluence;
    y += bendOffset;
  }

  float m = uv.y - y;
  return 0.0175 / max(abs(m) + 0.01, 1e-3) + 0.01;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 baseUv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  baseUv.y *= -1.0;
  
  if (parallax) {
    baseUv += parallaxOffset;
  }

  vec3 col = vec3(0.0);

  vec3 b = lineGradientCount > 0 ? vec3(0.0) : background_color(baseUv);

  vec2 mouseUv = vec2(0.0);
  if (interactive) {
    mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
    mouseUv.y *= -1.0;
  }
  
  if (enableBottom) {
    for (int i = 0; i < bottomLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(bottomLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = bottomWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(bottomLineDistance * fi + bottomWavePosition.x, bottomWavePosition.y),
        1.5 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.2;
    }
  }

  if (enableMiddle) {
    for (int i = 0; i < middleLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(middleLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = middleWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(middleLineDistance * fi + middleWavePosition.x, middleWavePosition.y),
        2.0 + 0.15 * fi,
        baseUv,
        mouseUv,
        interactive
      );
    }
  }

  if (enableTop) {
    for (int i = 0; i < topLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(topLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = topWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      ruv.x *= -1.0;
      col += lineCol * wave(
        ruv + vec2(topLineDistance * fi + topWavePosition.x, topWavePosition.y),
        1.0 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.1;
    }
  }

  fragColor = vec4(col, 1.0);
}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`

const hexToVec3 = (hex: string) => {
  const h = hex.replace('#', '')
  return new THREE.Vector3(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

const onPointerMove = (e: PointerEvent) => {
  if (!renderer || !cfg.enableMouseInteraction) return
  const rect = renderer.domElement.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    targetInfluence = 0
    return
  }
  const dpr = renderer.getPixelRatio()
  targetMouse.set(x * dpr, (rect.height - y) * dpr)
  targetInfluence = 1.0
  targetParallax.set(
    ((x - rect.width / 2) / rect.width) * props.parallaxStrength,
    (-(y - rect.height / 2) / rect.height) * props.parallaxStrength,
  )
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !material) return
  renderer.setSize(c.clientWidth || 1, c.clientHeight || 1, false)
  material.uniforms.iResolution.value.set(renderer.domElement.width, renderer.domElement.height, 1)
  if (reduceMotion) renderFrame()
}

const renderFrame = () => {
  if (!renderer || !scene || !camera || !material) return
  const u = material.uniforms
  u.iTime.value = (performance.now() - startTime) * 0.001
  u.animationSpeed.value = cfg.animationSpeed
  u.topLineCount.value = cfg.lineCount
  u.middleLineCount.value = cfg.lineCount
  u.bottomLineCount.value = cfg.lineCount
  u.topLineDistance.value = cfg.lineDistance * 0.01
  u.middleLineDistance.value = cfg.lineDistance * 0.01
  u.bottomLineDistance.value = cfg.lineDistance * 0.01
  u.bendRadius.value = cfg.bendRadius
  u.bendStrength.value = cfg.bendStrength

  const stops = [cfg.color1, cfg.color2, cfg.color3].map(hexToVec3)
  u.lineGradientCount.value = stops.length
  for (let i = 0; i < stops.length; i++) (u.lineGradient.value[i] as THREE.Vector3).copy(stops[i])

  const interactive = cfg.enableMouseInteraction && !coarsePointer
  u.interactive.value = interactive
  if (interactive) {
    currentMouse.lerp(targetMouse, props.mouseDamping)
    u.iMouse.value.copy(currentMouse)
    currentInfluence += (targetInfluence - currentInfluence) * props.mouseDamping
    u.bendInfluence.value = currentInfluence
    currentParallax.lerp(targetParallax, props.mouseDamping)
    u.parallaxOffset.value.copy(currentParallax)
  }
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
  camera.position.z = 1

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })
  c.appendChild(renderer.domElement)

  material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      animationSpeed: { value: cfg.animationSpeed },
      enableTop: { value: true },
      enableMiddle: { value: true },
      enableBottom: { value: true },
      topLineCount: { value: cfg.lineCount },
      middleLineCount: { value: cfg.lineCount },
      bottomLineCount: { value: cfg.lineCount },
      topLineDistance: { value: cfg.lineDistance * 0.01 },
      middleLineDistance: { value: cfg.lineDistance * 0.01 },
      bottomLineDistance: { value: cfg.lineDistance * 0.01 },
      topWavePosition: { value: new THREE.Vector3(10.0, 0.5, -0.4) },
      middleWavePosition: { value: new THREE.Vector3(5.0, 0.0, 0.2) },
      bottomWavePosition: { value: new THREE.Vector3(2.0, -0.7, -1) },
      iMouse: { value: new THREE.Vector2(-1000, -1000) },
      interactive: { value: false },
      bendRadius: { value: cfg.bendRadius },
      bendStrength: { value: cfg.bendStrength },
      bendInfluence: { value: 0 },
      parallax: { value: true },
      parallaxStrength: { value: props.parallaxStrength },
      parallaxOffset: { value: new THREE.Vector2(0, 0) },
      lineGradient: { value: Array.from({ length: MAX_GRADIENT_STOPS }, () => new THREE.Vector3(1, 1, 1)) },
      lineGradientCount: { value: 0 },
    },
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
  if (!coarsePointer) window.addEventListener('pointermove', onPointerMove, { passive: true })

  if (reduceMotion) renderFrame()
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
  <div ref="containerRef" class="knowledge-floatinglines" :class="props.class" aria-hidden="true">
    <FloatingLinesControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-floatinglines {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #05060f;
}
.knowledge-floatinglines :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
