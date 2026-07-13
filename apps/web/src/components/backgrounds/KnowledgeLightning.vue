<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import LightningControls from './LightningControls.vue'

// React Bits "Lightning" 移植到 Vue 3。原版是裸 WebGL 樣板,shader 與
// 框架無關,這裡改掛 ogl 全螢幕三角形(與其他活背景同骨架)。
// fbm 噪聲扭曲出的縱向閃電束,hue 可調。
export interface LightningConfig {
  hue: number
  xOffset: number
  speed: number
  intensity: number
  size: number
}

interface Props {
  hue?: number
  xOffset?: number
  speed?: number
  intensity?: number
  size?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  hue: 230,
  xOffset: 0,
  speed: 1,
  intensity: 1,
  size: 1,
  showControls: false,
  class: '',
})

const cfg = reactive<LightningConfig>({
  hue: props.hue,
  xOffset: props.xOffset,
  speed: props.speed,
  intensity: props.intensity,
  size: props.size,
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
}
`

const FRAG = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uHue;
uniform float uXOffset;
uniform float uSpeed;
uniform float uIntensity;
uniform float uSize;

#define OCTAVE_COUNT 10

vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

float hash11(float p) {
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 rotate2d(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat2(c, -s, s, c);
}

float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float a = hash12(ip);
    float b = hash12(ip + vec2(1.0, 0.0));
    float c = hash12(ip + vec2(0.0, 1.0));
    float d = hash12(ip + vec2(1.0, 1.0));

    vec2 t = smoothstep(0.0, 1.0, fp);
    return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVE_COUNT; ++i) {
        value += amplitude * noise(p);
        p *= rotate2d(0.45);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = 2.0 * uv - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    uv.x += uXOffset;

    uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;

    float dist = abs(uv.x);
    vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
    vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
    col = pow(col, vec3(1.0));
    float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    fragColor = vec4(col, a);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`

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
  program.uniforms.uHue.value = cfg.hue
  program.uniforms.uXOffset.value = cfg.xOffset
  program.uniforms.uSpeed.value = cfg.speed
  program.uniforms.uIntensity.value = cfg.intensity
  program.uniforms.uSize.value = cfg.size
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
      iResolution: { value: [1, 1] },
      iTime: { value: 0 },
      uHue: { value: cfg.hue },
      uXOffset: { value: cfg.xOffset },
      uSpeed: { value: cfg.speed },
      uIntensity: { value: cfg.intensity },
      uSize: { value: cfg.size },
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
  <div ref="containerRef" class="knowledge-lightning" :class="props.class" aria-hidden="true">
    <LightningControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-lightning {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #05070f;
}
.knowledge-lightning :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
