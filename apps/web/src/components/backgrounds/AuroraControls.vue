<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { AuroraConfig } from './KnowledgeAurora.vue'

// KnowledgeAurora 的控制面板(Amplitude / Blend / Speed / 三個色帶),
// 直接編輯傳入的 reactive config,所有調整即時生效。模式同 ThreadsControls。
const props = defineProps<{ config: AuroraConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const STOP_PRESETS = ['#22d3ee', '#5eead4', '#a78bfa', '#7cff67', '#5227ff', '#ff94b4', '#ffffff']
const stops = [
  { key: 'stop1', label: '色帶(左)' },
  { key: 'stop2', label: '色帶(中)' },
  { key: 'stop3', label: '色帶(右)' },
] as const
const sliders = [
  { key: 'amplitude', label: 'Amplitude', min: 0, max: 3, step: 0.1 },
  { key: 'blend', label: 'Blend', min: 0, max: 1, step: 0.05 },
  { key: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1 },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeAurora
  :amplitude="${c.amplitude}"
  :blend="${c.blend}"
  :speed="${c.speed}"
  stop1="${c.stop1}"
  stop2="${c.stop2}"
  stop3="${c.stop3}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="aurora-controls">
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

    <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label
        v-for="s in sliders"
        :key="s.key"
        class="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80"
      >
        <span class="flex items-center justify-between">
          {{ s.label }}
          <span class="font-mono text-white">{{ Number(config[s.key]).toFixed(2) }}</span>
        </span>
        <input
          v-model.number="(config as any)[s.key]"
          type="range" :min="s.min" :max="s.max" :step="s.step"
          class="w-full accent-white"
        />
      </label>

      <div
        v-for="st in stops"
        :key="st.key"
        class="flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80"
      >
        <span class="flex items-center justify-between">
          {{ st.label }}
          <span class="font-mono text-white">{{ config[st.key] }}</span>
        </span>
        <ColorPicker
          :model-value="config[st.key]"
          :presets="STOP_PRESETS"
          @update:model-value="(config as any)[st.key] = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.aurora-controls {
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
