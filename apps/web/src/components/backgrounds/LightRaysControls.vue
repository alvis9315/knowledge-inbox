<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { LightRaysConfig } from './KnowledgeLightRays.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgeLightRays 的控制面板(Speed/Spread/Length/Noise/Distortion
// + 光色 + 脈動/互動),直接編輯傳入的 reactive config。模式同 ThreadsControls。
const props = defineProps<{ config: LightRaysConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#bcd6ff', '#ffffff', '#ffd98a', '#9adcff', '#c4b5fd', '#86efac']
const sliders = [
  { key: 'raysSpeed', label: 'Speed', min: 0, max: 3, step: 0.1, digits: 1 },
  { key: 'lightSpread', label: 'Spread', min: 0.1, max: 3, step: 0.1, digits: 1 },
  { key: 'rayLength', label: 'Length', min: 0.5, max: 4, step: 0.1, digits: 1 },
  { key: 'noiseAmount', label: 'Noise', min: 0, max: 0.5, step: 0.05, digits: 2 },
  { key: 'distortion', label: 'Distortion', min: 0, max: 1, step: 0.05, digits: 2 },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeLightRays
  rays-color="${c.raysColor}"
  :rays-speed="${c.raysSpeed}"
  :light-spread="${c.lightSpread}"
  :ray-length="${c.rayLength}"
  :pulsating="${c.pulsating}"
  :noise-amount="${c.noiseAmount}"
  :distortion="${c.distortion}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="lightrays-controls">
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
        Pulsating
        <input v-model="config.pulsating" type="checkbox" class="accent-white" />
      </label>
      <label class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        Mouse Interaction
        <input v-model="config.enableMouseInteraction" type="checkbox" class="accent-white" />
      </label>

      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        <span class="flex items-center justify-between">
          Ray Color
          <span class="font-mono text-white">{{ config.raysColor }}</span>
        </span>
        <ColorPicker
          :model-value="config.raysColor"
          :presets="COLOR_PRESETS"
          @update:model-value="(config as any).raysColor = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lightrays-controls {
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
