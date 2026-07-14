<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import PlasmaControls from './PlasmaControls.vue'

// React Bits "Plasma" ported verbatim to Vue 3(OGL + 官方 GLSL:
// raymarch 電漿流體,60 步迭代,tanh 色調映射;可染色/縮放/方向)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface PlasmaConfig {
  color: string
  speed: number
  scale: number
  opacity: number
  enableMouseInteraction: boolean
}

interface Props {
  color?: string
  speed?: number
  direction?: 'forward' | 'reverse' | 'pingpong'
  scale?: number
  opacity?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: '#6f8dd0',
  speed: 1,
  direction: 'forward',
  scale: 1,
  opacity: 0.8,
  enableMouseInteraction: false,
  showControls: false,
  class: '',
})

const cfg = reactive<PlasmaConfig>({
  color: props.color,
  speed: props.speed,
  scale: props.scale,
  opacity: props.opacity,
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
let t0 = 0

const VERT = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uCustomColor;
uniform float uUseCustomColor;
uniform float uSpeed;
uniform float uDirection;
uniform float uScale;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseInteractive;
out vec4 fragColor;

void mainImage(out vec4 o, vec2 C) {
  vec2 center = iResolution.xy * 0.5;
  C = (C - center) / uScale + center;

  vec2 mouseOffset = (uMouse - center) * 0.0002;
  C += mouseOffset * length(C - center) * step(0.5, uMouseInteractive);

  float i, d, z, T = iTime * uSpeed * uDirection;
  vec3 O, p, S;

  for (vec2 r = iResolution.xy, Q; ++i < 60.; O += o.w/d*o.xyz) {
    p = z*normalize(vec3(C-.5*r,r.y));
    p.z -= 4.;
    S = p;
    d = p.y-T;

    p.x += .4*(1.+p.y)*sin(d + p.x*0.1)*cos(.34*d + p.x*0.05);
    Q = p.xz *= mat2(cos(p.y+vec4(0,11,33,0)-T));
    z+= d = abs(sqrt(length(Q*Q)) - .25*(5.+S.y))/3.+8e-4;
    o = 1.+sin(S.y+p.z*.5+S.z-length(S-p)+vec4(2,1,0,8));
  }

  o.xyz = tanh(O/1e4);
}

bool finite1(float x){ return !(isnan(x) || isinf(x)); }
vec3 sanitize(vec3 c){
  return vec3(
    finite1(c.r) ? c.r : 0.0,
    finite1(c.g) ? c.g : 0.0,
    finite1(c.b) ? c.b : 0.0
  );
}

void main() {
  vec4 o = vec4(0.0);
  mainImage(o, gl_FragCoord.xy);
  vec3 rgb = sanitize(o.rgb);

  float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
  vec3 customColor = intensity * uCustomColor;
  vec3 finalColor = mix(rgb, customColor, step(0.5, uUseCustomColor));

  float alpha = length(rgb) * uOpacity;
  fragColor = vec4(finalColor, alpha);
}`

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return [1, 0.5, 0.2]
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

const onPointerMove = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c || !program || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  const m = program.uniforms.uMouse.value
  m[0] = e.clientX - rect.left
  m[1] = e.clientY - rect.top
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  const rect = c.getBoundingClientRect()
  renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)))
  const res = program.uniforms.iResolution.value
  res[0] = gl.drawingBufferWidth
  res[1] = gl.drawingBufferHeight
  if (reduceMotion) renderFrame(t0 + 3000)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  const timeValue = (t - t0) * 0.001
  if (props.direction === 'pingpong') {
    const dur = 10
    const seg = timeValue % dur
    const fwd = Math.floor(timeValue / dur) % 2 === 0
    const u = seg / dur
    const smooth = u * u * (3 - 2 * u)
    program.uniforms.uDirection.value = 1.0
    program.uniforms.iTime.value = fwd ? smooth * dur : (1 - smooth) * dur
  } else {
    program.uniforms.uDirection.value = props.direction === 'reverse' ? -1.0 : 1.0
    program.uniforms.iTime.value = timeValue
  }
  program.uniforms.uSpeed.value = cfg.speed * 0.4
  program.uniforms.uScale.value = cfg.scale
  program.uniforms.uOpacity.value = cfg.opacity
  program.uniforms.uCustomColor.value = new Float32Array(hexToRgb(cfg.color))
  program.uniforms.uMouseInteractive.value = cfg.enableMouseInteraction && !coarsePointer ? 1.0 : 0.0
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
  try {
    renderer = new Renderer({ webgl: 2, alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 2) })
  } catch {
    return
  }
  gl = renderer.gl
  if (!gl) return
  gl.canvas.style.display = 'block'
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      uCustomColor: { value: new Float32Array(hexToRgb(cfg.color)) },
      uUseCustomColor: { value: 1.0 },
      uSpeed: { value: cfg.speed * 0.4 },
      uDirection: { value: props.direction === 'reverse' ? -1.0 : 1.0 },
      uScale: { value: cfg.scale },
      uOpacity: { value: cfg.opacity },
      uMouse: { value: new Float32Array([0, 0]) },
      uMouseInteractive: { value: cfg.enableMouseInteraction ? 1.0 : 0.0 },
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

  t0 = performance.now()
  if (reduceMotion) renderFrame(t0 + 3000)
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
  <div ref="containerRef" class="knowledge-plasma" :class="props.class" aria-hidden="true">
    <PlasmaControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-plasma {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #060810;
}
.knowledge-plasma :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
