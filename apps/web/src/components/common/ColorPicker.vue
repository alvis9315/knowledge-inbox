<script setup lang="ts">
/**
 * 色彩選擇器(比照登入頁 Star Color 的形態):最左是自由取色 swatch
 * (包裝原生 color input,樣式化不裸露)+ 快選色票圓點。
 * v-model 是 hex 字串(可為 null=未設定)。
 */
withDefaults(
  defineProps<{ modelValue: string | null; presets?: string[]; disabled?: boolean }>(),
  { presets: () => [], disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <!-- 自由取色(原生 input 隱形疊在樣式化 swatch 上) -->
    <label
      class="relative h-6 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line shadow-sm transition hover:scale-105"
      title="自訂顏色"
    >
      <span class="absolute inset-0" :style="{ background: modelValue ?? 'linear-gradient(135deg,#f6f7f9 50%,#cbd5e1 50%)' }" />
      <input
        type="color"
        :value="modelValue ?? '#888888'"
        :disabled="disabled"
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button
      v-for="c in presets"
      :key="c"
      type="button"
      class="h-5 w-5 shrink-0 rounded-full ring-offset-2 ring-offset-surface transition hover:scale-110"
      :class="modelValue === c ? 'ring-2 ring-ink' : ''"
      :style="{ backgroundColor: c }"
      :disabled="disabled"
      :aria-label="`選擇顏色 ${c}`"
      @click="emit('update:modelValue', c)"
    />
  </div>
</template>
