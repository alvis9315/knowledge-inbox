<script setup lang="ts">
import { computed } from 'vue'
import { TriangleAlert, CircleHelp } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

/**
 * 現代化緊湊確認框(Linear/Vercel 式):窄卡、置中 icon+標題+訊息、
 * 雙按鈕等寬、彈性縮放進場。不走 BaseModal(那是內容彈窗的版型)。
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    variant?: 'primary' | 'danger'
    busy?: boolean
  }>(),
  { title: '請確認', confirmText: '確定', cancelText: '取消', variant: 'primary', busy: false },
)
const emit = defineEmits<{ confirm: []; close: [] }>()

const icon = computed(() => (props.variant === 'danger' ? TriangleAlert : CircleHelp))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" @click="emit('close')" />
        <div
          class="confirm-card relative w-full max-w-[20rem] rounded-2xl border border-line bg-surface p-5 text-center shadow-2xl"
          role="alertdialog"
          aria-modal="true"
        >
          <span
            class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
            :class="variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-accent-soft text-accent'"
          >
            <component :is="icon" :size="22" />
          </span>
          <h2 class="text-base font-semibold text-ink">{{ title }}</h2>
          <p class="mt-1.5 text-sm leading-relaxed text-muted"><slot>{{ message }}</slot></p>
          <div class="mt-5 grid grid-cols-2 gap-2">
            <BaseButton variant="secondary" @click="emit('close')">{{ cancelText }}</BaseButton>
            <BaseButton :variant="variant" :disabled="busy" @click="emit('confirm')">
              {{ busy ? '處理中…' : confirmText }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 彈性縮放進場(overlay fade 由外層 Transition 處理) */
.confirm-card {
  animation: confirm-pop 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.25);
}
@keyframes confirm-pop {
  from {
    opacity: 0;
    transform: scale(0.88) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
