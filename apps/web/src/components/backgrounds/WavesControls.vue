<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { WavesConfig } from './KnowledgeWaves.vue'

// KnowledgeWaves 的控制面板(線色 / 振幅 / 速度 / 網格密度 / 滑鼠互動),
// 直接編輯傳入的 reactive config,調整即時生效。模式同 ThreadsControls。
const props = defineProps<{ config: WavesConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const LINE_PRESETS = ['#33507a', '#4a6da8', '#2dd4bf', '#a78bfa', '#94a3b8', '#ffffff']
const sliders = [
  { key: 'waveAmpX', label: 'Amp X', min: 0, max: 80, step: 1 },
  { key: 'waveAmpY', label: 'Amp Y', min: 0, max: 60, step: 1 },
  { key: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1 },
  { key: 'xGap', label: 'X Gap', min: 6, max: 40, step: 1 },
  { key: 'yGap', label: 'Y Gap', min: 12, max: 80, step: 1 },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeWaves
  line-color="${c.lineColor}"
  :wave-amp-x="${c.waveAmpX}"
  :wave-amp-y="${c.waveAmpY}"
  :speed="${c.speed}"
  :x-gap="${c.xGap}"
  :y-gap="${c.yGap}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="waves-controls">
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
          <span class="font-mono text-white">{{ Number(config[s.key]).toFixed(s.step < 1 ? 2 : 0) }}</span>
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
          Line Color
          <span class="font-mono text-white">{{ config.lineColor }}</span>
        </span>
        <ColorPicker
          :model-value="config.lineColor"
          :presets="LINE_PRESETS"
          @update:model-value="(config as any).lineColor = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.waves-controls {
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
