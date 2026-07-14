<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { LineWavesConfig } from './KnowledgeLineWaves.vue'

// KnowledgeLineWaves 的控制面板(Speed/Scale/Brightness/BandHeight/ColorSpeed
// + 雙色 + 互動),直接編輯傳入的 reactive config。模式同 ThreadsControls。
const props = defineProps<{ config: LineWavesConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#8fb7ff', '#a78bfa', '#61dca3', '#ffffff', '#f4c430', '#fb7185']
const sliders = [
  { key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.05, digits: 2 },
  { key: 'innerLineCount', label: 'Inner', min: 4, max: 64, step: 1, digits: 0 },
  { key: 'outerLineCount', label: 'Outer', min: 4, max: 64, step: 1, digits: 0 },
  { key: 'warpIntensity', label: 'Warp', min: 0, max: 3, step: 0.1, digits: 1 },
  { key: 'rotation', label: 'Rotation', min: -90, max: 90, step: 5, digits: 0 },
  { key: 'colorCycleSpeed', label: 'Color Cycle', min: 0, max: 3, step: 0.1, digits: 1 },
  { key: 'brightness', label: 'Brightness', min: 0.05, max: 1, step: 0.05, digits: 2 },
] as const
const colors = [
  { key: 'color1', label: '色 1' },
  { key: 'color2', label: '色 2' },
  { key: 'color3', label: '色 3' },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeLineWaves
  :speed="${c.speed}"
  :inner-line-count="${c.innerLineCount}"
  :outer-line-count="${c.outerLineCount}"
  :warp-intensity="${c.warpIntensity}"
  :rotation="${c.rotation}"
  :color-cycle-speed="${c.colorCycleSpeed}"
  :brightness="${c.brightness}"
  color1="${c.color1}"
  color2="${c.color2}"
  color3="${c.color3}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="linewaves-controls">
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

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
.linewaves-controls {
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
