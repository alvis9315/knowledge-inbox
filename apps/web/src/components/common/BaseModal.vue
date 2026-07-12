<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{ open: boolean; title?: string; size?: 'md' | 'lg' | 'xl' }>(),
  { size: 'md' },
)
const emit = defineEmits<{ close: [] }>()

const maxW: Record<string, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl"
        :class="maxW[props.size]"
      >
        <header class="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 class="text-base font-semibold text-ink">{{ title }}</h2>
          <button
            class="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink"
            aria-label="關閉"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>
        <div class="overflow-y-auto px-5 py-4">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
