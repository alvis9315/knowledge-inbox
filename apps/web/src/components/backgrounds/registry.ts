import { defineAsyncComponent, type Component } from 'vue'
import type { LiveBgKind } from '@/features/theme/themePresets'

/**
 * 活背景 registry(設定當資料管理):新增一種活背景 =
 * 這裡加一行 + THEME_PRESETS 加一筆 preset,AppShell 不用動。
 * 全部 defineAsyncComponent:用到哪種才載哪個 chunk(主包零成長,AGENTS.md 硬指標)。
 * 'image' 不在此表:它的控制器是上傳封面 modal,AppShell 特例處理。
 */
export const BG_COMPONENTS: Partial<Record<LiveBgKind, Component>> = {
  galaxy: defineAsyncComponent(() => import('./KnowledgeGalaxy.vue')),
  threads: defineAsyncComponent(() => import('./KnowledgeThreads.vue')),
  aurora: defineAsyncComponent(() => import('./KnowledgeAurora.vue')),
  waves: defineAsyncComponent(() => import('./KnowledgeWaves.vue')),
  darkveil: defineAsyncComponent(() => import('./KnowledgeDarkVeil.vue')),
  silk: defineAsyncComponent(() => import('./KnowledgeSilk.vue')),
  iridescence: defineAsyncComponent(() => import('./KnowledgeIridescence.vue')),
  letterglitch: defineAsyncComponent(() => import('./KnowledgeLetterGlitch.vue')),
  lightning: defineAsyncComponent(() => import('./KnowledgeLightning.vue')),
  liquidchrome: defineAsyncComponent(() => import('./KnowledgeLiquidChrome.vue')),
  particles: defineAsyncComponent(() => import('./KnowledgeParticles.vue')),
  ripplegrid: defineAsyncComponent(() => import('./KnowledgeRippleGrid.vue')),
  orb: defineAsyncComponent(() => import('./KnowledgeOrb.vue')),
  plasma: defineAsyncComponent(() => import('./KnowledgePlasma.vue')),
  dotfield: defineAsyncComponent(() => import('./KnowledgeDotField.vue')),
  softaurora: defineAsyncComponent(() => import('./KnowledgeSoftAurora.vue')),
  lightrays: defineAsyncComponent(() => import('./KnowledgeLightRays.vue')),
  grainient: defineAsyncComponent(() => import('./KnowledgeGrainient.vue')),
  radar: defineAsyncComponent(() => import('./KnowledgeRadar.vue')),
  linewaves: defineAsyncComponent(() => import('./KnowledgeLineWaves.vue')),
  siderays: defineAsyncComponent(() => import('./KnowledgeSideRays.vue')),
  lightfall: defineAsyncComponent(() => import('./KnowledgeLightfall.vue')),
  evileye: defineAsyncComponent(() => import('./KnowledgeEvilEye.vue')),
  shapegrid: defineAsyncComponent(() => import('./KnowledgeShapeGrid.vue')),
  prism: defineAsyncComponent(() => import('./KnowledgePrism.vue')),
  prismaticburst: defineAsyncComponent(() => import('./KnowledgePrismaticBurst.vue')),
  faultyterminal: defineAsyncComponent(() => import('./KnowledgeFaultyTerminal.vue')),
  gridmotion: defineAsyncComponent(() => import('./KnowledgeGridMotion.vue')),
  dotgrid: defineAsyncComponent(() => import('./KnowledgeDotGrid.vue')),
}
