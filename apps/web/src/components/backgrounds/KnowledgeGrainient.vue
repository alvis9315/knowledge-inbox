<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import GrainientControls from './GrainientControls.vue'

// React Bits "Grainient" ported verbatim to Vue 3(OGL + 官方 GLSL:
// 三色扭曲漸層 + 底片顆粒,WebGL2)。控制面板收核心參數,
// 其餘進階 uniforms 走 props(官方預設)。模式同 KnowledgeThreads。
export interface GrainientConfig {
  timeSpeed: number
  warpStrength: number
  grainAmount: number
  zoom: number
  color1: string
  color2: string
  color3: string
}

interface Props {
  timeSpeed?: number
  colorBalance?: number
  warpStrength?: number
  warpFrequency?: number
  warpSpeed?: number
  warpAmplitude?: number
  blendAngle?: number
  blendSoftness?: number
  rotationAmount?: number
  noiseScale?: number
  grainAmount?: number
  grainScale?: number
  grainAnimated?: boolean
  contrast?: number
  gamma?: number
  saturation?: number
  centerX?: number
  centerY?: number
  zoom?: number
  color1?: string
  color2?: string
  color3?: string
  showControls?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  timeSpeed: 0.25,
  colorBalance: 0.0,
  warpStrength: 1.0,
  warpFrequency: 5.0,
  warpSpeed: 2.0,
  warpAmplitude: 50.0,
  blendAngle: 0.0,
  blendSoftness: 0.05,
  rotationAmount: 500.0,
  noiseScale: 2.0,
  grainAmount: 0.1,
  grainScale: 2.0,
  grainAnimated: false,
  contrast: 1.5,
  gamma: 1.0,
  saturation: 1.0,
  centerX: 0.0,
  centerY: 0.0,
  zoom: 0.9,
  color1: '#3b2a66',
  color2: '#141c3f',
  color3: '#4c3a78',
  showControls: false,
  class: '',
})

const cfg = reactive<GrainientConfig>({
  timeSpeed: props.timeSpeed,
  warpStrength: props.warpStrength,
  grainAmount: props.grainAmount,
  zoom: props.zoom,
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

/* eslint-disable @typescript-eslint/no-explicit-any */
let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null
let gl: any = null
let raf = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let onScreen = true

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);} 
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);} 
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);} 
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return [1, 1, 1]
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

const resize = () => {
  const c = containerRef.value
  if (!c || !renderer || !program || !gl) return
  renderer.setSize(c.clientWidth, c.clientHeight)
  const res = program.uniforms.iResolution.value
  res[0] = gl.drawingBufferWidth
  res[1] = gl.drawingBufferHeight
  if (reduceMotion) renderFrame(600)
}

const renderFrame = (t: number) => {
  if (!renderer || !program || !mesh) return
  const u = program.uniforms
  u.iTime.value = t * 0.001
  u.uTimeSpeed.value = cfg.timeSpeed
  u.uWarpStrength.value = cfg.warpStrength
  u.uGrainAmount.value = cfg.grainAmount
  u.uZoom.value = cfg.zoom
  u.uColor1.value = hexToRgb(cfg.color1)
  u.uColor2.value = hexToRgb(cfg.color2)
  u.uColor3.value = hexToRgb(cfg.color3)
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
  renderer = new Renderer({ webgl: 2, alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 2) })
  gl = renderer.gl
  gl.canvas.style.width = '100%'
  gl.canvas.style.height = '100%'
  gl.canvas.style.display = 'block'
  c.appendChild(gl.canvas)

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      uTimeSpeed: { value: cfg.timeSpeed },
      uColorBalance: { value: props.colorBalance },
      uWarpStrength: { value: cfg.warpStrength },
      uWarpFrequency: { value: props.warpFrequency },
      uWarpSpeed: { value: props.warpSpeed },
      uWarpAmplitude: { value: props.warpAmplitude },
      uBlendAngle: { value: props.blendAngle },
      uBlendSoftness: { value: props.blendSoftness },
      uRotationAmount: { value: props.rotationAmount },
      uNoiseScale: { value: props.noiseScale },
      uGrainAmount: { value: cfg.grainAmount },
      uGrainScale: { value: props.grainScale },
      uGrainAnimated: { value: props.grainAnimated ? 1.0 : 0.0 },
      uContrast: { value: props.contrast },
      uGamma: { value: props.gamma },
      uSaturation: { value: props.saturation },
      uCenterOffset: { value: new Float32Array([props.centerX, props.centerY]) },
      uZoom: { value: cfg.zoom },
      uColor1: { value: hexToRgb(cfg.color1) },
      uColor2: { value: hexToRgb(cfg.color2) },
      uColor3: { value: hexToRgb(cfg.color3) },
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

  if (reduceMotion) renderFrame(600)
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
  <div ref="containerRef" class="knowledge-grainient" :class="props.class" aria-hidden="true">
    <GrainientControls v-if="showControls" :config="cfg" closable @done="ctlDone" @cancel="ctlCancel" />
  </div>
</template>

<style scoped>
.knowledge-grainient {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0b0a16;
}
.knowledge-grainient :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
