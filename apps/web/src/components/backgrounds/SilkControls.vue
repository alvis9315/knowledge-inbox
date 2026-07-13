<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { SilkConfig } from './KnowledgeSilk.vue'

// KnowledgeSilk 的控制面板(顏色 / Speed / Scale / Rotation / Noise),
// 直接編輯傳入的 reactive config,調整即時生效。模式同 ThreadsControls。
const props = defineProps<{ config: SilkConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#7B7481', '#5d5468', '#3d4a63', '#31494a', '#5a3d5c', '#2f2f38']
const sliders = [
  { key: 'speed', label: 'Speed', min: 0, max: 20, step: 0.5, digits: 1 },
  { key: 'scale', label: 'Scale', min: 0.3, max: 4, step: 0.1, digits: 1 },
  { key: 'rotation', label: 'Rotation', min: 0, max: 6.28, step: 0.05, digits: 2 },
  { key: 'noiseIntensity', label: 'Noise', min: 0, max: 3, step: 0.1, digits: 1 },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeSilk
  color="${c.color}"
  :speed="${c.speed}"
  :scale="${c.scale}"
  :rotation="${c.rotation}"
  :noise-intensity="${c.noiseIntensity}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="silk-controls">
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

      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 sm:col-span-4">
        <span class="flex items-center justify-between">
          Color
          <span class="font-mono text-white">{{ config.color }}</span>
        </span>
        <ColorPicker
          :model-value="config.color"
          :presets="COLOR_PRESETS"
          @update:model-value="(config as any).color = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.silk-controls {
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
