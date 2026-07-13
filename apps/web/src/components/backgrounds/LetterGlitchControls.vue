<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { LetterGlitchConfig } from './KnowledgeLetterGlitch.vue'

// KnowledgeLetterGlitch 的控制面板(三色 / Glitch Speed / Smooth),
// 直接編輯傳入的 reactive config,調整即時生效。模式同 ThreadsControls。
const props = defineProps<{ config: LetterGlitchConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#2b4539', '#61dca3', '#61b3dc', '#3b82f6', '#a78bfa', '#f4c430', '#334155']
const colors = [
  { key: 'color1', label: '顏色 1' },
  { key: 'color2', label: '顏色 2' },
  { key: 'color3', label: '顏色 3' },
] as const

const copied = ref(false)
function copyProps() {
  const c = props.config
  const text = `<KnowledgeLetterGlitch
  color1="${c.color1}"
  color2="${c.color2}"
  color3="${c.color3}"
  :glitch-speed="${c.glitchSpeed}"
  :smooth="${c.smooth}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="letterglitch-controls">
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
      <label class="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 sm:col-span-2">
        <span class="flex items-center justify-between">
          Glitch Speed(ms,越小越快)
          <span class="font-mono text-white">{{ config.glitchSpeed }}</span>
        </span>
        <input
          v-model.number="config.glitchSpeed"
          type="range" min="10" max="300" step="10"
          class="w-full accent-white"
        />
      </label>

      <label class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        Smooth 漸變
        <input v-model="config.smooth" type="checkbox" class="accent-white" />
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
.letterglitch-controls {
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
