<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    type?: 'button' | 'submit'
    disabled?: boolean
    size?: 'sm' | 'md'
  }>(),
  { variant: 'primary', type: 'button', disabled: false, size: 'md' },
)

const styles: Record<string, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90 focus-visible:ring-accent',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas focus-visible:ring-accent',
  ghost: 'bg-transparent text-muted hover:bg-canvas hover:text-ink focus-visible:ring-accent',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
}
const sizes: Record<string, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
    :class="[styles[variant], sizes[size]]"
  >
    <slot />
  </button>
</template>
