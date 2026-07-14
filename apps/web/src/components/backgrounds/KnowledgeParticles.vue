<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Camera, Geometry, Mesh, Program, Renderer } from 'ogl'
import ParticlesControls from './ParticlesControls.vue'

// React Bits "Particles" ported verbatim to Vue 3(OGL 點雲:球內均勻散佈、
// 正弦漂移、慢速旋轉,可調顆數/大小/擴散/三色盤)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export interface ParticlesConfig {
  particleCount: number
  particleSpread: number
  speed: number
  particleBaseSize: number
  alphaParticles: boolean
  enableMouseInteraction: boolean
  color1: string
  color2: string
  color3: string
}

interface Props {
  particleCount?: number
  particleSpread?: number
  speed?: number
  particleBaseSize?: number
  sizeRandomness?: number
  cameraDistance?: number
  disableRotation?: boolean
  alphaParticles?: boolean
  enableMouseInteraction?: boolean
  particleHoverFactor?: number
  color1?: string
  color2?: string
  color3?: string
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  particleCount: 200,
  particleSpread: 10,
  speed: 0.1,
  particleBaseSize: 100,
  sizeRandomness: 1,
  cameraDistance: 20,
  disableRotation: false,
  alphaParticles: true,
  enableMouseInteraction: false,
  particleHoverFactor: 1,
  color1: '#cfe0ff',
  color2: '#9db8e8',
  color3: '#ffffff',
  showControls: false,
  class: '',
})

const cfg = reactive<ParticlesConfig>({
  particleCount: props.particleCount,
  particleSpread: props.particleSpread,
  speed: props.speed,
  particleBaseSize: props.particleBaseSize,
  alphaParticles: props.alphaParticles,
  enableMouseInteraction: props.enableMouseInteraction,
  color1: props.color1,
  color2: props.color2,
  color3: props.color3,
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
let camera: Camera | null = null
let program: Program | null = null
let particles: Mesh | null = null
let gl: any = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let lastTime = 0
let elapsed = 0
const mouse = { x: 0, y: 0 }

const VERT = `
attribute vec3 position;
attribute vec4 random;
attribute vec3 color;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uSpread;
uniform float uBaseSize;
uniform float uSizeRandomness;

varying vec4 vRandom;
varying vec3 vColor;

void main() {
  vRandom = random;
  vColor = color;

  vec3 pos = position * uSpread;
  pos.z *= 10.0;

  vec4 mPos = modelMatrix * vec4(pos, 1.0);
  float t = uTime;
  mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
  mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
  mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

  vec4 mvPos = viewMatrix * mPos;

  if (uSizeRandomness == 0.0) {
    gl_PointSize = uBaseSize;
  } else {
    gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
  }

  gl_Position = projectionMatrix * mvPos;
}
`

const FRAG = `
precision highp float;

uniform float uTime;
uniform float uAlphaParticles;
varying vec4 vRandom;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord.xy;
  float d = length(uv - vec2(0.5));

  if(uAlphaParticles < 0.5) {
    if(d > 0.5) {
      discard;
    }
    gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
  } else {
    float circle = smoothstep(0.5, 0.4, d) * 0.8;
    gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
  }
}
`

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

// 顆數 / 色盤改變需要重建 geometry(點雲屬性是一次性 buffer)。
const buildParticles = () => {
  if (!gl || !program) return
  const count = cfg.particleCount
  const positions = new Float32Array(count * 3)
  const randoms = new Float32Array(count * 4)
  const colors = new Float32Array(count * 3)
  const palette = [cfg.color1, cfg.color2, cfg.color3]

  for (let i = 0; i < count; i++) {
    let x: number, y: number, z: number, len: number
    do {
      x = Math.random() * 2 - 1
      y = Math.random() * 2 - 1
      z = Math.random() * 2 - 1
      len = x * x + y * y + z * z
    } while (len > 1 || len === 0)
    const r = Math.cbrt(Math.random())
    positions.set([x * r, y * r, z * r], i * 3)
    randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    colors.set(hexToRgb(palette[Math.floor(Math.random() * palette.length)]), i * 3)
  }

  const geometry = new Geometry(gl, {
    position: { size: 3, data: positions },
    random: { size: 4, data: randoms },
    color: { size: 3, data: colors },
  })
  particles = new Mesh(gl, { mode: gl.POINTS, geometry, program })
}
watch(() => [cfg.particleCount, cfg.color1, cfg.color2, cfg.color3], () => {
  buildParticles()
  if (reduceMotion) renderFrame(lastTime)
})

const onPointerMove = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !camera || !gl) return
  renderer.setSize(c.clientWidth, c.clientHeight)
  camera.perspective({ aspect: gl.canvas.width / gl.canvas.height })
  if (reduceMotion) renderFrame(lastTime)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !particles || !camera) return
  const delta = t - lastTime
  lastTime = t
  elapsed += delta * cfg.speed

  program.uniforms.uTime.value = elapsed * 0.001
  program.uniforms.uSpread.value = cfg.particleSpread
  program.uniforms.uBaseSize.value = cfg.particleBaseSize
  program.uniforms.uAlphaParticles.value = cfg.alphaParticles ? 1 : 0

  if (cfg.enableMouseInteraction && !coarsePointer) {
    particles.position.x = -mouse.x * props.particleHoverFactor
    particles.position.y = -mouse.y * props.particleHoverFactor
  } else {
    particles.position.x = 0
    particles.position.y = 0
  }

  if (!props.disableRotation) {
    particles.rotation.x = Math.sin(elapsed * 0.0002) * 0.1
    particles.rotation.y = Math.cos(elapsed * 0.0005) * 0.15
    particles.rotation.z += 0.01 * cfg.speed
  }

  renderer.render({ scene: particles, camera })
}

const loop = (t: number) => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) { lastTime = t; return }
  renderFrame(t)
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  renderer = new Renderer({ dpr: 1, depth: false, alpha: true })
  gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  c.appendChild(gl.canvas)

  camera = new Camera(gl, { fov: 15 })
  camera.position.set(0, 0, props.cameraDistance)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSpread: { value: cfg.particleSpread },
      uBaseSize: { value: cfg.particleBaseSize },
      uSizeRandomness: { value: props.sizeRandomness },
      uAlphaParticles: { value: cfg.alphaParticles ? 1 : 0 },
    },
    transparent: true,
    depthTest: false,
  })
  buildParticles()

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  io.observe(c)
  if (!coarsePointer) window.addEventListener('pointermove', onPointerMove)

  lastTime = performance.now()
  if (reduceMotion) renderFrame(lastTime)
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
  camera = null
  program = null
  particles = null
  gl = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-particles" :class="props.class" aria-hidden="true">
    <ParticlesControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: radial-gradient(circle at 50% 40%, #0d1526 0%, #080d1a 60%, #04070f 100%);
}
.knowledge-particles :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
