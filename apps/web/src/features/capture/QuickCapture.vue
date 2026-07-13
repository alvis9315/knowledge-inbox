<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import TagInput from '@/components/common/TagInput.vue'
import CategoryCascader from '@/features/categories/components/CategoryCascader.vue'
import { createEntry } from '@/features/entries/api/entriesApi'
import { classifyText } from '@/features/capture/classify'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { toast } from '@/composables/useToast'
import { humanError } from '@/utils/humanError'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const store = useCategoriesStore()
const advanced = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  text: '',
  type: null as string | null,
  tags: [] as string[],
  pending: false,
})


function reset() {
  form.text = ''
  form.type = null
  form.tags = []
  form.pending = false
  advanced.value = false
  error.value = null
}

async function submit() {
  const text = form.text.trim()
  if (!text) {
    error.value = '請貼上內容'
    return
  }
  // Best-effort: if it looks like a URL, keep it as source_url too.
  const isUrl = /^https?:\/\/\S+$/i.test(text)
  saving.value = true
  error.value = null
  try {
    // No manual category → let the classifier guess (mock heuristic / Phase 2 LLM).
    let type = form.type
    let status: 'filed' | 'pending_review' = form.pending ? 'pending_review' : 'filed'
    if (!type) {
      const guess = await classifyText(text)
      if (guess.type && guess.confidence > 0.85 && !form.pending) {
        type = guess.type
        status = 'filed'
      } else {
        type = guess.type // best guess, still needs review
        status = 'pending_review'
      }
    }
    await createEntry({
      title: text.slice(0, 80),
      type,
      summary: null,
      content: text,
      source_url: isUrl ? text : null,
      attrs: {},
      status,
      tags: form.tags,
    })
    await store.touch()
    // 回饋:讓使用者知道進了哪裡(自動歸檔 vs 待確認)。
    const c = type ? store.typeByKey[type] : undefined
    if (status === 'filed' && c) toast.success(`已自動歸檔到「${c.domain} / ${c.name}」`)
    else toast.info(c ? `已加入待確認(建議:${c.domain} / ${c.name})` : '已加入待確認')
    reset()
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = humanError(e, '儲存失敗,請稍後再試')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="快速捕捉" @close="emit('close')">
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <textarea
        v-model="form.text"
        rows="4"
        autofocus
        placeholder="貼上任何文字或連結,⌘Enter 送出…"
        class="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        @keydown.meta.enter="submit"
        @keydown.ctrl.enter="submit"
      />

      <button
        type="button"
        class="flex w-fit items-center gap-1 text-xs text-muted hover:text-ink"
        @click="advanced = !advanced"
      >
        <ChevronDown :size="14" :class="advanced ? 'rotate-180' : ''" class="transition-transform" />
        進階(手動指定分類 / 標籤)
      </button>

      <div v-if="advanced" class="flex flex-col gap-3 rounded-lg bg-canvas p-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-muted">分類(留空 → 自動判斷 / 待確認)</span>
          <CategoryCascader v-model="form.type" placeholder="自動 / 待確認" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-muted">標籤</span>
          <TagInput v-model="form.tags" :suggestions="store.tagNames" />
        </label>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="emit('close')">取消</BaseButton>
        <BaseButton type="submit" :disabled="saving">{{ saving ? '儲存中…' : '儲存' }}</BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
