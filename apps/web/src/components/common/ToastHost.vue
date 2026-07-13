<script setup lang="ts">
import { CheckCircle2, XCircle, Info, X } from 'lucide-vue-next'
import { useToastItems, dismiss, type ToastType } from '@/composables/useToast'

// 全域 toast 渲染(App.vue 掛一次)。頂部置中、堆疊、自動消失、可手動關。
const items = useToastItems()

const ICONS: Record<ToastType, unknown> = { success: CheckCircle2, error: XCircle, info: Info }
const COLOR: Record<ToastType, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-sky-500',
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-for="t in items"
          :key="t.id"
          class="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-lg"
        >
          <component :is="ICONS[t.type]" :size="17" class="shrink-0" :class="COLOR[t.type]" />
          <span class="min-w-0 break-words">{{ t.message }}</span>
          <button
            type="button"
            class="ml-1 shrink-0 rounded-md p-0.5 text-muted transition hover:bg-canvas hover:text-ink"
            aria-label="關閉提示"
            @click="dismiss(t.id)"
          >
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
