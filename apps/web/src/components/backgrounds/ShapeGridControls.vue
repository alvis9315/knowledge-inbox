<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { ShapeGridConfig, GridShape, GridDirection } from './KnowledgeShapeGrid.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgeShapeGrid 的控制面板(形狀/方向/速度/格距 + 線色/亮格色/互動),
// 直接編輯傳入的 reactive config。模式同 ThreadsControls。
const props = defineProps<{ config: ShapeGridConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#26314f', '#1b2440', '#3a4a75', '#61dca3', '#a78bfa', '#f4c430']
const SHAPES: { value: GridShape; label: string }[] = [
  { value: 'square', label: '方' },
  { value: 'circle', label: '圓' },
  { value: 'hexagon', label: '六角' },
  { value: 'triangle', label: '三角' },
]
const DIRECTIONS: { value: GridDirection; label: string }[] = [
  { value: 'diagonal', label: '斜向' },
  { value: 'right', label: '右' },
  { value: 'left', label: '左' },
  { value: 'up', label: '上' },
  { value: 'down', label: '下' },
]
const sliders = [
  { key: 'speed', label: 'Speed', min: 0.1, max: 3, step: 0.1, digits: 1 },
  { key: 'squareSize', label: 'Size', min: 16, max: 100, step: 2, digits: 0 },
] as const
const colors = [
  { key: 'borderColor', label: '線色' },
  { key: 'hoverFillColor', label: '亮格色' },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeShapeGrid
  shape="${c.shape}"
  direction="${c.direction}"
  :speed="${c.speed}"
  :square-size="${c.squareSize}"
  border-color="${c.borderColor}"
  hover-fill-color="${c.hoverFillColor}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="shapegrid-controls">
    <BgPresetTabs />
    <div class="mb-3 flex items-center justify-between">
      <span class="text-sm font-semibold text-white">Customize</span>
      <div class="flex items-center">
        <button
          class="rounded-lg bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25"
          @click="copyProps"
        >
          {{ copied ? '已複製 ✓' : '複製 props' }}
        </button>
        <template v-if="closable">
          <button
            class="ml-2 rounded-lg border border-white/25 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
            @click="emit('cancel')"
          >取消</button>
          <button
            class="ml-2 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-white/90"
            @click="emit('done')"
          >完成</button>
        </template>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        <span>Shape</span>
        <div class="flex gap-1">
          <button
            v-for="s in SHAPES"
            :key="s.value"
            class="rounded-md px-2 py-1 text-xs transition"
            :class="config.shape === s.value ? 'bg-white text-slate-900 font-semibold' : 'bg-white/10 text-white/75 hover:bg-white/20'"
            @click="config.shape = s.value"
          >{{ s.label }}</button>
        </div>
      </div>
      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        <span>Direction</span>
        <div class="flex gap-1">
          <button
            v-for="d in DIRECTIONS"
            :key="d.value"
            class="rounded-md px-2 py-1 text-xs transition"
            :class="config.direction === d.value ? 'bg-white text-slate-900 font-semibold' : 'bg-white/10 text-white/75 hover:bg-white/20'"
            @click="config.direction = d.value"
          >{{ d.label }}</button>
        </div>
      </div>

      <label
        v-for="s in sliders"
        :key="s.key"
        class="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80"
      >
        <span class="flex items-center justify-between">
          {{ s.label }}
          <span class="font-mono text-white">{{ Number(config[s.key]).toFixed(s.digits) }}</span>
        </span>
        <input
          v-model.number="(config as any)[s.key]"
          type="range" :min="s.min" :max="s.max" :step="s.step"
          class="w-full accent-white"
        />
      </label>

      <label class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        Mouse Interaction
        <input v-model="config.enableMouseInteraction" type="checkbox" class="accent-white" />
      </label>

      <div
        v-for="c in colors"
        :key="c.key"
        class="flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80"
      >
        <span class="flex items-center justify-between">
          {{ c.label }}
          <span class="font-mono text-white">{{ config[c.key] }}</span>
        </span>
        <ColorPicker
          :model-value="config[c.key]"
          :presets="COLOR_PRESETS"
          @update:model-value="(config as any)[c.key] = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.shapegrid-controls {
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  width: min(92vw, 48rem);
  pointer-events: auto;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(10, 14, 25, 0.72);
  backdrop-filter: blur(14px);
  padding: 1rem;
  z-index: 30;
}
</style>
