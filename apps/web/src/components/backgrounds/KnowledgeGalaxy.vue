<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import GalaxyControls from './GalaxyControls.vue'

// React Bits "Galaxy" ported to Vue 3 (OGL + the official GLSL): procedural
// multi-layer star field, hashed stars with rays/twinkle, hue shift, mouse
// repulsion / parallax. Optional built-in control panel (show-controls) so the
// whole thing is a self-contained, extractable playground.
type Vec2 = [number, number]

export interface GalaxyConfig {
  starSpeed: number
  density: number
  hueShift: number
  disableAnimation: boolean
  speed: number
  mouseInteraction: boolean
  glowIntensity: number
  saturation: number
  mouseRepulsion: boolean
  repulsionStrength: number
  twinkleIntensity: number
  rotationSpeed: number
  autoCenterRepulsion: number
  /** Hex tint multiplied into every star's colour. '#ffffff' = neutral. */
  starTint: string
}

interface KnowledgeGalaxyProps extends Partial<GalaxyConfig> {
  focal?: Vec2
  rotation?: Vec2
  transparent?: boolean
  mouseSmoothing?: number
  maxDpr?: number
  maxRenderSize?: number
  mobileDensityScale?: number
  mobileSpeedScale?: number
  showControls?: boolean
  background?: string
  class?: string
}

const props = withDefaults(defineProps<KnowledgeGalaxyProps>(), {
  focal: () => [0.5, 0.5],
  rotation: () => [1.0, 0.0],
  starSpeed: 0.5,
  density: 1,
  hueShift: 140,
  disableAnimation: false,
  speed: 1,
  mouseInteraction: true,
  glowIntensity: 0.3,
  saturation: 0,
  mouseRepulsion: true,
  repulsionStrength: 2,
  twinkleIntensity: 0.3,
  rotationSpeed: 0.1,
  autoCenterRepulsion: 0,
  starTint: '#ffffff',
  transparent: true,
  mouseSmoothing: 0.05,
  maxDpr: 2,
  maxRenderSize: 1920,
  mobileDensityScale: 0.7,
  mobileSpeedScale: 0.8,
  showControls: false,
  class: '',
})

// Live, tweakable config (seeded from props). The control panel edits this.
const cfg = reactive<GalaxyConfig>({
  starSpeed: props.starSpeed,
  density: props.density,
  hueShift: props.hueShift,
  disableAnimation: props.disableAnimation,
  speed: props.speed,
  mouseInteraction: props.mouseInteraction,
  glowIntensity: props.glowIntensity,
  saturation: props.saturation,
  mouseRepulsion: props.mouseRepulsion,
  repulsionStrength: props.repulsionStrength,
  twinkleIntensity: props.twinkleIntensity,
  rotationSpeed: props.rotationSpeed,
  autoCenterRepulsion: props.autoCenterRepulsion,
  starTint: props.starTint,
})

// Follow prop-preset swaps at runtime (e.g. the login page gives each backdrop
// swatch its own star settings). Uniforms update in place — no context rebuild.
// The control panel still edits cfg directly on top of whatever preset is live.
watch(
  () => [props.density, props.starTint, props.glowIntensity, props.mouseInteraction, props.mouseRepulsion] as const,
  ([density, starTint, glowIntensity, mouseInteraction, mouseRepulsion]) => {
    cfg.density = density
    cfg.starTint = starTint
    cfg.glowIntensity = glowIntensity
    cfg.mouseInteraction = mouseInteraction
    cfg.mouseRepulsion = mouseRepulsion
  },
)

