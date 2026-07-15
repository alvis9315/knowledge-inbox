<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { DotGridConfig } from './KnowledgeDotGrid.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgeDotGrid 的控制面板(點徑/間距/感應半徑/震波強度 + 雙色/互動)。
const props = defineProps<{ config: DotGridConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#2b3560', '#8aa5ff', '#5227FF', '#61dca3', '#f4c430', '#fb7185']
const sliders = [
  { key: 'dotSize', label: 'Dot Size', min: 4, max: 24, step: 1, digits: 0 },
  { key: 'gap', label: 'Gap', min: 12, max: 64, step: 2, digits: 0 },
  { key: 'proximity', label: 'Proximity', min: 50, max: 400, step: 10, digits: 0 },
  { key: 'shockStrength', label: 'Shock', min: 1, max: 15, step: 0.5, digits: 1 },
] as const
const colors = [
  { key: 'baseColor', label: '基色' },
  { key: 'activeColor', label: '感應色' },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeDotGrid
  :dot-size="${c.dotSize}"
  :gap="${c.gap}"
  base-color="${c.baseColor}"
  active-color="${c.activeColor}"
  :proximity="${c.proximity}"
  :shock-strength="${c.shockStrength}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="dotgrid-controls">
    <BgPresetTabs />
    <div class="mb-3 flex items-center justify-between">
      <span class="text-sm font-semibold text-white">Customize</span>
      <div class="flex items-center">
        <button class="rounded-lg bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25" @click="copyProps">
          {{ copied ? '已複製 ✓' : '複製 props' }}
        </button>
        <template v-if="closable">
          <button class="ml-2 rounded-lg border border-white/25 px-3 py-1 text-xs text-white/80 hover:bg-white/10" @click="emit('cancel')">取消</button>
          <button class="ml-2 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-white/90" @click="emit('done')">完成</button>
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
        <input v-model.number="(config as any)[s.key]" type="range" :min="s.min" :max="s.max" :step="s.step" class="w-full accent-white" />
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
.dotgrid-controls {
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
