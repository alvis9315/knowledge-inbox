<script setup lang="ts">
import { ref } from 'vue'
import type { PrismConfig, PrismAnimation } from './KnowledgePrism.vue'
import BgPresetTabs from '@/features/theme/BgPresetTabs.vue'

// KnowledgePrism 的控制面板(形狀/方向/速度/格距 + 線色/亮格色/互動),
// 直接編輯傳入的 reactive config。模式同 ThreadsControls。
const props = defineProps<{ config: PrismConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const MODES: { value: PrismAnimation; label: string }[] = [
  { value: 'rotate', label: '搖擺' },
  { value: '3drotate', label: '3D 旋轉' },
  { value: 'hover', label: '游標' },
]
const sliders = [
  { key: 'height', label: 'Height', min: 1, max: 8, step: 0.5, digits: 1 },
  { key: 'baseWidth', label: 'Base', min: 1, max: 10, step: 0.5, digits: 1 },
  { key: 'glow', label: 'Glow', min: 0, max: 3, step: 0.1, digits: 1 },
  { key: 'noise', label: 'Noise', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'scale', label: 'Scale', min: 1, max: 8, step: 0.2, digits: 1 },
  { key: 'hueShift', label: 'Hue', min: -3.14, max: 3.14, step: 0.1, digits: 1 },
  { key: 'colorFrequency', label: 'Color Freq', min: 0.2, max: 4, step: 0.1, digits: 1 },
  { key: 'bloom', label: 'Bloom', min: 0, max: 3, step: 0.1, digits: 1 },
  { key: 'timeScale', label: 'Time', min: 0, max: 2, step: 0.05, digits: 2 },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgePrism
  :height="${c.height}"
  :base-width="${c.baseWidth}"
  animation-type="${c.animationType}"
  :glow="${c.glow}"
  :noise="${c.noise}"
  :scale="${c.scale}"
  :hue-shift="${c.hueShift}"
  :color-frequency="${c.colorFrequency}"
  :bloom="${c.bloom}"
  :time-scale="${c.timeScale}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="prism-controls">
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
      <div class="col-span-2 flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 sm:col-span-4">
        <span>Animation</span>
        <div class="flex gap-1">
          <button
            v-for="m in MODES"
            :key="m.value"
            class="rounded-md px-2 py-1 text-xs transition"
            :class="config.animationType === m.value ? 'bg-white text-slate-900 font-semibold' : 'bg-white/10 text-white/75 hover:bg-white/20'"
            @click="config.animationType = m.value"
          >{{ m.label }}</button>
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

    </div>
  </div>
</template>

<style scoped>
.prism-controls {
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
