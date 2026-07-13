<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDown } from 'lucide-vue-next'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'

/**
 * Emoji 選擇器(精選分組網格,零依賴)。v-model 是單一 emoji 字串。
 * 底部保留自由輸入,想貼任何系統 emoji 都行。
 */
const props = withDefaults(defineProps<{ modelValue: string; placeholder?: string }>(), {
  placeholder: '選 icon',
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
// 面板 Teleport 到 body,不被彈窗/捲動容器裁切。
const { open, style } = useAnchoredPanel(root, { panelWidth: 320, panelMaxHeight: 400 })
onClickOutside(root, () => (open.value = false), { ignore: [panel] })

function pick(e: string) {
  emit('update:modelValue', e)
  open.value = false
}

const GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: '美食',
    emojis: ['☕','🍵','🧋','🥤','🍶','🍺','🍷','🍸','🍹','🍽️','🥢','🍜','🍣','🍱','🍙','🍛','🍤','🥟','🍝','🍕','🍔','🌮','🥗','🥩','🍳','🥞','🥐','🍞','🧀','🍰','🧁','🍮','🦪','🍦','🍧','🍫','🍿','🍎','🍓','🍉','🥭'],
  },
  {
    label: '旅遊 / 地點',
    emojis: ['🗺️','🧭','📍','🗾','🏝️','🏖️','⛰️','🗻','🏕️','⛩️','🏯','🏰','🗼','🗽','🌋','♨️','🚗','🚌','🚄','✈️','🛫','🚢','🎡','🎢','🎠','🏨','🛏️','🧳','🌸','🍁'],
  },
  {
    label: '學習 / 工作',
    emojis: ['💻','🖥️','⌨️','📱','🤖','🧠','📚','📖','📓','📝','✏️','🖊️','📐','📏','🗄️','📊','📈','💼','🗂️','📄','🎓','🔬','🔭','⚙️','🛠️','🧩','💡','🗣️'],
  },
  {
    label: '攝影 / 媒體',
    emojis: ['📷','📸','🎥','🎬','🎞️','🖼️','🎨','🖌️','✒️','🎭','🎵','🎶','🎧','🎤','📻','🎮'],
  },
  {
    label: '社群 / 生活',
    emojis: ['📣','💬','🗨️','❤️','⭐','✨','🔥','👍','✍️','🧵','▶️','#️⃣','📈','🏠','🛋️','🪴','🛒','🎁','🐱','🐶','🐰','🦊','🐻','🐼','💪','🧘','⚽','🏀'],
  },
  {
    label: '符號 / 其他',
    emojis: ['🏷️','📌','📎','🔖','🔗','🔒','🔑','⏰','🕓','📅','✅','❌','⚠️','❓','❗','➕','🟢','🔵','🟡','🔴','🟣','⚪','🍀','🌙','☀️','🌈'],
  },
]
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm hover:bg-canvas focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      @click="open = !open"
    >
      <span v-if="modelValue" class="text-lg leading-none">{{ modelValue }}</span>
      <span v-else class="text-muted">{{ placeholder }}</span>
      <ChevronDown :size="14" class="ml-auto shrink-0 text-muted transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      :style="style"
      class="rounded-xl border border-line bg-surface shadow-xl"
    >
      <!-- 自由輸入置頂:清單沒有的,直接貼系統 emoji -->
      <div class="shrink-0 border-b border-line p-2">
        <input
          :value="modelValue"
          type="text"
          maxlength="4"
          placeholder="直接貼上任何 emoji,或從下方點選"
          class="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
        <div v-for="g in GROUPS" :key="g.label" class="mb-1.5">
          <p class="mb-0.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{{ g.label }}</p>
          <div class="grid grid-cols-9 gap-0.5">
            <button
              v-for="e in g.emojis"
              :key="e"
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-md text-lg transition hover:bg-canvas"
              :class="modelValue === e ? 'bg-accent-soft ring-1 ring-accent' : ''"
              @click="pick(e)"
            >
              {{ e }}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>
