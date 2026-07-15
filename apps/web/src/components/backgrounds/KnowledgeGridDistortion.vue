<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import GridDistortionControls from './GridDistortionControls.vue'
import { loadFile, LOGIN_COVER_KEY } from '@/services/localFiles'

// React Bits "GridDistortion" ported to Vue 3(three.js:
// 圖片網格扭曲,滑鼠拖出漣漪位移,relaxation 回彈)。
// 圖源沿用「圖片封面」上傳的封面(IndexedDB);沒有封面時退回
// 程式生成的星空漸層紋理(不擋功能)。
export interface GridDistortionConfig {
  grid: number
  mouse: number
  strength: number
  relaxation: number
  enableMouseInteraction: boolean
}

interface Props {
  grid?: number
  mouse?: number
  strength?: number
  relaxation?: number
  enableMouseInteraction?: boolean
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  grid: 15,
  mouse: 0.1,
  strength: 0.15,
  relaxation: 0.9,
  // 這顆的動態全靠滑鼠,預設開(靜態時=封面圖)
  enableMouseInteraction: true,
  showControls: false,
  class: '',
})

const cfg = reactive<GridDistortionConfig>({
  grid: props.grid,
  mouse: props.mouse,
  strength: props.strength,
  relaxation: props.relaxation,
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

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let material: THREE.ShaderMaterial | null = null
let geometry: THREE.PlaneGeometry | null = null
let plane: THREE.Mesh | null = null
let dataTexture: THREE.DataTexture | null = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let objectUrl: string | null = null
let size = 15
const mouseState = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0 }

const VERT = `
uniform float time;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = `
uniform sampler2D uDataTexture;
uniform sampler2D uTexture;
uniform vec4 resolution;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec4 offset = texture2D(uDataTexture, vUv);
  gl_FragColor = texture2D(uTexture, uv - 0.02 * offset.rg);
}`

// 無封面時的退路:程式生成星空漸層紋理
const fallbackTexture = (): THREE.Texture => {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 640
  const c = cv.getContext('2d')!
  const g = c.createLinearGradient(0, 0, 1024, 640)
  g.addColorStop(0, '#131c3a')
  g.addColorStop(0.5, '#0b1226')
  g.addColorStop(1, '#1c1436')
  c.fillStyle = g
  c.fillRect(0, 0, 1024, 640)
  for (let i = 0; i < 220; i++) {
    const a = Math.random() * 0.8 + 0.2
    c.fillStyle = `rgba(232, 238, 255, ${a})`
    const r = Math.random() < 0.9 ? 1 : 2
    c.fillRect(Math.random() * 1024, Math.random() * 640, r, r)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const rebuildDataTexture = () => {
  size = Math.max(4, Math.round(cfg.grid))
  const data = new Float32Array(4 * size * size)
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.random() * 255 - 125
    data[i * 4 + 1] = Math.random() * 255 - 125
  }
  dataTexture?.dispose()
  dataTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType)
  dataTexture.needsUpdate = true
  if (material) material.uniforms.uDataTexture.value = dataTexture
}
watch(() => cfg.grid, rebuildDataTexture)

const onMouseMove = (e: MouseEvent) => {
  const c = containerRef.value
  if (!c || !cfg.enableMouseInteraction) return
  const rect = c.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = 1 - (e.clientY - rect.top) / rect.height
  mouseState.vX = x - mouseState.prevX
  mouseState.vY = y - mouseState.prevY
  Object.assign(mouseState, { x, y, prevX: x, prevY: y })
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !camera || !plane || !material) return
  const rect = c.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const containerAspect = rect.width / rect.height
  renderer.setSize(rect.width, rect.height)
  plane.scale.set(containerAspect, 1, 1)
  const frustumWidth = containerAspect
  camera.left = -frustumWidth / 2
  camera.right = frustumWidth / 2
  camera.top = 0.5
  camera.bottom = -0.5
  camera.updateProjectionMatrix()
  material.uniforms.resolution.value.set(rect.width, rect.height, 1, 1)
  if (reduceMotion) renderFrame()
}

const renderFrame = () => {
  if (!renderer || !scene || !camera || !material || !dataTexture) return
  material.uniforms.time.value += 0.05
  const data = dataTexture.image.data as Float32Array
  for (let i = 0; i < size * size; i++) {
    data[i * 4] *= cfg.relaxation
    data[i * 4 + 1] *= cfg.relaxation
  }
  if (cfg.enableMouseInteraction && !coarsePointer) {
    const gridMouseX = size * mouseState.x
    const gridMouseY = size * mouseState.y
    const maxDist = size * cfg.mouse
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const distSq = (gridMouseX - i) ** 2 + (gridMouseY - j) ** 2
        if (distSq < maxDist * maxDist) {
          const index = 4 * (i + size * j)
          const power = Math.min(maxDist / Math.sqrt(distSq), 10)
          data[index] += cfg.strength * 100 * mouseState.vX * power
          data[index + 1] -= cfg.strength * 100 * mouseState.vY * power
        }
      }
    }
  }
  dataTexture.needsUpdate = true
  renderer.render(scene, camera)
}

const loop = () => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) return
  renderFrame()
}

onMounted(async () => {
  const c = containerRef.value
  if (!c) return
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1000, 1000)
  camera.position.z = 2

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })
  c.appendChild(renderer.domElement)

  material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      resolution: { value: new THREE.Vector4() },
      uTexture: { value: null },
      uDataTexture: { value: null },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
  })
  rebuildDataTexture()

  size = Math.max(4, Math.round(cfg.grid))
  geometry = new THREE.PlaneGeometry(1, 1, size - 1, size - 1)
  plane = new THREE.Mesh(geometry, material)
  scene.add(plane)

  // 圖源:封面(IndexedDB)→ 無則退回生成紋理
  try {
    const file = await loadFile(LOGIN_COVER_KEY)
    if (file) {
      objectUrl = URL.createObjectURL(file)
      new THREE.TextureLoader().load(objectUrl, (texture) => {
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.colorSpace = THREE.SRGBColorSpace
        if (material) material.uniforms.uTexture.value = texture
        resize()
      })
    } else {
      material.uniforms.uTexture.value = fallbackTexture()
    }
  } catch {
    material.uniforms.uTexture.value = fallbackTexture()
  }

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(c)
  io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true
  })
  io.observe(c)
  if (!coarsePointer) window.addEventListener('mousemove', onMouseMove, { passive: true })

  if (reduceMotion) renderFrame()
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('mousemove', onMouseMove)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  geometry?.dispose()
  material?.uniforms.uTexture.value?.dispose?.()
  dataTexture?.dispose()
  material?.dispose()
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  renderer = null
  scene = null
  camera = null
  material = null
  geometry = null
  plane = null
  dataTexture = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-griddistortion" :class="props.class" aria-hidden="true">
    <GridDistortionControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-griddistortion {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0b1226;
}
.knowledge-griddistortion :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
