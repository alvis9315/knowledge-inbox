<script setup lang="ts">
import { ref } from 'vue'
import type { PrismaticBurstConfig, BurstAnimation } from './KnowledgePrismaticBurst.vue'

// KnowledgePrismaticBurst 的控制面板(形狀/方向/速度/格距 + 線色/亮格色/互動),
// 直接編輯傳入的 reactive config。模式同 ThreadsControls。
const props = defineProps<{ config: PrismaticBurstConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

import ColorPicker from '@/components/common/ColorPicker.vue'
const COLOR_PRESETS = ['#5227ff', '#a78bfa', '#22d3ee', '#ff9ffc', '#61dca3', '#f4c430']
const MODES: { value: BurstAnimation; label: string }[] = [
  { value: 'rotate', label: '旋轉' },
  { value: 'rotate3d', label: '3D 旋轉' },
  { value: 'hover', label: '游標' },
]
const sliders = [
  { key: 'intensity', label: 'Intensity', min: 0.3, max: 4, step: 0.1, digits: 1 },
  { key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.05, digits: 2 },
  { key: 'distort', label: 'Distort', min: 0, max: 10, step: 0.5, digits: 1 },
  { key: 'rayCount', label: 'Rays', min: 0, max: 32, step: 1, digits: 0 },
] as const
const colors = [
  { key: 'color1', label: '色 1' },
  { key: 'color2', label: '色 2' },
  { key: 'color3', label: '色 3' },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgePrismaticBurst
  :intensity="${c.intensity}"
  :speed="${c.speed}"
  animation-type="${c.animationType}"
  :distort="${c.distort}"
  :ray-count="${c.rayCount}"
  color1="${c.color1}"
  color2="${c.color2}"
  color3="${c.color3}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="prismaticburst-controls">
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
      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 sm:col-span-4">
        <span>Animation</span>
        <div class="flex gap-1">
          <button
            v-for="m in MODES"
            :key="m.value"
            class="rounded-md px-2 py-1 text-xs transition"
            :class="config.animationType === m.value ? 'bg-white text-slate-900 font-semibold' : 'bg-white/10 text-white/75 hover:bg-white/20'"
            @click="config.animationType = m.value"
          >{{ m.label }}</button>
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

      <div
        v-for="cl in colors"
        :key="cl.key"
        class="flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80"
      >
        <span class="flex items-center justify-between">
          {{ cl.label }}
          <span class="font-mono text-white">{{ config[cl.key] }}</span>
        </span>
        <ColorPicker
          :model-value="config[cl.key]"
          :presets="COLOR_PRESETS"
          @update:model-value="(config as any)[cl.key] = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.prismaticburst-controls {
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
