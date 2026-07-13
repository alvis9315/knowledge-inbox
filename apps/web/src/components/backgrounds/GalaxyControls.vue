<script setup lang="ts">
import { ref } from 'vue'
import type { GalaxyConfig } from './KnowledgeGalaxy.vue'
import ColorPicker from '@/components/common/ColorPicker.vue'

// A self-contained control panel for KnowledgeGalaxy. It edits the passed-in
// reactive config object directly, so every change is live. Extract this file
// together with KnowledgeGalaxy.vue to reuse the playground anywhere.
const props = defineProps<{ config: GalaxyConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

interface Slider {
  key: keyof GalaxyConfig
  label: string
  min: number
  max: number
  step: number
}
const sliders: Slider[] = [
  { key: 'density', label: 'Density', min: 0.1, max: 3, step: 0.1 },
  { key: 'glowIntensity', label: 'Glow Intensity', min: 0, max: 1, step: 0.05 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 1, step: 0.05 },
  { key: 'hueShift', label: 'Hue Shift', min: 0, max: 360, step: 1 },
  { key: 'twinkleIntensity', label: 'Twinkle', min: 0, max: 1, step: 0.05 },
  { key: 'rotationSpeed', label: 'Rotation Speed', min: 0, max: 0.3, step: 0.005 },
  { key: 'repulsionStrength', label: 'Repulsion Strength', min: 0, max: 5, step: 0.1 },
  { key: 'autoCenterRepulsion', label: 'Auto Center Repulsion', min: 0, max: 5, step: 0.1 },
  { key: 'starSpeed', label: 'Star Speed', min: 0, max: 2, step: 0.05 },
  { key: 'speed', label: 'Animation Speed', min: 0, max: 3, step: 0.05 },
]
const toggles: Array<{ key: keyof GalaxyConfig; label: string }> = [
  { key: 'mouseInteraction', label: 'Mouse Interaction' },
  { key: 'mouseRepulsion', label: 'Mouse Repulsion' },
  { key: 'disableAnimation', label: 'Disable Animation' },
]

// Star glow tint quick-picks (white = neutral / official look).
const TINT_PRESETS = ['#ffffff', '#bfd7ff', '#9fc5ff', '#ffd9a0', '#f4c430', '#ff9d9d', '#c9a0ff', '#9dffd0']

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeGalaxy
  :density="${c.density}"
  :glow-intensity="${c.glowIntensity}"
  :saturation="${c.saturation}"
  :hue-shift="${c.hueShift}"
  :twinkle-intensity="${c.twinkleIntensity}"
  :rotation-speed="${c.rotationSpeed}"
  :repulsion-strength="${c.repulsionStrength}"
  :auto-center-repulsion="${c.autoCenterRepulsion}"
  :star-speed="${c.starSpeed}"
  :speed="${c.speed}"
  star-tint="${c.starTint}"
  :mouse-interaction="${c.mouseInteraction}"
  :mouse-repulsion="${c.mouseRepulsion}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="galaxy-controls">
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

    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <label
        v-for="t in toggles"
        :key="t.key"
        class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80"
      >
        {{ t.label }}
        <input v-model="(config as any)[t.key]" type="checkbox" class="accent-white" />
      </label>

      <!-- Star glow colour: picker + quick swatches (white = neutral) -->
      <div class="flex flex-col gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        <span class="flex items-center justify-between">
          Star Color
          <span class="font-mono text-white">{{ config.starTint }}</span>
        </span>
        <ColorPicker
          :model-value="config.starTint"
          :presets="TINT_PRESETS"
          @update:model-value="(config as any).starTint = $event"
        />
      </div>

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
          type="range"
          :min="s.min"
          :max="s.max"
          :step="s.step"
          class="w-full accent-white"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.galaxy-controls {
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  width: min(92vw, 60rem);
  max-height: 40vh;
  overflow-y: auto;
  pointer-events: auto;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(10, 14, 25, 0.72);
  backdrop-filter: blur(14px);
  padding: 1rem;
  z-index: 30;
}
</style>
