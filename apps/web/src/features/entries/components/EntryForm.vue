<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { parseAttrField, type Json } from '@inbox/shared-types'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import DateTimePicker from '@/components/common/DateTimePicker.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import type { EntryInput, EntryWithTags } from '@/features/entries/types'

const props = defineProps<{ entry?: EntryWithTags | null }>()
const emit = defineEmits<{ save: [input: EntryInput, id?: string]; cancel: [] }>()

const store = useCategoriesStore()
const saving = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  type: props.entry?.type ?? null as string | null,
  title: props.entry?.title ?? '',
  summary: props.entry?.summary ?? '',
  content: props.entry?.content ?? '',
  source_url: props.entry?.source_url ?? '',
  status: props.entry?.status ?? ('filed' as 'filed' | 'pending_review'),
  tagsText: (props.entry?.tags ?? []).join(', '),
})

// attrs is schema-driven: keyed by the selected type's attrs_schema.
const attrs = reactive<Record<string, string>>({})

// 營業時間 special-case: a start/end datetime range stored as "起 ~ 迄".
function splitRange(v: string): [string, string] {
  const p = (v || '').split(' ~ ')
  return [p[0] ?? '', p[1] ?? '']
}
function joinRange(s: string, e: string): string {
  return s || e ? `${s} ~ ${e}` : ''
}
const hoursStart = computed({
  get: () => splitRange(attrs['營業時間'] ?? '')[0],
  set: (v: string) => (attrs['營業時間'] = joinRange(v, splitRange(attrs['營業時間'] ?? '')[1])),
})
const hoursEnd = computed({
  get: () => splitRange(attrs['營業時間'] ?? '')[1],
  set: (v: string) => (attrs['營業時間'] = joinRange(splitRange(attrs['營業時間'] ?? '')[0], v)),
})

const selectedDef = computed(() => (form.type ? store.typeByKey[form.type] : undefined))

const attrFields = computed(() => {
  const schema = selectedDef.value?.attrs_schema
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return []
  return Object.entries(schema as Record<string, unknown>).map(([key, raw]) => ({
    key,
    ...parseAttrField(raw),
  }))
})

// When the type changes, rebuild the attr field set, keeping existing values.
watch(
  () => form.type,
  () => {
    const existing = (props.entry?.attrs ?? {}) as Record<string, unknown>
    const keep = { ...existing, ...attrs }
    for (const k of Object.keys(attrs)) delete attrs[k]
    for (const f of attrFields.value) {
      attrs[f.key] = keep[f.key] !== undefined && keep[f.key] !== null ? String(keep[f.key]) : ''
    }
  },
  { immediate: true },
)

const groupedTypes = computed(() => {
  const groups: Record<string, typeof store.typeDefinitions> = {}
  for (const t of store.typeDefinitions) (groups[t.domain] ??= []).push(t)
  return groups
})

async function submit() {
  formError.value = null
  if (!form.title.trim()) {
    formError.value = '請填寫標題'
    return
  }
  const cleanedAttrs: Record<string, Json> = {}
  for (const [k, v] of Object.entries(attrs)) if (v.trim()) cleanedAttrs[k] = v.trim()

  const input: EntryInput = {
    title: form.title.trim(),
    type: form.type,
    summary: form.summary.trim() || null,
    content: form.content.trim() || null,
    source_url: form.source_url.trim() || null,
    attrs: cleanedAttrs,
    status: form.status,
    tags: form.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
  }

  saving.value = true
  try {
    emit('save', input, props.entry?.id)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <BaseInput v-model="form.title" label="標題 *" placeholder="這筆內容叫什麼" />

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">類型</span>
      <select
        v-model="form.type"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
      >
        <option :value="null">未分類</option>
        <optgroup v-for="(list, domain) in groupedTypes" :key="domain" :label="domain">
          <option v-for="t in list" :key="t.key" :value="t.key">{{ t.name }}</option>
        </optgroup>
      </select>
    </label>

    <!-- schema-driven attribute fields -->
    <div v-if="attrFields.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <template v-for="field in attrFields" :key="field.key">
        <!-- 營業時間: start / end datetime pickers -->
        <div v-if="field.key === '營業時間'" class="sm:col-span-2">
          <span class="mb-1 block text-sm font-medium text-slate-700">營業時間(起 / 迄)</span>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="mb-1 block text-xs text-slate-500">起</span>
              <DateTimePicker v-model="hoursStart" placeholder="開始時間" />
            </div>
            <div>
              <span class="mb-1 block text-xs text-slate-500">迄</span>
              <DateTimePicker v-model="hoursEnd" placeholder="結束時間" />
            </div>
          </div>
        </div>
        <label v-else class="block">
          <span class="mb-1 block text-sm font-medium text-slate-700">{{ field.key }}</span>
          <select
            v-if="field.kind === 'enum'"
            v-model="attrs[field.key]"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            <option value="">—</option>
            <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <input
            v-else
            v-model="attrs[field.key]"
            type="text"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </label>
      </template>
    </div>

    <BaseInput v-model="form.summary" label="摘要" placeholder="一句話摘要" />
    <BaseInput v-model="form.source_url" label="來源網址" placeholder="https://…" />

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">內容</span>
      <textarea
        v-model="form.content"
        rows="4"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        placeholder="原始內容 / 筆記"
      />
    </label>

    <BaseInput v-model="form.tagsText" label="標籤(逗號分隔)" placeholder="高雄, 咖啡, 待訪" />

    <label class="flex items-center gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        :checked="form.status === 'pending_review'"
        class="rounded border-slate-300 text-accent-600 focus:ring-accent-500"
        @change="form.status = ($event.target as HTMLInputElement).checked ? 'pending_review' : 'filed'"
      />
      標記為待確認
    </label>

    <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <BaseButton variant="secondary" @click="emit('cancel')">取消</BaseButton>
      <BaseButton type="submit" :disabled="saving">{{ saving ? '儲存中…' : '儲存' }}</BaseButton>
    </div>
  </form>
</template>
