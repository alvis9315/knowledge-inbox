<script setup lang="ts">
import { ref } from 'vue'

// A small dropdown that opens on hover (and click) and grows downward from the
// trigger. Reusable: put the trigger in the #trigger slot, menu items in default.
const open = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function show() {
  clearTimeout(timer)
  open.value = true
}
function scheduleHide() {
  clearTimeout(timer)
  timer = setTimeout(() => (open.value = false), 160)
}
</script>

<template>
  <div class="relative" @mouseenter="show" @mouseleave="scheduleHide">
    <slot name="trigger" :open="open" :toggle="() => (open = !open)" />
    <Transition name="hovermenu">
      <div
        v-if="open"
        class="absolute right-0 top-full z-40 mt-2 min-w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl"
        @mouseenter="show"
        @mouseleave="scheduleHide"
        @click="open = false"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hovermenu-enter-active,
.hovermenu-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.hovermenu-enter-from,
.hovermenu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
