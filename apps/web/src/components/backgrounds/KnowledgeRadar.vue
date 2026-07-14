<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import RadarControls from './RadarControls.vue'

// React Bits "Radar" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 同心環 + 輻條 + 旋掃光的雷達盤)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface RadarConfig {
  speed: number
  scale: number
  ringCount: number
  spokeCount: number
  sweepSpeed: number
  brightness: number
  color: string
  bgColor: string
  enableMouseInteraction: boolean
}

interface Props {
  speed?: number
  scale?: number
  ringCount?: number
  spokeCount?: number
  ringThickness?: number
  spokeThickness?: number
  sweepSpeed?: number
  sweepWidth?: number
  sweepLobes?: number
  color?: string
  backgroundColor?: string
  falloff?: number
  brightness?: number
  enableMouseInteraction?: boolean
  mouseInfluence?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  speed: 1.0,
  scale: 0.5,
  ringCount: 10.0,
  spokeCount: 10.0,
  ringThickness: 0.05,
  spokeThickness: 0.01,
  sweepSpeed: 1.0,
  sweepWidth: 2.0,
  sweepLobes: 1.0,
  color: '#9f29ff',
  backgroundColor: '#05060d',
  falloff: 2.0,
  brightness: 1.0,
  enableMouseInteraction: false,
  mouseInfluence: 0.1,
  showControls: false,
  class: '',
})

const cfg = reactive<RadarConfig>({
  speed: props.speed,
  scale: props.scale,
  ringCount: props.ringCount,
  spokeCount: props.spokeCount,
  sweepSpeed: props.sweepSpeed,
  brightness: props.brightness,
  color: props.color,
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
uniform float uScale;
uniform float uRingCount;
uniform float uSpokeCount;
uniform float uRingThickness;
uniform float uSpokeThickness;
uniform float uSweepSpeed;
uniform float uSweepWidth;
uniform float uSweepLobes;
uniform vec3 uColor;
uniform vec3 uBgColor;
uniform float uFalloff;
uniform float uBrightness;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define TAU 6.28318530718
#define PI 3.14159265359

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  st = st * 2.0 - 1.0;
  st.x *= uResolution.x / uResolution.y;

  if (uEnableMouse) {
    vec2 mShift = (uMouse * 2.0 - 1.0);
    mShift.x *= uResolution.x / uResolution.y;
    st -= mShift * uMouseInfluence;
  }

  st *= uScale;

  float dist = length(st);
  float theta = atan(st.y, st.x);
  float t = uTime * uSpeed;

  float ringPhase = dist * uRingCount - t;
  float ringDist = abs(fract(ringPhase) - 0.5);
  float ringGlow = 1.0 - smoothstep(0.0, uRingThickness, ringDist);

  float spokeAngle = abs(fract(theta * uSpokeCount / TAU + 0.5) - 0.5) * TAU / uSpokeCount;
  float arcDist = spokeAngle * dist;
  float spokeGlow = (1.0 - smoothstep(0.0, uSpokeThickness, arcDist)) * smoothstep(0.0, 0.1, dist);

  float sweepPhase = t * uSweepSpeed;
  float sweepBeam = pow(max(0.5 * sin(uSweepLobes * theta + sweepPhase) + 0.5, 0.0), uSweepWidth);

  float fade = smoothstep(1.05, 0.85, dist) * pow(max(1.0 - dist, 0.0), uFalloff);

  float intensity = max((ringGlow + spokeGlow + sweepBeam) * fade * uBrightness, 0.0);
  vec3 col = uColor * intensity + uBgColor;

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
  program.uniforms.uScale.value = cfg.scale
  program.uniforms.uRingCount.value = cfg.ringCount
  program.uniforms.uSpokeCount.value = cfg.spokeCount
  program.uniforms.uSweepSpeed.value = cfg.sweepSpeed
  program.uniforms.uBrightness.value = cfg.brightness
  program.uniforms.uColor.value = hexToVec3(cfg.color)
  program.uniforms.uBgColor.value = hexToVec3(cfg.bgColor)
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
      uScale: { value: cfg.scale },
      uRingCount: { value: cfg.ringCount },
      uSpokeCount: { value: cfg.spokeCount },
      uRingThickness: { value: props.ringThickness },
      uSpokeThickness: { value: props.spokeThickness },
      uSweepSpeed: { value: cfg.sweepSpeed },
      uSweepWidth: { value: props.sweepWidth },
      uSweepLobes: { value: props.sweepLobes },
      uColor: { value: hexToVec3(cfg.color) },
      uBgColor: { value: hexToVec3(cfg.bgColor) },
      uFalloff: { value: props.falloff },
      uBrightness: { value: cfg.brightness },
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
  <div ref="containerRef" class="knowledge-radar" :class="props.class" aria-hidden="true">
    <RadarControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-radar {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #05060d;
}
.knowledge-radar :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
