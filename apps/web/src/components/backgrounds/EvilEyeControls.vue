<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { EvilEyeConfig } from './KnowledgeEvilEye.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgeEvilEye 的控制面板(Speed/Scale/Brightness/BandHeight/ColorSpeed
// + 雙色 + 互動),直接編輯傳入的 reactive config。模式同 ThreadsControls。
const props = defineProps<{ config: EvilEyeConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#FF6F37', '#fb7185', '#a78bfa', '#61dca3', '#f4c430', '#22d3ee']
const sliders = [
  { key: 'intensity', label: 'Intensity', min: 0.3, max: 3, step: 0.1, digits: 1 },
  { key: 'pupilSize', label: 'Pupil', min: 0.2, max: 1.2, step: 0.05, digits: 2 },
  { key: 'irisWidth', label: 'Iris', min: 0.05, max: 0.6, step: 0.05, digits: 2 },
  { key: 'glowIntensity', label: 'Glow', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'scale', label: 'Scale', min: 0.3, max: 1.6, step: 0.05, digits: 2 },
  { key: 'flameSpeed', label: 'Flame', min: 0, max: 3, step: 0.1, digits: 1 },
] as const
const colors = [
  { key: 'eyeColor', label: '眼焰色' },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeEvilEye
  eye-color="${c.eyeColor}"
  :intensity="${c.intensity}"
  :pupil-size="${c.pupilSize}"
  :iris-width="${c.irisWidth}"
  :glow-intensity="${c.glowIntensity}"
  :scale="${c.scale}"
  :flame-speed="${c.flameSpeed}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="evileye-controls">
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
.evileye-controls {
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
