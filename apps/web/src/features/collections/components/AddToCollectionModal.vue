<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import { toast } from '@/composables/useToast'
import {
  addToCollection,
  createCollection,
  fetchCollections,
  type CollectionMeta,
} from '@/features/collections/api/collectionsApi'
import { humanError } from '@/utils/humanError'

// 「加入集合」:卡片與項目詳情共用同一顆(同流程同元件)。
// 可搜尋下拉選現有集合;＋ 快速新增後自動選中。
const props = defineProps<{ open: boolean; entryId: string | null; entryTitle?: string }>()
const emit = defineEmits<{ close: [] }>()

const collections = ref<CollectionMeta[]>([])
const selected = ref<string | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)

// 快速新增列(＋ 按鈕切換)
const creating = ref(false)
const newName = ref('')

watch(() => props.open, async (o) => {
  if (!o) return
  selected.value = null
  error.value = null
  creating.value = false
  newName.value = ''
  try {
    collections.value = await fetchCollections()
  } catch (e) {
    error.value = humanError(e, '載入集合失敗,請稍後再試')
  }
})

const options = () => collections.value.map((c) => ({ value: c.id, label: `${c.name}(${c.count})` }))

const quickCreate = async () => {
  const n = newName.value.trim()
  if (!n) return
  try {
    const id = await createCollection(n)
    collections.value = await fetchCollections()
    selected.value = id
    creating.value = false
    toast.success(`已建立集合「${n}」`)
  } catch (e) {
    error.value = humanError(e, '建立集合失敗,請稍後再試')
  }
}

const confirm = async () => {
  if (!props.entryId || !selected.value) return
  saving.value = true
  error.value = null
  try {
    await addToCollection(selected.value, props.entryId)
    const c = collections.value.find((x) => x.id === selected.value)
    toast.success(`已加入「${c?.name ?? '集合'}」`)
    emit('close')
  } catch (e) {
    error.value = humanError(e, '加入集合失敗,請稍後再試')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="加入集合" @close="emit('close')">
    <div class="flex flex-col gap-3">
      <p v-if="entryTitle" class="truncate text-sm text-muted">「{{ entryTitle }}」要收進哪個集合?</p>

      <SearchableSelect
        v-model="selected"
        :options="options()"
        placeholder="選擇集合…"
        action-title="新增集合"
        @action="creating = true"
      />

      <div v-if="creating" class="flex items-center gap-2">
        <input
          v-model="newName"
          placeholder="新集合名稱(如:東京五日遊)"
          class="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          @keyup.enter="quickCreate"
          @keyup.esc="creating = false"
        />
        <BaseButton size="sm" :disabled="!newName.trim()" @click="quickCreate">建立</BaseButton>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2 pt-1">
        <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
        <BaseButton :disabled="!selected || saving" @click="confirm">加入</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
