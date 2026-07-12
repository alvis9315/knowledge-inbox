<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
const saving = ref(false)
const error = ref<string | null>(null)

const form = reactive({ name: '', domain: '生活', icon: '', description: '' })

watch(
  () => props.open,
  (o) => {
    if (o) {
      form.name = ''
      form.domain = store.domains[0] ?? '生活'
      form.icon = ''
      form.description = ''
      error.value = null
    }
  },
)

/** Derive a stable snake_case-ish key from the name (fallback to timestamp). */
function toKey(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return base || `cat_${Date.now()}`
}

async function submit() {
  if (!form.name.trim()) {
    error.value = '請填寫分類名稱'
    return
  }
  saving.value = true
  error.value = null
  try {
    await store.addCategory({
      key: toKey(form.name),
      name: form.name.trim(),
      domain: form.domain.trim() || '其他',
      description: form.description.trim() || form.name.trim(),
      icon: form.icon.trim() || undefined,
    })
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="新增分類" @close="emit('close')">
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <BaseInput v-model="form.name" label="名稱 *" placeholder="例如:居家好物" />
      <div class="grid grid-cols-2 gap-3">
        <BaseInput v-model="form.domain" label="領域" placeholder="生活 / 技術…" />
        <BaseInput v-model="form.icon" label="Icon(emoji)" placeholder="🏠" />
      </div>
      <BaseInput v-model="form.description" label="描述(給 AI 分類判斷用)" placeholder="什麼樣的內容屬於這類" />
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="emit('close')">取消</BaseButton>
        <BaseButton type="submit" :disabled="saving">{{ saving ? '建立中…' : '建立' }}</BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
