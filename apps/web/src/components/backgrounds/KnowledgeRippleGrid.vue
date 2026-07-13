<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import RippleGridControls from './RippleGridControls.vue'

// React Bits "RippleGrid" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 呼吸漣漪的發光網格 + 暗角淡出,可彩虹模式與游標漣漪)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface RippleGridConfig {
  gridColor: string
  enableRainbow: boolean
  rippleIntensity: number
  gridSize: number
  gridThickness: number
  glowIntensity: number
  gridRotation: number
  opacity: number
  enableMouseInteraction: boolean
}

interface Props {
  gridColor?: string
  enableRainbow?: boolean
  rippleIntensity?: number
  gridSize?: number
  gridThickness?: number
  fadeDistance?: number
  vignetteStrength?: number
  glowIntensity?: number
  opacity?: number
  gridRotation?: number
  enableMouseInteraction?: boolean
  mouseInteractionRadius?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  gridColor: '#5c7cba',
  enableRainbow: false,
  rippleIntensity: 0.05,
  gridSize: 10,
  gridThickness: 15,
  fadeDistance: 1.5,
  vignetteStrength: 2,
  glowIntensity: 0.1,
  opacity: 1,
  gridRotation: 0,
  enableMouseInteraction: false,
  mouseInteractionRadius: 1,
  showControls: false,
  class: '',
})

const cfg = reactive<RippleGridConfig>({
  gridColor: props.gridColor,
  enableRainbow: props.enableRainbow,
  rippleIntensity: props.rippleIntensity,
  gridSize: props.gridSize,
  gridThickness: props.gridThickness,
  glowIntensity: props.glowIntensity,
  gridRotation: props.gridRotation,
  opacity: props.opacity,
  enableMouseInteraction: props.enableMouseInteraction,
})

const emitCtl = defineEmits<{ controlsDone: [cfg: Record<string, unknown>]; controlsCancel: [] }>()
// 開面板時快照,取消=還原。
let cfgSnapshot: Record<string, unknown> | null = null
watch(() => props.showControls, (o) => {
  if (o) cfgSnapshot = JSON.parse(JSON.stringify(cfg))
})
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
const mousePos = { x: 0.5, y: 0.5 }
const targetMouse = { x: 0.5, y: 0.5 }
let mouseInfluence = 0

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAG = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;

float pi = 3.141592;

mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    float dist = length(uv);
    float func = sin(pi * (iTime - dist));
    vec2 rippleUv = uv + uv * func * rippleIntensity;

    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);

        float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));

        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
    }

    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    float aaWidth = 0.5;
    vec2 smoothB = vec2(
        smoothstep(0.0, aaWidth, b.x),
        smoothstep(0.0, aaWidth, b.y)
    );

    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }

    float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));

    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);

    vec3 t;
    if (enableRainbow) {
        t = vec3(
            uv.x * 0.5 + 0.5 * sin(iTime),
            uv.y * 0.5 + 0.5 * cos(iTime),
            pow(cos(iTime), 4.0)
        ) + 0.5;
    } else {
        t = gridColor;
    }

    float finalFade = ddd * vignette;
    float alpha = length(color) * finalFade * opacity;
    gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}`

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1]
}

const onPointerMove = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  targetMouse.x = (e.clientX - rect.left) / rect.width
  targetMouse.y = 1.0 - (e.clientY - rect.top) / rect.height
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
  mouseInfluence = inside ? 1.0 : 0.0
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program) return
  renderer.setSize(c.clientWidth, c.clientHeight)
  program.uniforms.iResolution.value = [c.clientWidth, c.clientHeight]
  if (reduceMotion) renderFrame(500)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  const u = program.uniforms
  u.iTime.value = t * 0.001
  u.enableRainbow.value = cfg.enableRainbow
  u.gridColor.value = hexToRgb(cfg.gridColor)
  u.rippleIntensity.value = cfg.rippleIntensity
  u.gridSize.value = cfg.gridSize
  u.gridThickness.value = cfg.gridThickness
  u.glowIntensity.value = cfg.glowIntensity
  u.opacity.value = cfg.opacity
  u.gridRotation.value = cfg.gridRotation
  u.mouseInteraction.value = cfg.enableMouseInteraction && !coarsePointer

  const lerp = 0.1
  mousePos.x += (targetMouse.x - mousePos.x) * lerp
  mousePos.y += (targetMouse.y - mousePos.y) * lerp
  u.mouseInfluence.value += (mouseInfluence - u.mouseInfluence.value) * 0.05
  u.mousePosition.value = [mousePos.x, mousePos.y]

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
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      enableRainbow: { value: cfg.enableRainbow },
      gridColor: { value: hexToRgb(cfg.gridColor) },
      rippleIntensity: { value: cfg.rippleIntensity },
      gridSize: { value: cfg.gridSize },
      gridThickness: { value: cfg.gridThickness },
      fadeDistance: { value: props.fadeDistance },
      vignetteStrength: { value: props.vignetteStrength },
      glowIntensity: { value: cfg.glowIntensity },
      opacity: { value: cfg.opacity },
      gridRotation: { value: cfg.gridRotation },
      mouseInteraction: { value: cfg.enableMouseInteraction },
      mousePosition: { value: [0.5, 0.5] },
      mouseInfluence: { value: 0 },
      mouseInteractionRadius: { value: props.mouseInteractionRadius },
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

  if (reduceMotion) renderFrame(500)
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
  <div ref="containerRef" class="knowledge-ripplegrid" :class="props.class" aria-hidden="true">
    <RippleGridControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-ripplegrid {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #060911;
}
.knowledge-ripplegrid :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
