<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Undo2 } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import EmojiPicker from '@/components/common/EmojiPicker.vue'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** 預先帶入的大類別(如審核列 cascader 的「在美食新增子類別」)。 */
    presetDomain?: string | null
    /** 直接開在「建立新大類別」模式。 */
    startNewDomain?: boolean
  }>(),
  { presetDomain: null, startNewDomain: false },
)
const emit = defineEmits<{ close: []; created: [key: string] }>()

const store = useCategoriesStore()
const saving = ref(false)
const error = ref<string | null>(null)

// 大類別:預設下拉選現有;按搜尋框旁 ＋ 切換成「建立新大類別」輸入模式。
const creatingDomain = ref(false)
const form = reactive({ name: '', domainSel: '', newDomain: '', icon: '', description: '' })

watch(
  () => props.open,
  (o) => {
    if (o) {
      form.name = ''
      form.domainSel = props.presetDomain ?? store.domains[0] ?? ''
      form.newDomain = ''
      form.icon = ''
      form.description = ''
      creatingDomain.value = props.startNewDomain || !store.domains.length
      error.value = null
    }
  },
)

const domainOptions = computed(() => store.domains.map((d) => ({ value: d, label: d })))
const effectiveDomain = computed(() => (creatingDomain.value ? form.newDomain.trim() : form.domainSel))

// 即時重複驗證(inline 紅字 + disable 建立;不打斷流程,不用彈窗)。
const dupDomain = computed(
  () => creatingDomain.value && !!form.newDomain.trim() && store.domains.includes(form.newDomain.trim()),
)
const dupSub = computed(
  () =>
    !!form.name.trim() &&
    !!effectiveDomain.value &&
    store.categories.some((c) => c.domain === effectiveDomain.value && c.name === form.name.trim()),
)
const canSubmit = computed(
  () => !!form.name.trim() && !!effectiveDomain.value && !dupDomain.value && !dupSub.value && !saving.value,
)

/** Derive a stable snake_case-ish key from the name (fallback to timestamp). */
function toKey(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return base || `cat_${Date.now()}`
}

async function submit() {
  if (!canSubmit.value) return
  const domain = effectiveDomain.value
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
      <!-- 階層順序:先大類別,再子類別 -->
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
            class="h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1"
            :class="dupDomain ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : 'border-line focus:border-accent focus:ring-accent'"
          />
          <p v-if="dupDomain" class="mt-1 text-xs text-red-600">大類別「{{ form.newDomain.trim() }}」已存在,請改用「改選現有」。</p>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">Icon</span>
          <EmojiPicker v-model="form.icon" />
        </label>
      </div>

      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">子類別名稱 *</span>
        <input
          v-model="form.name"
          type="text"
          placeholder="例如:餐酒館"
          class="h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1"
          :class="dupSub ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : 'border-line focus:border-accent focus:ring-accent'"
        />
        <p v-if="dupSub" class="mt-1 text-xs text-red-600">「{{ effectiveDomain }}」底下已有「{{ form.name.trim() }}」,請換個名稱。</p>
      </label>

      <BaseInput v-model="form.description" label="描述(給分類器判斷用,可留空)" placeholder="什麼樣的內容屬於這類" />
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="emit('close')">取消</BaseButton>
        <BaseButton type="submit" :disabled="!canSubmit">{{ saving ? '建立中…' : '建立' }}</BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
