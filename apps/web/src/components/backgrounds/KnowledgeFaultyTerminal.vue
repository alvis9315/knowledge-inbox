<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import FaultyTerminalControls from './FaultyTerminalControls.vue'

// React Bits "FaultyTerminal" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 故障終端機數字雨 + 掃描線/色差/彎曲/進場動畫)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface FaultyTerminalConfig {
  scale: number
  digitSize: number
  timeScale: number
  scanlineIntensity: number
  glitchAmount: number
  curvature: number
  brightness: number
  tint: string
  enableMouseInteraction: boolean
}

interface Props {
  scale?: number
  gridMul?: [number, number]
  digitSize?: number
  timeScale?: number
  scanlineIntensity?: number
  glitchAmount?: number
  flickerAmount?: number
  noiseAmp?: number
  chromaticAberration?: number
  dither?: number
  curvature?: number
  tint?: string
  enableMouseInteraction?: boolean
  mouseStrength?: number
  pageLoadAnimation?: boolean
  brightness?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  scale: 1,
  gridMul: () => [2, 1],
  digitSize: 1.5,
  timeScale: 0.3,
  scanlineIntensity: 0.3,
  glitchAmount: 1,
  flickerAmount: 1,
  noiseAmp: 0,
  chromaticAberration: 0,
  dither: 0,
  curvature: 0.2,
  tint: '#7bffa0',
  enableMouseInteraction: false,
  mouseStrength: 0.2,
  pageLoadAnimation: true,
  brightness: 0.8,
  showControls: false,
  class: '',
})

const cfg = reactive<FaultyTerminalConfig>({
  scale: props.scale,
  digitSize: props.digitSize,
  timeScale: props.timeScale,
  scanlineIntensity: props.scanlineIntensity,
  glitchAmount: props.glitchAmount,
  curvature: props.curvature,
  brightness: props.brightness,
  tint: props.tint,
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
let loadAnimStart = 0
const timeOffset = Math.random() * 100
const mouse = { x: 0.5, y: 0.5 }
const smoothMouse = { x: 0.5, y: 0.5 }

const VERT = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;

uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2; 
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;
  
  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;
  
  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;
  
  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);
  
  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);
  
  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
    vec2 grid = uGridMul * 15.0;
    vec2 s = floor(p * grid) / grid;
    p = p * grid;
    vec2 q, r;
    float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;
    
    if(uUseMouse > 0.5){
        vec2 mouseWorld = uMouse * uScale;
        float distToMouse = distance(s, mouseWorld);
        float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
        intensity += mouseInfluence;
        
        float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
        intensity += ripple;
    }
    
    if(uUsePageLoadAnimation > 0.5){
        float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
        float cellDelay = cellRandom * 0.8;
        float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);
        
        float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
        intensity *= fadeAlpha;
    }
    
    p = fract(p);
    p *= uDigitSize;
    
    float px5 = p.x * 5.0;
    float py5 = (1.0 - p.y) * 5.0;
    float x = fract(px5);
    float y = fract(py5);
    
    float i = floor(py5) - 2.0;
    float j = floor(px5) - 2.0;
    float n = i * i + j * j;
    float f = n * 0.0625;
    
    float isOn = step(0.1, intensity - f);
    float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);
    
    return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
    float y = look.y - mod(iTime * 0.25, 1.0);
    float window = 1.0 / (1.0 + 50.0 * y * y);
    return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){
    
    float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
    bar *= uScanlineIntensity;
    
    float displacement = displace(p);
    p.x += displacement;

    if (uGlitchAmount != 1.0) {
      float extra = displacement * (uGlitchAmount - 1.0);
      p.x += extra;
    }

    float middle = digit(p);
    
    const float off = 0.002;
    float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));
    
    vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
    return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
    time = iTime * 0.333333;
    vec2 uv = vUv;

    if(uCurvature != 0.0){
      uv = barrel(uv);
    }
    
    vec2 p = uv * uScale;
    vec3 col = getColor(p);

    if(uChromaticAberration != 0.0){
      vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
      col.r = getColor(p + ca).r;
      col.b = getColor(p - ca).b;
    }

    col *= uTint;
    col *= uBrightness;

    if(uDither > 0.0){
      float rnd = hash21(gl_FragCoord.xy);
      col += (rnd - 0.5) * (uDither * 0.003922);
    }

    gl_FragColor = vec4(col, 1.0);
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

const onMouseMove = (e: MouseEvent) => {
  const c = containerRef.value
  if (!c || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  mouse.x = (e.clientX - rect.left) / rect.width
  mouse.y = 1 - (e.clientY - rect.top) / rect.height
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  renderer.setSize(c.offsetWidth, c.offsetHeight)
  const res = program.uniforms.iResolution.value
  res.r = gl.canvas.width
  res.g = gl.canvas.height
  res.b = gl.canvas.width / gl.canvas.height
  if (reduceMotion) renderFrame(performance.now())
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  const u = program.uniforms
  if (props.pageLoadAnimation && loadAnimStart === 0) loadAnimStart = t
  u.iTime.value = (t * 0.001 + timeOffset) * cfg.timeScale
  if (props.pageLoadAnimation && loadAnimStart > 0) {
    u.uPageLoadProgress.value = Math.min((t - loadAnimStart) / 2000, 1)
  }
  u.uScale.value = cfg.scale
  u.uDigitSize.value = cfg.digitSize
  u.uScanlineIntensity.value = cfg.scanlineIntensity
  u.uGlitchAmount.value = cfg.glitchAmount
  u.uCurvature.value = cfg.curvature
  u.uBrightness.value = cfg.brightness
  const tv = hexToVec3(cfg.tint)
  u.uTint.value.set(tv[0], tv[1], tv[2])
  const mouseOn = cfg.enableMouseInteraction && !coarsePointer
  u.uUseMouse.value = mouseOn ? 1 : 0
  if (mouseOn) {
    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.08
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.08
    u.uMouse.value[0] = smoothMouse.x
    u.uMouse.value[1] = smoothMouse.y
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
  renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2) })
  gl = renderer.gl
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  const tv = hexToVec3(cfg.tint)
  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Color(1, 1, 1) },
      uScale: { value: cfg.scale },
      uGridMul: { value: new Float32Array(props.gridMul) },
      uDigitSize: { value: cfg.digitSize },
      uScanlineIntensity: { value: cfg.scanlineIntensity },
      uGlitchAmount: { value: cfg.glitchAmount },
      uFlickerAmount: { value: props.flickerAmount },
      uNoiseAmp: { value: props.noiseAmp },
      uChromaticAberration: { value: props.chromaticAberration },
      uDither: { value: props.dither ? 1 : 0 },
      uCurvature: { value: cfg.curvature },
      uTint: { value: new Color(tv[0], tv[1], tv[2]) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseStrength: { value: props.mouseStrength },
      uUseMouse: { value: 0 },
      uPageLoadProgress: { value: props.pageLoadAnimation ? 0 : 1 },
      uUsePageLoadAnimation: { value: props.pageLoadAnimation ? 1 : 0 },
      uBrightness: { value: cfg.brightness },
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
  if (!coarsePointer) window.addEventListener('mousemove', onMouseMove)

  if (reduceMotion) renderFrame(performance.now() + 2200)
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  if (gl?.canvas?.parentNode) gl.canvas.parentNode.removeChild(gl.canvas)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  renderer = null
  program = null
  mesh = null
  gl = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-faultyterminal" :class="props.class" aria-hidden="true">
    <FaultyTerminalControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-faultyterminal {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #030503;
}
.knowledge-faultyterminal :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
