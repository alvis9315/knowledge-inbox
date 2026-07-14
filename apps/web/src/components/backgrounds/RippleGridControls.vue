<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { RippleGridConfig } from './KnowledgeRippleGrid.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgeRippleGrid 的控制面板(網格色/漣漪/密度/線寬/光暈/旋轉/不透明度),
// 直接編輯傳入的 reactive config,調整即時生效。模式同 ThreadsControls。
const props = defineProps<{ config: RippleGridConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#5c7cba', '#ffffff', '#61dca3', '#a78bfa', '#f4c430', '#22d3ee']
const sliders = [
  { key: 'rippleIntensity', label: 'Ripple', min: 0, max: 0.3, step: 0.01, digits: 2 },
  { key: 'gridSize', label: 'Grid Size', min: 4, max: 30, step: 1, digits: 0 },
  { key: 'gridThickness', label: 'Thickness', min: 5, max: 40, step: 1, digits: 0 },
  { key: 'glowIntensity', label: 'Glow', min: 0, max: 0.6, step: 0.05, digits: 2 },
  { key: 'gridRotation', label: 'Rotation', min: 0, max: 90, step: 5, digits: 0 },
  { key: 'opacity', label: 'Opacity', min: 0.2, max: 1, step: 0.05, digits: 2 },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeRippleGrid
  grid-color="${c.gridColor}"
  :enable-rainbow="${c.enableRainbow}"
  :ripple-intensity="${c.rippleIntensity}"
  :grid-size="${c.gridSize}"
  :grid-thickness="${c.gridThickness}"
  :glow-intensity="${c.glowIntensity}"
  :grid-rotation="${c.gridRotation}"
  :opacity="${c.opacity}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="ripplegrid-controls">
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
        Rainbow
        <input v-model="config.enableRainbow" type="checkbox" class="accent-white" />
      </label>
      <label class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        Mouse Interaction
        <input v-model="config.enableMouseInteraction" type="checkbox" class="accent-white" />
      </label>

      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 sm:col-span-4">
        <span class="flex items-center justify-between">
          Grid Color
          <span class="font-mono text-white">{{ config.gridColor }}</span>
        </span>
        <ColorPicker
          :model-value="config.gridColor"
          :presets="COLOR_PRESETS"
          @update:model-value="(config as any).gridColor = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ripplegrid-controls {
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
