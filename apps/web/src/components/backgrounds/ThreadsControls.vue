<script setup lang="ts">
import { ref } from 'vue'
import type { ThreadsConfig } from './KnowledgeThreads.vue'

// Self-contained control panel for KnowledgeThreads (Amplitude / Distance /
// Enable Mouse Interaction), matching the official demo. Edits the passed-in
// reactive config directly, so every change is live.
const props = defineProps<{ config: ThreadsConfig; closable?: boolean }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const copied = ref(false)
function copyProps() {
  const c = props.config
  const text = `<KnowledgeThreads
  :amplitude="${c.amplitude}"
  :distance="${c.distance}"
  :enable-mouse-interaction="${c.enableMouseInteraction}"
/>`
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="threads-controls">
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
      <label class="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        <span class="flex items-center justify-between">
          Amplitude <span class="font-mono text-white">{{ config.amplitude.toFixed(2) }}</span>
        </span>
        <input v-model.number="config.amplitude" type="range" min="0" max="5" step="0.1" class="w-full accent-white" />
      </label>

      <label class="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        <span class="flex items-center justify-between">
          Distance <span class="font-mono text-white">{{ config.distance.toFixed(2) }}</span>
        </span>
        <input v-model.number="config.distance" type="range" min="0" max="1" step="0.05" class="w-full accent-white" />
      </label>

      <label class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
        Enable Mouse Interaction
        <input v-model="config.enableMouseInteraction" type="checkbox" class="accent-white" />
      </label>
    </div>
  </div>
</template>

<style scoped>
.threads-controls {
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
