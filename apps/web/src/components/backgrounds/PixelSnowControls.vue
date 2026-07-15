<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { PixelSnowConfig, SnowVariant } from './KnowledgePixelSnow.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgePixelSnow 的控制面板(顆粒/速度/密度/方向 + 色),
// 直接編輯傳入的 reactive config。模式同 ThreadsControls。
const props = defineProps<{ config: PixelSnowConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#cdd8ff', '#ffffff', '#8aa5ff', '#a78bfa', '#61dca3', '#f4c430']
const VARIANTS: { value: SnowVariant; label: string }[] = [
  { value: 'square', label: '方塊' },
  { value: 'round', label: '圓點' },
  { value: 'snowflake', label: '雪花' },
]
const sliders = [
  { key: 'speed', label: 'Speed', min: 0.2, max: 4, step: 0.05, digits: 2 },
  { key: 'density', label: 'Density', min: 0.05, max: 1, step: 0.05, digits: 2 },
  { key: 'pixelResolution', label: 'Pixel Res', min: 60, max: 400, step: 10, digits: 0 },
  { key: 'direction', label: 'Direction', min: 90, max: 160, step: 1, digits: 0 },
  { key: 'brightness', label: 'Brightness', min: 0.3, max: 2, step: 0.1, digits: 1 },
] as const
const colors = [
  { key: 'color', label: '雪色' },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgePixelSnow
  color="${c.color}"
  variant="${c.variant}"
  :speed="${c.speed}"
  :density="${c.density}"
  :pixel-resolution="${c.pixelResolution}"
  :direction="${c.direction}"
  :brightness="${c.brightness}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="pixelsnow-controls">
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
        <span>Variant</span>
        <div class="flex gap-1">
          <button
            v-for="s in VARIANTS"
            :key="s.value"
            class="rounded-md px-2 py-1 text-xs transition"
            :class="config.variant === s.value ? 'bg-white text-slate-900 font-semibold' : 'bg-white/10 text-white/75 hover:bg-white/20'"
            @click="config.variant = s.value"
          >{{ s.label }}</button>
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
.pixelsnow-controls {
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
