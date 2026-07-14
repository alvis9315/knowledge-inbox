<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import LightRaysControls from './LightRaysControls.vue'

// React Bits "LightRays" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 自指定錨點放射的體積光束,可脈動/噪點/扭曲/滑鼠導向)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export type RaysOrigin =
  | 'top-center' | 'top-left' | 'top-right'
  | 'left' | 'right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface LightRaysConfig {
  raysColor: string
  raysSpeed: number
  lightSpread: number
  rayLength: number
  pulsating: boolean
  noiseAmount: number
  distortion: number
  enableMouseInteraction: boolean
}

interface Props {
  raysOrigin?: RaysOrigin
  raysColor?: string
  raysSpeed?: number
  lightSpread?: number
  rayLength?: number
  pulsating?: boolean
  fadeDistance?: number
  saturation?: number
  mouseInfluence?: number
  noiseAmount?: number
  distortion?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  raysOrigin: 'top-center',
  raysColor: '#bcd6ff',
  raysSpeed: 1,
  lightSpread: 1,
  rayLength: 2,
  pulsating: false,
  fadeDistance: 1.0,
  saturation: 1.0,
  mouseInfluence: 0.1,
  noiseAmount: 0.05,
  distortion: 0.0,
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<LightRaysConfig>({
  raysColor: props.raysColor,
  raysSpeed: props.raysSpeed,
  lightSpread: props.lightSpread,
  rayLength: props.rayLength,
  pulsating: props.pulsating,
  noiseAmount: props.noiseAmount,
  distortion: props.distortion,
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
const mouse = { x: 0.5, y: 0.5 }
const smoothMouse = { x: 0.5, y: 0.5 }

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAG = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor  = color;
}`

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1]
}

const getAnchorAndDir = (origin: RaysOrigin, w: number, h: number) => {
  const outside = 0.2
  switch (origin) {
    case 'top-left': return { anchor: [0, -outside * h], dir: [0, 1] }
    case 'top-right': return { anchor: [w, -outside * h], dir: [0, 1] }
    case 'left': return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] }
    case 'right': return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] }
    case 'bottom-left': return { anchor: [0, (1 + outside) * h], dir: [0, -1] }
    case 'bottom-center': return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] }
    case 'bottom-right': return { anchor: [w, (1 + outside) * h], dir: [0, -1] }
    default: return { anchor: [0.5 * w, -outside * h], dir: [0, 1] }
  }
}

const onPointerMove = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  mouse.x = (e.clientX - rect.left) / rect.width
  mouse.y = (e.clientY - rect.top) / rect.height
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program) return
  renderer.setSize(c.clientWidth, c.clientHeight)
  const dpr = (renderer as any).dpr ?? 1
  const w = c.clientWidth * dpr
  const h = c.clientHeight * dpr
  program.uniforms.iResolution.value = [w, h]
  const { anchor, dir } = getAnchorAndDir(props.raysOrigin, w, h)
  program.uniforms.rayPos.value = anchor
  program.uniforms.rayDir.value = dir
  if (reduceMotion) renderFrame(700)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  const u = program.uniforms
  u.iTime.value = t * 0.001
  u.raysColor.value = hexToRgb(cfg.raysColor)
  u.raysSpeed.value = cfg.raysSpeed
  u.lightSpread.value = cfg.lightSpread
  u.rayLength.value = cfg.rayLength
  u.pulsating.value = cfg.pulsating ? 1.0 : 0.0
  u.noiseAmount.value = cfg.noiseAmount
  u.distortion.value = cfg.distortion

  const mouseOn = cfg.enableMouseInteraction && !coarsePointer
  u.mouseInfluence.value = mouseOn ? props.mouseInfluence : 0.0
  if (mouseOn) {
    const smoothing = 0.92
    smoothMouse.x = smoothMouse.x * smoothing + mouse.x * (1 - smoothing)
    smoothMouse.y = smoothMouse.y * smoothing + mouse.y * (1 - smoothing)
    u.mousePos.value = [smoothMouse.x, smoothMouse.y]
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
  renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true })
  gl = renderer.gl
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(cfg.raysColor) },
      raysSpeed: { value: cfg.raysSpeed },
      lightSpread: { value: cfg.lightSpread },
      rayLength: { value: cfg.rayLength },
      pulsating: { value: cfg.pulsating ? 1.0 : 0.0 },
      fadeDistance: { value: props.fadeDistance },
      saturation: { value: props.saturation },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: 0 },
      noiseAmount: { value: cfg.noiseAmount },
      distortion: { value: cfg.distortion },
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

  if (reduceMotion) renderFrame(700)
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
  <div ref="containerRef" class="knowledge-lightrays" :class="props.class" aria-hidden="true">
    <LightRaysControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-lightrays {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #05070d;
}
.knowledge-lightrays :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
