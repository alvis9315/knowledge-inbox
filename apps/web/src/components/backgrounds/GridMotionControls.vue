<script setup lang="ts">
import { ref } from 'vue'
import ColorPicker from '@/components/common/ColorPicker.vue'
import type { GridMotionConfig } from './KnowledgeGridMotion.vue'

// KnowledgeGridMotion 的控制面板(暈色/卡色/位移幅度/互動)。
const props = defineProps<{ config: GridMotionConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const COLOR_PRESETS = ['#1b2440', '#10142a', '#26314f', '#3a2a55', '#0f2a26', '#111111']
const colors = [
  { key: 'gradientColor', label: '中心暈色' },
  { key: 'cardColor', label: '卡片色' },
] as const

const copied = ref(false)
const copyProps = () => {
  const c = props.config
  const text = `<KnowledgeGridMotion
  gradient-color="${c.gradientColor}"
  card-color="${c.cardColor}"
  :max-move="${c.maxMove}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="gridmotion-controls">
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
      <label class="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        <span class="flex items-center justify-between">
          Max Move <span class="font-mono text-white">{{ config.maxMove }}</span>
        </span>
        <input v-model.number="config.maxMove" type="range" min="50" max="600" step="10" class="w-full accent-white" />
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
.gridmotion-controls {
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
