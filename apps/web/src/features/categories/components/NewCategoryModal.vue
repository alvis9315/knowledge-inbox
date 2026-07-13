<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Undo2, Plus, X } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import EmojiPicker from '@/components/common/EmojiPicker.vue'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

/**
 * 新增分類:先定大類別(選現有 / ＋ 建新),下方批次新增子類別列
 * (＋ 一次加一列,要幾筆加幾次)。重複名稱即時 inline 紅字並擋送出。
 */
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

const creatingDomain = ref(false)
const form = reactive({ domainSel: '', newDomain: '' })

interface SubRow {
  name: string
  icon: string
}
const subs = ref<SubRow[]>([{ name: '', icon: '' }])

watch(
  () => props.open,
  (o) => {
    if (o) {
      form.domainSel = props.presetDomain ?? store.domains[0] ?? ''
      form.newDomain = ''
      subs.value = [{ name: '', icon: '' }]
      creatingDomain.value = props.startNewDomain || !store.domains.length
      error.value = null
    }
  },
)

const domainOptions = computed(() => store.domains.map((d) => ({ value: d, label: d })))
const effectiveDomain = computed(() => (creatingDomain.value ? form.newDomain.trim() : form.domainSel))

function addRow() {
  subs.value.push({ name: '', icon: '' })
}
function removeRow(i: number) {
  if (subs.value.length > 1) subs.value.splice(i, 1)
  else subs.value[0] = { name: '', icon: '' }
}

// ── 即時重複驗證(inline 紅字,不彈窗)──
const dupDomain = computed(
  () => creatingDomain.value && !!form.newDomain.trim() && store.domains.includes(form.newDomain.trim()),
)
/** 每列的錯誤訊息:與現有子類別重複 / 與上面的列重複。 */
const rowErrors = computed(() =>
  subs.value.map((row, i) => {
    const name = row.name.trim()
    if (!name) return null
    if (effectiveDomain.value && store.categories.some((c) => c.domain === effectiveDomain.value && c.name === name))
      return `「${effectiveDomain.value}」底下已有「${name}」`
    if (subs.value.slice(0, i).some((r) => r.name.trim() === name)) return `上面已輸入過「${name}」`
    return null
  }),
)
const validRows = computed(() => subs.value.filter((r) => r.name.trim()))
const canSubmit = computed(
  () =>
    !!effectiveDomain.value &&
    !dupDomain.value &&
    validRows.value.length > 0 &&
    rowErrors.value.every((e) => e === null) &&
    !saving.value,
)

/** Stable key from name; CJK names fall back to timestamp+index (批次不撞 key). */
function toKey(name: string, i: number): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return base || `cat_${Date.now().toString(36)}_${i}`
}

async function submit() {
  if (!canSubmit.value) return
  const domain = effectiveDomain.value
  saving.value = true
  error.value = null
  try {
    let firstKey: string | null = null
    for (const [i, row] of validRows.value.entries()) {
      const key = toKey(row.name, i)
      await store.addCategory({
        key,
        name: row.name.trim(),
        domain,
        description: `${domain}－${row.name.trim()}`,
        icon: row.icon.trim() || undefined,
      })
      firstKey ??= key
    }
    if (firstKey) emit('created', firstKey)
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
      <!-- 1. 大類別 -->
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

      <!-- 2. 子類別批次列:＋ 一次加一列 -->
      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-700">子類別 *</span>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-muted transition hover:bg-canvas hover:text-ink"
            @click="addRow"
          >
            <Plus :size="13" /> 再加一列
          </button>
        </div>
        <div class="flex flex-col gap-2">
          <div v-for="(row, i) in subs" :key="i">
            <div class="flex items-center gap-2">
              <div class="w-28 shrink-0">
                <EmojiPicker v-model="row.icon" placeholder="icon" />
              </div>
              <input
                v-model="row.name"
                type="text"
                :placeholder="i === 0 ? '子類別名稱,例如:餐酒館' : '子類別名稱'"
                class="h-10 min-w-0 flex-1 rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1"
                :class="rowErrors[i] ? 'border-red-400 focus:border-red-500 focus:ring-red-400' : 'border-line focus:border-accent focus:ring-accent'"
              />
              <button
                type="button"
                class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-red-600"
                title="移除此列"
                @click="removeRow(i)"
              >
                <X :size="15" />
              </button>
            </div>
            <p v-if="rowErrors[i]" class="mt-1 pl-30 text-xs text-red-600">{{ rowErrors[i] }},請換個名稱。</p>
          </div>
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div class="flex items-center justify-end gap-2">
        <span v-if="validRows.length > 1" class="mr-auto text-xs text-muted">將建立 {{ validRows.length }} 個子類別</span>
        <BaseButton variant="secondary" @click="emit('close')">取消</BaseButton>
        <BaseButton type="submit" :disabled="!canSubmit">{{ saving ? '建立中…' : '建立' }}</BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
