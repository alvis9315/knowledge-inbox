<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Undo2 } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import EmojiPicker from '@/components/common/EmojiPicker.vue'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [key: string] }>()

const store = useCategoriesStore()
const saving = ref(false)
const error = ref<string | null>(null)

// 大類別:預設下拉選現有;按旁邊的 ＋ 切換成「建立新大類別」輸入模式。
const creatingDomain = ref(false)
const form = reactive({ name: '', domainSel: '', newDomain: '', icon: '', description: '' })

watch(
  () => props.open,
  (o) => {
    if (o) {
      form.name = ''
      form.domainSel = store.domains[0] ?? ''
      form.newDomain = ''
      form.icon = ''
      form.description = ''
      creatingDomain.value = !store.domains.length
      error.value = null
    }
  },
)

const domainOptions = computed(() => store.domains.map((d) => ({ value: d, label: d })))

/** Derive a stable snake_case-ish key from the name (fallback to timestamp). */
function toKey(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return base || `cat_${Date.now()}`
}

async function submit() {
  if (!form.name.trim()) {
    error.value = '請填寫子類別名稱'
    return
  }
  const domain = creatingDomain.value ? form.newDomain.trim() : form.domainSel
  if (!domain) {
    error.value = creatingDomain.value ? '請輸入新大類別名稱' : '請選擇大類別'
    return
  }
  saving.value = true
  error.value = null
  try {
    const key = toKey(form.name)
    await store.addCategory({
      key,
      name: form.name.trim(),
      domain,
      description: form.description.trim() || `${domain}－${form.name.trim()}`,
      icon: form.icon.trim() || undefined,
    })
    emit('created', key)
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="新增分類" size="lg" @close="emit('close')">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <BaseInput v-model="form.name" label="子類別名稱 *" placeholder="例如:餐酒館" />

      <div class="grid grid-cols-2 gap-4">
        <label class="block">
          <span class="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
            大類別 *
            <button
              v-if="creatingDomain && store.domains.length"
              type="button"
              class="inline-flex items-center gap-1 text-xs font-normal text-accent hover:underline"
              @click="creatingDomain = false"
            >
              <Undo2 :size="12" /> 改選現有
            </button>
          </span>
          <!-- 可搜尋下拉;＋ 在搜尋框右側(同審核列的分類選擇邏輯) -->
          <SearchableSelect
            v-if="!creatingDomain"
            :model-value="form.domainSel"
            :options="domainOptions"
            :clearable="false"
            placeholder="選擇大類別…"
            action-title="建立新大類別"
            @update:model-value="form.domainSel = $event ?? ''"
            @action="creatingDomain = true"
          />
          <input
            v-else
            v-model="form.newDomain"
            type="text"
            placeholder="新大類別名稱,例如:公仔收藏"
            class="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Icon</span>
          <EmojiPicker v-model="form.icon" />
        </label>
      </div>

      <BaseInput v-model="form.description" label="描述(給分類器判斷用,可留空)" placeholder="什麼樣的內容屬於這類" />
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="emit('close')">取消</BaseButton>
        <BaseButton type="submit" :disabled="saving">{{ saving ? '建立中…' : '建立' }}</BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
