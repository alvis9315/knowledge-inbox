<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import PrismControls from './PrismControls.vue'

// React Bits "Prism" ported verbatim to Vue 3(OGL raymarch 稜鏡:
// 全息色散 + 三種動畫模式 rotate/3drotate/hover)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export type PrismAnimation = 'rotate' | '3drotate' | 'hover'

export interface PrismConfig {
  height: number
  baseWidth: number
  glow: number
  noise: number
  scale: number
  hueShift: number
  colorFrequency: number
  bloom: number
  timeScale: number
  animationType: PrismAnimation
}

interface Props {
  height?: number
  baseWidth?: number
  animationType?: PrismAnimation
  glow?: number
  noise?: number
  transparent?: boolean
  scale?: number
  hueShift?: number
  colorFrequency?: number
  hoverStrength?: number
  inertia?: number
  bloom?: number
  timeScale?: number
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: 3.5,
  baseWidth: 5.5,
  animationType: 'rotate',
  glow: 1,
  noise: 0.3,
  transparent: true,
  scale: 3.6,
  hueShift: 0,
  colorFrequency: 1,
  hoverStrength: 2,
  inertia: 0.05,
  bloom: 1,
  timeScale: 0.5,
  showControls: false,
  class: '',
})

const cfg = reactive<PrismConfig>({
  height: props.height,
  baseWidth: props.baseWidth,
  glow: props.glow,
  noise: props.noise,
  scale: props.scale,
  hueShift: props.hueShift,
  colorFrequency: props.colorFrequency,
  bloom: props.bloom,
  timeScale: props.timeScale,
  animationType: props.animationType,
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
let yaw = 0
let pitch = 0
let roll = 0
let targetYaw = 0
let targetPitch = 0
const rotBuf = new Float32Array(9)
const iResBuf = new Float32Array(2)
const offsetPxBuf = new Float32Array([0, 0])
const pointer = { x: 0, y: 0, inside: true }
// 3drotate 的隨機角速度(掛載時擲一次,原版同款)
const wX = 0.3 + Math.random() * 0.6
const wY = 0.2 + Math.random() * 0.7
const wZ = 0.1 + Math.random() * 0.5
const phX = Math.random() * Math.PI * 2
const phZ = Math.random() * Math.PI * 2

const VERT = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

const FRAG = `
      precision highp float;

      uniform vec2  iResolution;
      uniform float iTime;

      uniform float uHeight;
      uniform float uBaseHalf;
      uniform mat3  uRot;
      uniform int   uUseBaseWobble;
      uniform float uGlow;
      uniform vec2  uOffsetPx;
      uniform float uNoise;
      uniform float uSaturation;
      uniform float uScale;
      uniform float uHueShift;
      uniform float uColorFreq;
      uniform float uBloom;
      uniform float uCenterShift;
      uniform float uInvBaseHalf;
      uniform float uInvHeight;
      uniform float uMinAxis;
      uniform float uPxScale;
      uniform float uTimeScale;

      vec4 tanh4(vec4 x){
        vec4 e2x = exp(2.0*x);
        return (e2x - 1.0) / (e2x + 1.0);
      }

      float rand(vec2 co){
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      float sdOctaAnisoInv(vec3 p){
        vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
        float m = q.x + q.y + q.z - 1.0;
        return m * uMinAxis * 0.5773502691896258;
      }

      float sdPyramidUpInv(vec3 p){
        float oct = sdOctaAnisoInv(p);
        float halfSpace = -p.y;
        return max(oct, halfSpace);
      }

      mat3 hueRotation(float a){
        float c = cos(a), s = sin(a);
        mat3 W = mat3(
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114
        );
        mat3 U = mat3(
           0.701, -0.587, -0.114,
          -0.299,  0.413, -0.114,
          -0.300, -0.588,  0.886
        );
        mat3 V = mat3(
           0.168, -0.331,  0.500,
           0.328,  0.035, -0.500,
          -0.497,  0.296,  0.201
        );
        return W + U * c + V * s;
      }

      void main(){
        vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;

        float z = 5.0;
        float d = 0.0;

        vec3 p;
        vec4 o = vec4(0.0);

        float centerShift = uCenterShift;
        float cf = uColorFreq;

        mat2 wob = mat2(1.0);
        if (uUseBaseWobble == 1) {
          float t = iTime * uTimeScale;
          float c0 = cos(t + 0.0);
          float c1 = cos(t + 33.0);
          float c2 = cos(t + 11.0);
          wob = mat2(c0, c1, c2, c0);
        }

        const int STEPS = 100;
        for (int i = 0; i < STEPS; i++) {
          p = vec3(f, z);
          p.xz = p.xz * wob;
          p = uRot * p;
          vec3 q = p;
          q.y += centerShift;
          d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
          z -= d;
          o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
        }

        o = tanh4(o * o * (uGlow * uBloom) / 1e5);

        vec3 col = o.rgb;
        float n = rand(gl_FragCoord.xy + vec2(iTime));
        col += (n - 0.5) * uNoise;
        col = clamp(col, 0.0, 1.0);

        float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

        if(abs(uHueShift) > 0.0001){
          col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
        }

        gl_FragColor = vec4(col, o.a);
      }
    `

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const setMat3FromEuler = (yawY: number, pitchX: number, rollZ: number, out: Float32Array) => {
  const cy = Math.cos(yawY)
  const sy = Math.sin(yawY)
  const cx = Math.cos(pitchX)
  const sx = Math.sin(pitchX)
  const cz = Math.cos(rollZ)
  const sz = Math.sin(rollZ)
  out[0] = cy * cz + sy * sx * sz
  out[1] = cx * sz
  out[2] = -sy * cz + cy * sx * sz
  out[3] = -cy * sz + sy * sx * cz
  out[4] = cx * cz
  out[5] = sy * sz + cy * sx * cz
  out[6] = sy * cx
  out[7] = -sx
  out[8] = cy * cx
  return out
}

const onPointerMove = (e: PointerEvent) => {
  if (cfg.animationType !== 'hover') return
  const ww = Math.max(1, window.innerWidth)
  const wh = Math.max(1, window.innerHeight)
  pointer.x = Math.max(-1, Math.min(1, (e.clientX - ww * 0.5) / (ww * 0.5)))
  pointer.y = Math.max(-1, Math.min(1, (e.clientY - wh * 0.5) / (wh * 0.5)))
  pointer.inside = true
}
const onLeave = () => (pointer.inside = false)

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  renderer.setSize(c.clientWidth || 1, c.clientHeight || 1)
  iResBuf[0] = gl.drawingBufferWidth
  iResBuf[1] = gl.drawingBufferHeight
  program.uniforms.uPxScale.value = 1 / ((gl.drawingBufferHeight || 1) * 0.1 * Math.max(0.001, cfg.scale))
  if (reduceMotion) renderFrame(t0 + 1000)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  const time = (t - t0) * 0.001
  const u = program.uniforms
  const H = Math.max(0.001, cfg.height)
  const BASE_HALF = Math.max(0.001, cfg.baseWidth) * 0.5
  u.iTime.value = time
  u.uHeight.value = H
  u.uBaseHalf.value = BASE_HALF
  u.uCenterShift.value = H * 0.25
  u.uInvBaseHalf.value = 1 / BASE_HALF
  u.uInvHeight.value = 1 / H
  u.uMinAxis.value = Math.min(BASE_HALF, H)
  u.uGlow.value = Math.max(0, cfg.glow)
  u.uNoise.value = Math.max(0, cfg.noise)
  u.uHueShift.value = cfg.hueShift
  u.uColorFreq.value = Math.max(0, cfg.colorFrequency)
  u.uBloom.value = Math.max(0, cfg.bloom)
  u.uScale.value = Math.max(0.001, cfg.scale)
  u.uPxScale.value = 1 / ((gl.drawingBufferHeight || 1) * 0.1 * Math.max(0.001, cfg.scale))

  const TS = Math.max(0, cfg.timeScale)
  const mode = cfg.animationType
  if (mode === 'hover' && !coarsePointer) {
    u.uUseBaseWobble.value = 0
    const HOVSTR = Math.max(0, props.hoverStrength)
    const INERT = Math.max(0, Math.min(1, props.inertia))
    targetYaw = (pointer.inside ? -pointer.x : 0) * 0.6 * HOVSTR
    targetPitch = (pointer.inside ? pointer.y : 0) * 0.6 * HOVSTR
    yaw = lerp(yaw, targetYaw, INERT)
    pitch = lerp(pitch, targetPitch, INERT)
    roll = lerp(roll, 0, 0.1)
    u.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf)
  } else if (mode === '3drotate') {
    u.uUseBaseWobble.value = 0
    const tScaled = time * TS
    yaw = tScaled * wY
    pitch = Math.sin(tScaled * wX + phX) * 0.6
    roll = Math.sin(tScaled * wZ + phZ) * 0.5
    u.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf)
  } else {
    u.uUseBaseWobble.value = 1
    rotBuf.set([1, 0, 0, 0, 1, 0, 0, 0, 1])
    u.uRot.value = rotBuf
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
  renderer = new Renderer({ dpr: Math.min(2, window.devicePixelRatio || 1), alpha: props.transparent, antialias: false })
  gl = renderer.gl
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.CULL_FACE)
  gl.disable(gl.BLEND)
  Object.assign(gl.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
  c.appendChild(gl.canvas)

  const H = Math.max(0.001, cfg.height)
  const BASE_HALF = Math.max(0.001, cfg.baseWidth) * 0.5
  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      iResolution: { value: iResBuf },
      iTime: { value: 0 },
      uHeight: { value: H },
      uBaseHalf: { value: BASE_HALF },
      uUseBaseWobble: { value: 1 },
      uRot: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) },
      uGlow: { value: cfg.glow },
      uOffsetPx: { value: offsetPxBuf },
      uNoise: { value: cfg.noise },
      uSaturation: { value: props.transparent ? 1.5 : 1 },
      uScale: { value: cfg.scale },
      uHueShift: { value: cfg.hueShift },
      uColorFreq: { value: cfg.colorFrequency },
      uBloom: { value: cfg.bloom },
      uCenterShift: { value: H * 0.25 },
      uInvBaseHalf: { value: 1 / BASE_HALF },
      uInvHeight: { value: 1 / H },
      uMinAxis: { value: Math.min(BASE_HALF, H) },
      uPxScale: { value: 1 },
      uTimeScale: { value: cfg.timeScale },
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
  if (!coarsePointer) {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('mouseleave', onLeave)
  }

  t0 = performance.now()
  if (reduceMotion) renderFrame(t0 + 1000)
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('mouseleave', onLeave)
  if (gl?.canvas?.parentNode) gl.canvas.parentNode.removeChild(gl.canvas)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  renderer = null
  program = null
  mesh = null
  gl = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-prism" :class="props.class" aria-hidden="true">
    <PrismControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-prism {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #060510;
}
.knowledge-prism :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
