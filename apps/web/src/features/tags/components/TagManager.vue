<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, Plus, Pencil, Eye, EyeOff, Check, X } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { addTag, fetchTagsDetailed, renameTag, setTagHidden, type TagDetail } from '@/features/tags/api/tagsApi'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
const tags = ref<TagDetail[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const search = ref('')
const newTag = ref('')
const editing = ref<string | null>(null)
const editValue = ref('')

const filtered = computed(() => {
  const t = search.value.trim().toLowerCase()
  return t ? tags.value.filter((x) => x.name.toLowerCase().includes(t)) : tags.value
})

async function load() {
  loading.value = true
  error.value = null
  try {
    tags.value = await fetchTagsDetailed()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
watch(() => props.open, (o) => o && load())

async function doAdd() {
  const n = newTag.value.trim()
  if (!n) return
  try {
    await addTag(n)
    newTag.value = ''
    await load()
    await store.reload()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function startEdit(t: TagDetail) {
  editing.value = t.name
  editValue.value = t.name
}
async function saveEdit(oldName: string) {
  const nn = editValue.value.trim()
  editing.value = null
  if (!nn || nn === oldName) return
  try {
    await renameTag(oldName, nn)
    await load()
    await store.touch() // entries' tags changed
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
async function toggleHidden(t: TagDetail) {
  try {
    await setTagHidden(t.name, !t.hidden)
    await load()
    await store.reload()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="標籤管理" size="xl" @close="emit('close')">
    <div class="flex flex-col gap-3">
      <p class="text-xs text-muted">
        標籤可改名(會同步更新所有引用的項目)或隱藏。為避免影響既有資料,標籤**不提供刪除**——用「隱藏」讓它不再出現在篩選與建議中即可。
      </p>

      <!-- search + add -->
      <div class="flex flex-wrap gap-2">
        <div class="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search :size="15" class="text-muted" />
          <input
            v-model="search"
            type="search"
            placeholder="搜尋標籤…"
            class="w-full bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <form class="flex gap-2" @submit.prevent="doAdd">
          <input
            v-model="newTag"
            placeholder="新增標籤"
            class="w-36 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <BaseButton type="submit" size="sm"><Plus :size="15" /> 新增</BaseButton>
        </form>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- list -->
      <div class="max-h-[52vh] overflow-y-auto thin-scroll">
        <p v-if="!loading && filtered.length === 0" class="py-8 text-center text-sm text-muted">沒有標籤</p>
        <div
          v-for="t in filtered"
          :key="t.name"
          class="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-canvas"
          :class="t.hidden ? 'opacity-50' : ''"
        >
          <template v-if="editing === t.name">
            <input
              v-model="editValue"
              class="flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-sm text-ink focus:outline-none"
              @keyup.enter="saveEdit(t.name)"
              @keyup.esc="editing = null"
            />
            <button class="icon-btn text-accent" aria-label="儲存" @click="saveEdit(t.name)"><Check :size="16" /></button>
            <button class="icon-btn" aria-label="取消" @click="editing = null"><X :size="16" /></button>
          </template>
          <template v-else>
            <span class="flex-1 truncate text-sm text-ink">
              #{{ t.name }}
              <span v-if="t.hidden" class="ml-1 text-xs text-muted">(已隱藏)</span>
            </span>
            <span class="shrink-0 rounded bg-canvas px-2 py-0.5 text-xs text-muted">{{ t.count }} 筆</span>
            <button class="icon-btn" title="改名" @click="startEdit(t)"><Pencil :size="15" /></button>
            <button class="icon-btn" :title="t.hidden ? '取消隱藏' : '隱藏'" @click="toggleHidden(t)">
              <component :is="t.hidden ? EyeOff : Eye" :size="15" />
            </button>
          </template>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.icon-btn {
  border-radius: 0.375rem;
  padding: 0.25rem;
  color: var(--muted);
  transition: background-color 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--canvas);
  color: var(--ink);
}
</style>
