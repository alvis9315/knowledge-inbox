<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { LiquidChromeConfig } from './KnowledgeLiquidChrome.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgeLiquidChrome 的控制面板(BaseColor/Speed/Amplitude/FreqX/FreqY/互動),
// 直接編輯傳入的 reactive config,調整即時生效。模式同 ThreadsControls。
const props = defineProps<{ config: LiquidChromeConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#141c2b', '#1a1a1a', '#26203a', '#0f2a26', '#2b1420', '#232323']
const sliders = [
  { key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.05, digits: 2 },
  { key: 'amplitude', label: 'Amplitude', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'frequencyX', label: 'Freq X', min: 0, max: 10, step: 0.5, digits: 1 },
  { key: 'frequencyY', label: 'Freq Y', min: 0, max: 10, step: 0.5, digits: 1 },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeLiquidChrome
  base-color="${c.baseColor}"
  :speed="${c.speed}"
  :amplitude="${c.amplitude}"
  :frequency-x="${c.frequencyX}"
  :frequency-y="${c.frequencyY}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="liquidchrome-controls">
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
        Mouse Interaction
        <input v-model="config.enableMouseInteraction" type="checkbox" class="accent-white" />
      </label>

      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 sm:col-span-3">
        <span class="flex items-center justify-between">
          Base Color
          <span class="font-mono text-white">{{ config.baseColor }}</span>
        </span>
        <ColorPicker
          :model-value="config.baseColor"
          :presets="COLOR_PRESETS"
          @update:model-value="(config as any).baseColor = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.liquidchrome-controls {
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
