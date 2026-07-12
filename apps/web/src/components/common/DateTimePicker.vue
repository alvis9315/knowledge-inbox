<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-vue-next'

// Modern, minimal, self-contained date + time picker. v-model is a
// "YYYY-MM-DD HH:mm" string (empty = unset). Reusable anywhere.
const props = withDefaults(defineProps<{ modelValue: string; placeholder?: string }>(), {
  placeholder: '選擇時間',
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

interface Parts {
  y: number
  m: number // 1-12
  d: number
  h: number
  min: number
}

const pad = (n: number) => String(n).padStart(2, '0')

function parse(v: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(v.trim())
  if (!m) return null
  return { y: +m[1], m: +m[2], d: +m[3], h: +m[4], min: +m[5] }
}
function format(p: Parts): string {
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.min)}`
}

const open = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

const now = new Date()
const sel = ref<Parts | null>(parse(props.modelValue))
const view = ref({ y: sel.value?.y ?? now.getFullYear(), m: sel.value?.m ?? now.getMonth() + 1 })

watch(
  () => props.modelValue,
  (v) => {
    sel.value = parse(v)
    if (sel.value) view.value = { y: sel.value.y, m: sel.value.m }
  },
)

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const cells = computed(() => {
  const first = new Date(view.value.y, view.value.m - 1, 1).getDay()
  const days = new Date(view.value.y, view.value.m, 0).getDate()
  const out: (number | null)[] = Array(first).fill(null)
  for (let d = 1; d <= days; d++) out.push(d)
  return out
})

function shiftMonth(delta: number) {
  let m = view.value.m + delta
  let y = view.value.y
  if (m < 1) { m = 12; y-- }
  if (m > 12) { m = 1; y++ }
  view.value = { y, m }
}
function shiftYear(delta: number) {
  view.value = { ...view.value, y: view.value.y + delta }
}

function commit(next: Parts) {
  sel.value = next
  emit('update:modelValue', format(next))
}
function pickDay(d: number) {
  const base = sel.value ?? { y: view.value.y, m: view.value.m, d, h: 9, min: 0 }
  commit({ ...base, y: view.value.y, m: view.value.m, d })
}
function setTime(h: number, min: number) {
  const base = sel.value ?? { y: view.value.y, m: view.value.m, d: now.getDate(), h, min }
  commit({ ...base, h, min })
}
function isSelected(d: number) {
  return sel.value && sel.value.y === view.value.y && sel.value.m === view.value.m && sel.value.d === d
}
function clear() {
  sel.value = null
  emit('update:modelValue', '')
  open.value = false
}

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 12 }, (_, i) => i * 5)
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      @click="open = !open"
    >
      <CalendarDays :size="15" class="shrink-0 text-muted" />
      <span class="flex-1 truncate text-left" :class="modelValue ? '' : 'text-muted'">
        {{ modelValue || placeholder }}
      </span>
      <X v-if="modelValue" :size="14" class="shrink-0 text-muted hover:text-ink" @click.stop="clear" />
    </button>

    <div
      v-if="open"
      class="absolute z-30 mt-1 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl"
    >
      <!-- month / year nav -->
      <div class="mb-2 flex items-center justify-between">
        <button class="icon" @click="shiftYear(-1)" title="上一年">«</button>
        <button class="icon" @click="shiftMonth(-1)"><ChevronLeft :size="16" /></button>
        <span class="text-sm font-medium text-ink">{{ view.y }} 年 {{ view.m }} 月</span>
        <button class="icon" @click="shiftMonth(1)"><ChevronRight :size="16" /></button>
        <button class="icon" @click="shiftYear(1)" title="下一年">»</button>
      </div>

      <!-- calendar -->
      <div class="grid grid-cols-7 gap-0.5 text-center text-xs text-muted">
        <span v-for="w in WEEKDAYS" :key="w" class="py-1">{{ w }}</span>
        <template v-for="(c, i) in cells" :key="i">
          <span v-if="c === null" />
          <button
            v-else
            class="rounded-md py-1 text-sm text-ink hover:bg-canvas"
            :class="isSelected(c) ? 'bg-accent text-accent-fg hover:bg-accent' : ''"
            @click="pickDay(c)"
          >
            {{ c }}
          </button>
        </template>
      </div>

      <!-- time -->
      <div class="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <span class="text-xs text-muted">時間</span>
        <select
          class="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus:outline-none"
          :value="sel?.h ?? 9"
          @change="setTime(+($event.target as HTMLSelectElement).value, sel?.min ?? 0)"
        >
          <option v-for="h in hours" :key="h" :value="h">{{ pad(h) }}</option>
        </select>
        <span class="text-muted">:</span>
        <select
          class="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus:outline-none"
          :value="sel?.min ?? 0"
          @change="setTime(sel?.h ?? 9, +($event.target as HTMLSelectElement).value)"
        >
          <option v-for="mn in minutes" :key="mn" :value="mn">{{ pad(mn) }}</option>
        </select>
        <button class="ml-auto text-xs text-accent hover:underline" @click="open = false">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.icon {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  color: var(--muted);
}
.icon:hover {
  background: var(--canvas);
  color: var(--ink);
}
</style>
