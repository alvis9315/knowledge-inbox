<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl'
import PrismaticBurstControls from './PrismaticBurstControls.vue'

// React Bits "PrismaticBurst" ported verbatim to Vue 3(OGL WebGL2:
// 放射彩光爆發,rotate/rotate3d/hover 三模式 + 漸層貼圖色盤)。
// 內建控制面板(show-controls),模式同 KnowledgeThreads。
export type BurstAnimation = 'rotate' | 'rotate3d' | 'hover'

export interface PrismaticBurstConfig {
  intensity: number
  speed: number
  animationType: BurstAnimation
  distort: number
  rayCount: number
  color1: string
  color2: string
  color3: string
}

interface Props {
  intensity?: number
  speed?: number
  animationType?: BurstAnimation
  distort?: number
  rayCount?: number
  hoverDampness?: number
  color1?: string
  color2?: string
  color3?: string
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  intensity: 1.6,
  speed: 0.5,
  animationType: 'rotate3d',
  distort: 0,
  rayCount: 0,
  hoverDampness: 0.25,
  color1: '#5227ff',
  color2: '#a78bfa',
  color3: '#22d3ee',
  showControls: false,
  class: '',
})

const cfg = reactive<PrismaticBurstConfig>({
  intensity: props.intensity,
  speed: props.speed,
  animationType: props.animationType,
  distort: props.distort,
  rayCount: props.rayCount,
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
let program: Program | null = null
let mesh: Mesh | null = null
let gradTex: Texture | null = null
let gl: any = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true
let last = 0
let accumTime = 0
const mouseTarget = [0.5, 0.5]
const mouseSmooth = [0.5, 0.5]

const VERT = `#version 300 es
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
precision highp int;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;

uniform float uIntensity;
uniform float uSpeed;
uniform int   uAnimType;
uniform vec2  uMouse;
uniform int   uColorCount;
uniform float uDistort;
uniform vec2  uOffset;
uniform sampler2D uGradient;
uniform float uNoiseAmount;
uniform int   uRayCount;

float hash21(vec2 p){
    p = floor(p);
    float f = 52.9829189 * fract(dot(p, vec2(0.065, 0.005)));
    return fract(f);
}

mat2 rot30(){ return mat2(0.8, -0.5, 0.5, 0.8); }

float layeredNoise(vec2 fragPx){
    vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
    vec2 q = rot30() * p;
    float n = 0.0;
    n += 0.40 * hash21(q);
    n += 0.25 * hash21(q * 2.0 + 17.0);
    n += 0.20 * hash21(q * 4.0 + 47.0);
    n += 0.10 * hash21(q * 8.0 + 113.0);
    n += 0.05 * hash21(q * 16.0 + 191.0);
    return n;
}

vec3 rayDir(vec2 frag, vec2 res, vec2 offset, float dist){
    float focal = res.y * max(dist, 1e-3);
    return normalize(vec3(2.0 * (frag - offset) - res, focal));
}

float edgeFade(vec2 frag, vec2 res, vec2 offset){
    vec2 toC = frag - 0.5 * res - offset;
    float r = length(toC) / (0.5 * min(res.x, res.y));
    float x = clamp(r, 0.0, 1.0);
    float q = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    float s = q * 0.5;
    s = pow(s, 1.5);
    float tail = 1.0 - pow(1.0 - s, 2.0);
    s = mix(s, tail, 0.2);
    float dn = (layeredNoise(frag * 0.15) - 0.5) * 0.0015 * s;
    return clamp(s + dn, 0.0, 1.0);
}

mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c); }
mat3 rotZ(float a){ float c = cos(a), s = sin(a); return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0); }

vec3 sampleGradient(float t){
    t = clamp(t, 0.0, 1.0);
    return texture(uGradient, vec2(t, 0.5)).rgb;
}

vec2 rot2(vec2 v, float a){
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * v;
}

float bendAngle(vec3 q, float t){
    float a = 0.8 * sin(q.x * 0.55 + t * 0.6)
            + 0.7 * sin(q.y * 0.50 - t * 0.5)
            + 0.6 * sin(q.z * 0.60 + t * 0.7);
    return a;
}

void main(){
    vec2 frag = gl_FragCoord.xy;
    float t = uTime * uSpeed;
    float jitterAmp = 0.1 * clamp(uNoiseAmount, 0.0, 1.0);
    vec3 dir = rayDir(frag, uResolution, uOffset, 1.0);
    float marchT = 0.0;
    vec3 col = vec3(0.0);
    float n = layeredNoise(frag);
    vec4 c = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
    mat2 M2 = mat2(c.x, c.y, c.z, c.w);
    float amp = clamp(uDistort, 0.0, 50.0) * 0.15;

    mat3 rot3dMat = mat3(1.0);
    if(uAnimType == 1){
      vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
      rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);
    }
    mat3 hoverMat = mat3(1.0);
    if(uAnimType == 2){
      vec2 m = uMouse * 2.0 - 1.0;
      vec3 ang = vec3(m.y * 0.6, m.x * 0.6, 0.0);
      hoverMat = rotY(ang.y) * rotX(ang.x);
    }

    for (int i = 0; i < 44; ++i) {
        vec3 P = marchT * dir;
        P.z -= 2.0;
        float rad = length(P);
        vec3 Pl = P * (10.0 / max(rad, 1e-6));

        if(uAnimType == 0){
            Pl.xz *= M2;
        } else if(uAnimType == 1){
      Pl = rot3dMat * Pl;
        } else {
      Pl = hoverMat * Pl;
        }

        float stepLen = min(rad - 0.3, n * jitterAmp) + 0.1;

        float grow = smoothstep(0.35, 3.0, marchT);
        float a1 = amp * grow * bendAngle(Pl * 0.6, t);
        float a2 = 0.5 * amp * grow * bendAngle(Pl.zyx * 0.5 + 3.1, t * 0.9);
        vec3 Pb = Pl;
        Pb.xz = rot2(Pb.xz, a1);
        Pb.xy = rot2(Pb.xy, a2);

        float rayPattern = smoothstep(
            0.5, 0.7,
            sin(Pb.x + cos(Pb.y) * cos(Pb.z)) *
            sin(Pb.z + sin(Pb.y) * cos(Pb.x + t))
        );

        if (uRayCount > 0) {
            float ang = atan(Pb.y, Pb.x);
            float comb = 0.5 + 0.5 * cos(float(uRayCount) * ang);
            comb = pow(comb, 3.0);
            rayPattern *= smoothstep(0.15, 0.95, comb);
        }

        vec3 spectralDefault = 1.0 + vec3(
            cos(marchT * 3.0 + 0.0),
            cos(marchT * 3.0 + 1.0),
            cos(marchT * 3.0 + 2.0)
        );

        float saw = fract(marchT * 0.25);
        float tRay = saw * saw * (3.0 - 2.0 * saw);
        vec3 userGradient = 2.0 * sampleGradient(tRay);
        vec3 spectral = (uColorCount > 0) ? userGradient : spectralDefault;
        vec3 base = (0.05 / (0.4 + stepLen))
                  * smoothstep(5.0, 0.0, rad)
                  * spectral;

        col += base * rayPattern;
        marchT += stepLen;
    }

    col *= edgeFade(frag, uResolution, uOffset);
    col *= uIntensity;

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

const ANIM_MAP: Record<BurstAnimation, number> = { rotate: 0, rotate3d: 1, hover: 2 }

const hexToRgb01 = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

// 色盤 → 1×N 漸層貼圖(原版同款,上限 64 色;此處固定三色)
const uploadGradient = () => {
  if (!gradTex || !gl || !program) return
  const colors = [cfg.color1, cfg.color2, cfg.color3]
  const data = new Uint8Array(colors.length * 4)
  colors.forEach((c, i) => {
    const [r, g, b] = hexToRgb01(c)
    data[i * 4] = Math.round(r * 255)
    data[i * 4 + 1] = Math.round(g * 255)
    data[i * 4 + 2] = Math.round(b * 255)
    data[i * 4 + 3] = 255
  })
  gradTex.image = data
  ;(gradTex as any).width = colors.length
  ;(gradTex as any).height = 1
  gradTex.needsUpdate = true
  program.uniforms.uColorCount.value = colors.length
}

const onPointer = (e: PointerEvent) => {
  const c = containerRef.value
  if (!c || cfg.animationType !== 'hover') return
  const rect = c.getBoundingClientRect()
  mouseTarget[0] = Math.min(Math.max((e.clientX - rect.left) / Math.max(rect.width, 1), 0), 1)
  mouseTarget[1] = Math.min(Math.max((e.clientY - rect.top) / Math.max(rect.height, 1), 0), 1)
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  renderer.setSize(c.clientWidth || 1, c.clientHeight || 1)
  program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight]
  if (reduceMotion) renderFrame(performance.now())
}

const renderFrame = (now: number) => {
  if (!renderer || !program || !mesh) return
  const dt = Math.max(0, now - last) * 0.001
  last = now
  accumTime += dt

  const u = program.uniforms
  u.uIntensity.value = cfg.intensity
  u.uSpeed.value = cfg.speed
  u.uAnimType.value = ANIM_MAP[cfg.animationType]
  u.uDistort.value = cfg.distort
  u.uRayCount.value = Math.max(0, Math.floor(cfg.rayCount))
  uploadGradient()

  const tau = 0.02 + Math.max(0, Math.min(1, props.hoverDampness)) * 0.5
  const alpha = 1 - Math.exp(-dt / tau)
  mouseSmooth[0] += (mouseTarget[0] - mouseSmooth[0]) * alpha
  mouseSmooth[1] += (mouseTarget[1] - mouseSmooth[1]) * alpha
  u.uMouse.value = coarsePointer ? [0.5, 0.5] : mouseSmooth
  u.uTime.value = accumTime

  renderer.render({ scene: mesh })
}

const loop = (t: number) => {
  raf = requestAnimationFrame(loop)
  if (!onScreen || document.hidden) { last = t; return }
  renderFrame(t)
}

onMounted(() => {
  const c = containerRef.value
  if (!c) return
  renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: false, antialias: false })
  gl = renderer.gl
  Object.assign(gl.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
  c.appendChild(gl.canvas)

  gradTex = new Texture(gl, {
    image: new Uint8Array([255, 255, 255, 255]),
    width: 1,
    height: 1,
    generateMipmaps: false,
    flipY: false,
  })
  gradTex.minFilter = gl.LINEAR
  gradTex.magFilter = gl.LINEAR
  gradTex.wrapS = gl.CLAMP_TO_EDGE
  gradTex.wrapT = gl.CLAMP_TO_EDGE

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uResolution: { value: [1, 1] },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uSpeed: { value: 1 },
      uAnimType: { value: 0 },
      uMouse: { value: [0.5, 0.5] },
      uColorCount: { value: 0 },
      uDistort: { value: 0 },
      uOffset: { value: [0, 0] },
      uGradient: { value: gradTex },
      uNoiseAmount: { value: 0.8 },
      uRayCount: { value: 0 },
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
  if (!coarsePointer) window.addEventListener('pointermove', onPointer, { passive: true })

  last = performance.now()
  if (reduceMotion) renderFrame(last + 500)
  else raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  io?.disconnect()
  window.removeEventListener('pointermove', onPointer)
  if (gl?.canvas?.parentNode) gl.canvas.parentNode.removeChild(gl.canvas)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  renderer = null
  program = null
  mesh = null
  gradTex = null
  gl = null
})
</script>

<template>
  <div ref="containerRef" class="knowledge-prismaticburst" :class="props.class" aria-hidden="true">
    <PrismaticBurstControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-prismaticburst {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #000000;
}
.knowledge-prismaticburst :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
