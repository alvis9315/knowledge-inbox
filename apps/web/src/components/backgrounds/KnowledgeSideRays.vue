<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import SideRaysControls from './SideRaysControls.vue'

// React Bits "SideRays" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 從角落斜射的雙色光芒,可調強度/擴散/傾斜)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export type SideRaysOrigin = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

export interface SideRaysConfig {
  speed: number
  rayColor1: string
  rayColor2: string
  intensity: number
  spread: number
  tilt: number
  opacity: number
}

interface Props {
  speed?: number
  rayColor1?: string
  rayColor2?: string
  intensity?: number
  spread?: number
  origin?: SideRaysOrigin
  tilt?: number
  saturation?: number
  blend?: number
  falloff?: number
  opacity?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  speed: 2.5,
  rayColor1: '#EAB308',
  rayColor2: '#96c8ff',
  intensity: 1.4,
  spread: 2,
  origin: 'top-right',
  tilt: 0,
  saturation: 1.5,
  blend: 0.75,
  falloff: 1.6,
  opacity: 0.9,
  showControls: false,
  class: '',
})

const ORIGIN_FLIP: Record<SideRaysOrigin, [number, number]> = {
  'top-right': [0, 0],
  'top-left': [1, 0],
  'bottom-right': [0, 1],
  'bottom-left': [1, 1],
}

const cfg = reactive<SideRaysConfig>({
  speed: props.speed,
  rayColor1: props.rayColor1,
  rayColor2: props.rayColor2,
  intensity: props.intensity,
  spread: props.spread,
  tilt: props.tilt,
  opacity: props.opacity,
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

/* eslint-disable @typescript-eslint/no-explicit-any */
let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null
let gl: any = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let start = 0

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAG = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1]
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program) return
  renderer.setSize(c.clientWidth, c.clientHeight)
  program.uniforms.iResolution.value = [gl.canvas.width, gl.canvas.height]
  if (reduceMotion) renderFrame()
}

const renderFrame = () => {
  if (!renderer || !program || !mesh) return
  program.uniforms.iTime.value = (performance.now() - start) / 1000
  program.uniforms.iSpeed.value = cfg.speed
  program.uniforms.iRayColor1.value = hexToRgb(cfg.rayColor1)
  program.uniforms.iRayColor2.value = hexToRgb(cfg.rayColor2)
  program.uniforms.iIntensity.value = cfg.intensity
  program.uniforms.iSpread.value = cfg.spread
  program.uniforms.iTilt.value = cfg.tilt
  program.uniforms.iOpacity.value = cfg.opacity
  renderer.render({ scene: mesh })
}

const loop = () => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  renderFrame()
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
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      iSpeed: { value: cfg.speed },
      iRayColor1: { value: hexToRgb(cfg.rayColor1) },
      iRayColor2: { value: hexToRgb(cfg.rayColor2) },
      iIntensity: { value: cfg.intensity },
      iSpread: { value: cfg.spread },
      iFlipX: { value: ORIGIN_FLIP[props.origin][0] },
      iFlipY: { value: ORIGIN_FLIP[props.origin][1] },
      iTilt: { value: cfg.tilt },
      iSaturation: { value: props.saturation },
      iBlend: { value: props.blend },
      iFalloff: { value: props.falloff },
      iOpacity: { value: cfg.opacity },
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

  start = performance.now()
  if (reduceMotion) renderFrame()
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
  <div ref="containerRef" class="knowledge-siderays" :class="props.class" aria-hidden="true">
    <SideRaysControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-siderays {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #070809;
}
.knowledge-siderays :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
