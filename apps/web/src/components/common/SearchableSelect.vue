<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDown, Search, Check, X } from 'lucide-vue-next'

export interface SelectOption {
  value: string
  label: string
  icon?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string | null
    options: SelectOption[]
    placeholder?: string
    clearable?: boolean
  }>(),
  { placeholder: '請選擇', clearable: true },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const open = ref(false)
const term = ref('')
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) ?? null)
const filtered = computed(() => {
  const t = term.value.trim().toLowerCase()
  if (!t) return props.options
  return props.options.filter((o) => o.label.toLowerCase().includes(t))
})

function toggle() {
  open.value = !open.value
  if (open.value) term.value = ''
}
function pick(value: string) {
  emit('update:modelValue', value)
  open.value = false
}
function clear() {
  emit('update:modelValue', null)
  open.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      @click="toggle"
    >
      <span v-if="selected?.icon">{{ selected.icon }}</span>
      <span class="flex-1 truncate text-left" :class="selected ? '' : 'text-muted'">
        {{ selected ? selected.label : placeholder }}
      </span>
      <X
        v-if="clearable && selected"
        :size="14"
        class="shrink-0 text-muted hover:text-ink"
        @click.stop="clear"
      />
      <ChevronDown :size="15" class="shrink-0 text-muted" />
    </button>

    <div
      v-if="open"
      class="absolute z-20 mt-1 w-full min-w-52 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
    >
      <div class="flex items-center gap-2 border-b border-line px-3">
        <Search :size="14" class="text-muted" />
        <input
          v-model="term"
          autofocus
          placeholder="搜尋…"
          class="w-full bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>
      <ul class="max-h-60 overflow-y-auto py-1 thin-scroll">
        <li v-if="filtered.length === 0" class="px-3 py-2 text-sm text-muted">找不到符合項目</li>
        <li
          v-for="opt in filtered"
          :key="opt.value"
          class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-canvas"
          @click="pick(opt.value)"
        >
          <span v-if="opt.icon" class="shrink-0">{{ opt.icon }}</span>
          <span class="flex-1 truncate">{{ opt.label }}</span>
          <Check v-if="opt.value === modelValue" :size="14" class="shrink-0 text-accent" />
        </li>
      </ul>
    </div>
  </div>
</template>