/** '#rrggbb' (or '#rgb') → [0..1, 0..1, 0..1] for the uStarTint uniform. */
function hexToRgb01(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return [1, 1, 1]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const containerRef = ref<HTMLDivElement | null>(null)
const hasWebGlError = ref(false)

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = window.matchMedia('(pointer: coarse)').matches
// 斥力(repulsion)也需要滑鼠座標——interaction 或 repulsion 任一開啟就追蹤,
// 否則「interaction=false + repulsion=true」會變成整個滑鼠互動死掉。
const mouseOn = () => (cfg.mouseInteraction || cfg.mouseRepulsion) && !coarsePointer
const densityScale = coarsePointer ? props.mobileDensityScale : 1
const speedScale = coarsePointer ? props.mobileSpeedScale : 1
const noLoop = () => reduceMotion && !props.showControls

/* eslint-disable @typescript-eslint/no-explicit-any */
let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null
let gl: any = null
let raf = 0
let start = 0
let visible = true
let onScreen = true
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null

const targetMouse = { x: 0.5, y: 0.5 }
const smoothMouse = { x: 0.5, y: 0.5 }
let targetActive = 0
let smoothActive = 0

const VERT = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform vec3 uStarTint;
uniform float uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform float uTransparent;
varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }
float tris(float x) { float t = fract(x); return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0)); }
float trisn(float x) { float t = fract(x); return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0; }
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = (0.05 * uGlowIntensity) / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uGlowIntensity;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uGlowIntensity;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}
vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + offset;
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;
      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);
      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));
      base *= uStarTint; // colour tint; white = neutral
      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
      float star = Star(gv - offset - pad, flareSize);
      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      star *= twinkle;
      col += star * size * base;
    }
  }
  return col;
}
void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;
  if (uAutoCenterRepulsion > 0.0) {
    float centerDist = length(uv);
    uv += normalize(uv) * (uAutoCenterRepulsion / (centerDist + 0.1)) * 0.05;
  } else if (uMouseRepulsion > 0.5) {
    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
    float mouseDist = length(uv - mousePosUV);
    uv += normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1)) * 0.05 * uMouseActiveFactor;
  } else {
    uv += (uMouse - vec2(0.5)) * 0.1 * uMouseActiveFactor;
  }
  float a = uTime * uRotationSpeed;
  uv = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv;
  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + i * 453.32) * fade;
  }
  if (uTransparent > 0.5) {
    float alpha = clamp(smoothstep(0.0, 0.3, length(col)), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  } else {
    gl_FragColor = vec4(col, 1.0);
  }
}
`

function effectiveDpr() {
  const c = containerRef.value
  let dpr = Math.min(window.devicePixelRatio || 1, props.maxDpr)
  if (c) {
    const maxSide = Math.max(c.clientWidth, c.clientHeight) * dpr
    if (maxSide > props.maxRenderSize) dpr *= props.maxRenderSize / maxSide
  }
  return dpr
}

function resize() {
  const c = containerRef.value
  if (!c || !renderer || !program) return
  renderer.dpr = effectiveDpr()
  renderer.setSize(c.clientWidth, c.clientHeight)
  program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height]
  if (noLoop()) renderOnce()
}

function syncUniforms() {
  if (!program) return
  const u = program.uniforms
  u.uDensity.value = cfg.density * densityScale
  u.uHueShift.value = cfg.hueShift
  u.uSpeed.value = cfg.speed * speedScale
  u.uGlowIntensity.value = cfg.glowIntensity
  u.uSaturation.value = cfg.saturation
  u.uStarTint.value = hexToRgb01(cfg.starTint)
  u.uTwinkleIntensity.value = cfg.twinkleIntensity
  u.uRotationSpeed.value = cfg.rotationSpeed
  u.uRepulsionStrength.value = cfg.repulsionStrength
  u.uAutoCenterRepulsion.value = cfg.autoCenterRepulsion
  u.uMouseRepulsion.value = cfg.mouseRepulsion && !coarsePointer ? 1 : 0
}

function renderOnce() {
  if (renderer && mesh) renderer.render({ scene: mesh })
}

function loop(now: number) {
  if (!start) start = now
  const elapsed = (now - start) / 1000
  if (program) {
    syncUniforms()
    smoothMouse.x += (targetMouse.x - smoothMouse.x) * props.mouseSmoothing
    smoothMouse.y += (targetMouse.y - smoothMouse.y) * props.mouseSmoothing
    smoothActive += (targetActive - smoothActive) * props.mouseSmoothing
    program.uniforms.uMouse.value = [smoothMouse.x, smoothMouse.y]
    program.uniforms.uMouseActiveFactor.value = smoothActive
    if (!cfg.disableAnimation && !reduceMotion) {
      program.uniforms.uTime.value = elapsed
      program.uniforms.uStarSpeed.value = (elapsed * cfg.starSpeed) / 10
    }
  }
  renderOnce()
  raf = requestAnimationFrame(loop)
}

function startLoop() {
  if (raf || noLoop() || !visible || !onScreen) return
  raf = requestAnimationFrame(loop)
}
function stopLoop() {
  cancelAnimationFrame(raf)
  raf = 0
}

function onPointerMove(e: PointerEvent) {
  const c = containerRef.value
  if (!c) return
  const r = c.getBoundingClientRect()
  targetMouse.x = (e.clientX - r.left) / r.width
  targetMouse.y = 1 - (e.clientY - r.top) / r.height
  // repulsion 也算互動——只看 mouseInteraction 會把斥力乘成 0。
  targetActive = cfg.mouseInteraction || cfg.mouseRepulsion ? 1 : 0
}
function onPointerLeave() {
  targetActive = 0
}
/** 滑鼠監聽依設定動態掛/卸(可在執行期切換,如登入頁 START 前禁互動)。 */
function syncMouseListeners() {
  const c = containerRef.value
  if (!c) return
  window.removeEventListener('pointermove', onPointerMove)
  c.removeEventListener('pointerleave', onPointerLeave)
  if (!coarsePointer && (cfg.mouseInteraction || cfg.mouseRepulsion || props.showControls)) {
    window.addEventListener('pointermove', onPointerMove)
    c.addEventListener('pointerleave', onPointerLeave)
  } else {
    targetActive = 0
  }
}
watch(() => [cfg.mouseInteraction, cfg.mouseRepulsion] as const, syncMouseListeners)
function onVisibility() {
  visible = document.visibilityState === 'visible'
  visible ? startLoop() : stopLoop()
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  try {
    renderer = new Renderer({ alpha: props.transparent, premultipliedAlpha: false })
    gl = renderer.gl
    gl.clearColor(0, 0, 0, props.transparent ? 0 : 1)
    if (props.transparent) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    }
    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [1, 1, 1] as number[] },
        uFocal: { value: [...props.focal] as number[] },
        uRotation: { value: [...props.rotation] as number[] },
        uStarSpeed: { value: 0 },
        uDensity: { value: cfg.density * densityScale },
        uHueShift: { value: cfg.hueShift },
        uSpeed: { value: cfg.speed * speedScale },
        uMouse: { value: [0.5, 0.5] as number[] },
        uGlowIntensity: { value: cfg.glowIntensity },
        uSaturation: { value: cfg.saturation },
        uStarTint: { value: hexToRgb01(cfg.starTint) },
        uMouseRepulsion: { value: cfg.mouseRepulsion ? 1 : 0 },
        uTwinkleIntensity: { value: cfg.twinkleIntensity },
        uRotationSpeed: { value: cfg.rotationSpeed },
        uRepulsionStrength: { value: cfg.repulsionStrength },
        uMouseActiveFactor: { value: 0 },
        uAutoCenterRepulsion: { value: cfg.autoCenterRepulsion },
        uTransparent: { value: props.transparent ? 1 : 0 },
      },
    })
    mesh = new Mesh(gl, { geometry: new Triangle(gl), program })
    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'
    c.appendChild(gl.canvas)
  } catch {
    hasWebGlError.value = true
    return
  }

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
    onScreen ? startLoop() : stopLoop()
  })
  io.observe(c)
  document.addEventListener('visibilitychange', onVisibility)
  syncMouseListeners()

  if (noLoop()) renderOnce()
  else startLoop()
})

onBeforeUnmount(() => {
  stopLoop()
  ro?.disconnect()
  io?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pointermove', onPointerMove)
  containerRef.value?.removeEventListener('pointerleave', onPointerLeave)
  if (gl?.canvas?.parentNode) gl.canvas.parentNode.removeChild(gl.canvas)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  renderer = null
  program = null
  mesh = null
  gl = null
})
</script>

<template>
  <div
    ref="containerRef"
    class="knowledge-galaxy"
    :class="props.class"
    :style="background ? { background } : undefined"
    aria-hidden="true"
  >
    <div v-if="hasWebGlError" class="knowledge-galaxy__fallback" />
    <GalaxyControls v-if="showControls" :config="cfg" />
  </div>
</template>

<style scoped>
.knowledge-galaxy {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  /* Blue nebula: bright blue core → deep space blue at the edges. */
  background:
    radial-gradient(ellipse 62% 52% at 50% 47%, rgba(130, 165, 255, 0.22), rgba(70, 105, 210, 0.09) 42%, transparent 70%),
    radial-gradient(circle at 50% 50%, #12224e 0%, #0b1636 36%, #070d24 64%, #03050f 100%);
}
.knowledge-galaxy :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
.knowledge-galaxy__fallback {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 45%, rgba(85, 214, 194, 0.12), transparent 30%),
    radial-gradient(circle at 70% 35%, rgba(124, 131, 253, 0.09), transparent 28%),
    #070a0f;
}
</style>
