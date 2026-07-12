<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

withDefaults(
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
</script>

<template>
  <BaseModal :open="open" :title="title" @close="emit('close')">
    <p class="text-sm leading-relaxed text-ink/90"><slot>{{ message }}</slot></p>
    <div class="mt-6 flex justify-end gap-2">
      <BaseButton variant="secondary" @click="emit('close')">{{ cancelText }}</BaseButton>
      <BaseButton :variant="variant" :disabled="busy" @click="emit('confirm')">
        {{ busy ? '處理中…' : confirmText }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
