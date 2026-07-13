<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { X, Plus, Tag } from 'lucide-vue-next'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'

/**
 * 標籤輸入(chips + combobox):打字按 Enter(或逗號)生成一顆標籤;
 * 下拉可搜尋並點選「現有標籤」;Backspace 在空輸入時刪最後一顆。
 * v-model 是 string[]。
 */
const props = withDefaults(
  defineProps<{ modelValue: string[]; suggestions?: string[]; placeholder?: string }>(),
  { suggestions: () => [], placeholder: '輸入後按 Enter,或從清單選…' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const text = ref('')
// 面板 Teleport 到 body,不被彈窗/捲動容器裁切。
const { open, style } = useAnchoredPanel(root, { panelMaxHeight: 224 })
onClickOutside(root, () => (open.value = false), { ignore: [panel] })

const filtered = computed(() => {
  const t = text.value.trim().toLowerCase()
  return props.suggestions
    .filter((s) => !props.modelValue.includes(s))
    .filter((s) => !t || s.toLowerCase().includes(t))
    .slice(0, 8)
})
// 輸入的字不在現有標籤中 → 提供「建立」選項。
const canCreate = computed(() => {
  const t = text.value.trim()
  return !!t && !props.modelValue.includes(t) && !props.suggestions.includes(t)
})

function add(tag: string) {
  const t = tag.trim()
  if (!t || props.modelValue.includes(t)) {
    text.value = ''
    return
  }
  emit('update:modelValue', [...props.modelValue, t])
  text.value = ''
  inputEl.value?.focus()
}
function removeAt(i: number) {
  const next = [...props.modelValue]
  next.splice(i, 1)
  emit('update:modelValue', next)
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (text.value.trim()) add(text.value)
  } else if (e.key === ',' || e.key === '、') {
    e.preventDefault()
    add(text.value)
  } else if (e.key === 'Backspace' && !text.value && props.modelValue.length) {
    removeAt(props.modelValue.length - 1)
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <div
      class="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
      @click="inputEl?.focus(); open = true"
    >
      <span
        v-for="(tag, i) in modelValue"
        :key="tag"
        class="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent"
      >
        #{{ tag }}
        <button
          type="button"
          class="rounded-full transition-colors hover:text-red-600"
          :aria-label="`移除標籤 ${tag}`"
          @click.stop="removeAt(i)"
        >
          <X :size="11" />
        </button>
      </span>
      <input
        ref="inputEl"
        v-model="text"
        type="text"
        class="min-w-28 flex-1 bg-transparent py-0.5 text-sm text-ink placeholder:text-muted focus:outline-none"
        :placeholder="modelValue.length ? '' : placeholder"
        @focus="open = true"
        @keydown="onKeydown"
      />
    </div>

    <Teleport to="body">
    <div
      v-if="open && (filtered.length || canCreate)"
      ref="panel"
      :style="style"
      class="rounded-xl border border-line bg-surface shadow-xl"
    >
      <div class="min-h-0 flex-1 overflow-y-auto p-1 thin-scroll">
        <button
          v-for="s in filtered"
          :key="s"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-ink hover:bg-canvas"
          @click="add(s)"
        >
          <Tag :size="13" class="shrink-0 text-muted" /> {{ s }}
        </button>
        <button
          v-if="canCreate"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-accent hover:bg-canvas"
          @click="add(text)"
        >
          <Plus :size="13" class="shrink-0" /> 建立「{{ text.trim() }}」
        </button>
      </div>
    </div>
    </Teleport>
  </div>
</template>
