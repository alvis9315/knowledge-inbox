<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Check, Trash2, Wand2, ExternalLink, Plus, Clock } from 'lucide-vue-next'
import SearchableSelect from '@/components/common/SearchableSelect.vue'
import TagInput from '@/components/common/TagInput.vue'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import type { EntryWithTags } from '@/features/entries/types'

// 待確認審核列。欄位:標題(可改)、來源連結、內容摘要、建議分類、時間、
// 分類選擇(+快捷新增分類)、標籤(可改)、歸檔/刪除。歸檔 = 人核准 →
// 觸發分類器回饋自學。
const props = defineProps<{
  entry: EntryWithTags
  modelValue: string | null
  busy?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  file: [payload: { title: string; tags: string[] }]
  remove: []
  newCategory: []
}>()

const store = useCategoriesStore()

// 歸檔前可順手修標題/標籤(捕捉連結時標題常是網址,這裡改成人話)。
const title = ref(props.entry.title)
const tags = ref<string[]>([...props.entry.tags])

const typeOptions = computed(() =>
  store.categories.map((c) => ({ value: c.key, label: `${c.icon || '🏷️'} ${c.domain} / ${c.name}` })),
)
const suggested = computed(() => (props.entry.type ? store.typeByKey[props.entry.type] : undefined))
const createdAt = computed(() =>
  new Date(props.entry.created_at).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }),
)
const showContent = computed(
  () => props.entry.content && props.entry.content !== props.entry.title && props.entry.content !== props.entry.source_url,
)

function submit() {
  emit('file', { title: title.value.trim() || props.entry.title, tags: tags.value })
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
    <!-- title (editable) + suggestion -->
    <div class="flex items-start justify-between gap-3">
      <input
        v-model="title"
        type="text"
        class="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-medium text-ink transition-colors hover:border-line focus:border-accent focus:outline-none"
        placeholder="標題(可直接修改)"
      />
      <span
        v-if="suggested"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent"
        title="分類器建議"
      >
        <Wand2 :size="12" /> {{ suggested.domain }} / {{ suggested.name }}
      </span>
      <span v-else class="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">無建議</span>
    </div>

    <!-- source link + created time + detail -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <a
        v-if="entry.source_url"
        :href="entry.source_url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex max-w-full items-center gap-1 truncate text-accent hover:underline"
      >
        <ExternalLink :size="12" class="shrink-0" />
        <span class="truncate">{{ entry.source_url }}</span>
      </a>
      <span class="inline-flex items-center gap-1"><Clock :size="12" /> {{ createdAt }}</span>
      <RouterLink :to="{ name: 'entry-detail', params: { id: entry.id } }" class="hover:text-ink hover:underline">
        詳情
      </RouterLink>
    </div>

    <p v-if="showContent" class="line-clamp-2 break-words text-sm text-muted">{{ entry.content }}</p>

    <!-- classify + tags + actions -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="w-60 min-w-44">
        <SearchableSelect
          :model-value="modelValue"
          :options="typeOptions"
          placeholder="選擇分類…"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </div>
      <button
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-canvas hover:text-ink"
        title="找不到?新增分類"
        @click="emit('newCategory')"
      >
        <Plus :size="15" />
      </button>
      <div class="min-w-48 flex-1">
        <TagInput v-model="tags" :suggestions="store.tagNames" placeholder="標籤:台北市、大安區…(Enter 或點選)" />
      </div>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
        :disabled="busy || !modelValue"
        @click="submit"
      >
        <Check :size="15" /> 歸檔
      </button>
      <button
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-red-600"
        title="刪除"
        :disabled="busy"
        @click="emit('remove')"
      >
        <Trash2 :size="15" />
      </button>
    </div>
  </div>
</template>
