<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { UploadCloud, X, FileImage, FileVideo } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'

/**
 * 通用檔案上傳彈窗:點選或拖曳、型別/大小驗證(中文 inline)、即時預覽、
 * 檔名+紅X 移除、確認/取消。v-model 不持有檔案——確認時 emit file。
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** 允許的 MIME 前綴或完整型別,如 ['image/', 'video/mp4']。 */
    accept?: string[]
    maxImageBytes?: number
    maxVideoBytes?: number
    hint?: string
    /** 已有自訂檔案時顯示「移除,回復預設」。 */
    hasExisting?: boolean
  }>(),
  {
    title: '上傳檔案',
    accept: () => ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm'],
    maxImageBytes: 8 * 1024 * 1024,
    maxVideoBytes: 50 * 1024 * 1024,
    hint: '',
    hasExisting: false,
  },
)
const emit = defineEmits<{ close: []; confirm: [file: File]; removeExisting: [] }>()

const inputEl = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const error = ref<string | null>(null)
const dragOver = ref(false)
const previewUrl = ref<string | null>(null)

const isVideo = computed(() => file.value?.type.startsWith('video/') ?? false)
const acceptAttr = computed(() => props.accept.join(','))
const sizeLabel = computed(() =>
  file.value ? `${(file.value.size / 1024 / 1024).toFixed(1)} MB` : '',
)

function revoke() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}
onUnmounted(revoke)
watch(
  () => props.open,
  (o) => {
    if (o) {
      file.value = null
      error.value = null
      dragOver.value = false
      revoke()
    }
  },
)

function pick(f: File | undefined | null) {
  error.value = null
  if (!f) return
  const okType = props.accept.some((a) => (a.endsWith('/') ? f.type.startsWith(a) : f.type === a))
  if (!okType) {
    error.value = '不支援的檔案格式(支援 JPG / PNG / WebP / AVIF / GIF / MP4 / WebM)'
    return
  }
  const limit = f.type.startsWith('video/') ? props.maxVideoBytes : props.maxImageBytes
  if (f.size > limit) {
    error.value = `檔案太大(上限 ${Math.round(limit / 1024 / 1024)} MB),請壓縮後再試`
    return
  }
  file.value = f
  revoke()
  previewUrl.value = URL.createObjectURL(f)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  pick(e.dataTransfer?.files?.[0])
}
function clearFile() {
  file.value = null
  error.value = null
  revoke()
  if (inputEl.value) inputEl.value.value = ''
}
function confirm() {
  if (file.value) emit('confirm', file.value)
}
</script>

<template>
  <BaseModal :open="props.open" :title="title" size="lg" @close="emit('close')">
    <div class="flex flex-col gap-3">
      <!-- 拖曳 / 點選區 -->
      <button
        type="button"
        class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-sm transition-colors"
        :class="dragOver ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-accent hover:text-ink'"
        @click="inputEl?.click()"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <UploadCloud :size="28" />
        <span>點一下選擇檔案,或把檔案拖進來</span>
        <span v-if="hint" class="text-xs text-muted">{{ hint }}</span>
      </button>
      <input ref="inputEl" type="file" class="hidden" :accept="acceptAttr" @change="pick(($event.target as HTMLInputElement).files?.[0])" />

      <!-- 檔名 + 紅X + 預覽 -->
      <div v-if="file" class="flex flex-col gap-2">
        <div class="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-sm">
          <component :is="isVideo ? FileVideo : FileImage" :size="16" class="shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate text-ink">{{ file.name }}</span>
          <span class="shrink-0 text-xs text-muted">{{ sizeLabel }}</span>
          <button
            type="button"
            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-600"
            title="移除檔案"
            @click="clearFile"
          >
            <X :size="15" />
          </button>
        </div>
        <!-- 即時預覽(滿版 cover,和實際顯示同語意) -->
        <div class="overflow-hidden rounded-xl border border-line">
          <video v-if="previewUrl && isVideo" :src="previewUrl" class="h-44 w-full object-cover" autoplay muted loop playsinline />
          <img v-else-if="previewUrl" :src="previewUrl" alt="預覽" class="h-44 w-full object-cover" />
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="flex items-center justify-end gap-2 pt-1">
        <button
          v-if="hasExisting"
          type="button"
          class="mr-auto text-sm text-red-500 hover:underline"
          @click="emit('removeExisting')"
        >
          移除自訂封面,回復預設
        </button>
        <BaseButton variant="secondary" @click="emit('close')">取消</BaseButton>
        <BaseButton :disabled="!file" @click="confirm">確認</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
