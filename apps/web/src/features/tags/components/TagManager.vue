<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, Plus, Pencil, Eye, EyeOff, Check, X, List, LayoutDashboard } from 'lucide-vue-next'
import { toast } from '@/composables/useToast'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { addTag, fetchTagsDetailed, renameTag, setTagHidden, type TagDetail } from '@/features/tags/api/tagsApi'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { humanError } from '@/utils/humanError'

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
const view = ref<'list' | 'cloud'>('list')

const filtered = computed(() => {
  const t = search.value.trim().toLowerCase()
  return t ? tags.value.filter((x) => x.name.toLowerCase().includes(t)) : tags.value
})

const load = async () => {
  loading.value = true
  error.value = null
  try {
    tags.value = await fetchTagsDetailed()
  } catch (e) {
    error.value = humanError(e, '標籤操作失敗,請稍後再試')
  } finally {
    loading.value = false
  }
}
watch(() => props.open, (o) => o && load())

const doAdd = async () => {
  const n = newTag.value.trim()
  if (!n) return
  // 已存在(含隱藏中)→ 明確告知,不默默吞掉。
  if (tags.value.some((t) => t.name === n)) {
    toast.info(`#${n} 已存在`)
    return
  }
  try {
    await addTag(n)
    newTag.value = ''
    search.value = ''
    await load()
    await store.reload()
    toast.success(`已新增 #${n}`)
  } catch (e) {
    error.value = humanError(e, '標籤操作失敗,請稍後再試')
  }
}

const startEdit = (t: TagDetail) => {
  editing.value = t.name
  editValue.value = t.name
}
const saveEdit = async (oldName: string) => {
  const nn = editValue.value.trim()
  editing.value = null
  if (!nn || nn === oldName) return
  try {
    await renameTag(oldName, nn)
    await load()
    await store.touch() // entries' tags changed
  } catch (e) {
    error.value = humanError(e, '標籤操作失敗,請稍後再試')
  }
}
const toggleHidden = async (t: TagDetail) => {
  try {
    await setTagHidden(t.name, !t.hidden)
    await load()
    await store.reload()
  } catch (e) {
    error.value = humanError(e, '標籤操作失敗,請稍後再試')
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="標籤管理" size="xl" @close="emit('close')">
    <div class="flex flex-col gap-3">
      <p class="text-sm font-medium text-ink">標籤可改名或隱藏,不提供刪除。</p>
      <ul class="-mt-1 space-y-0.5 text-xs text-muted">
        <li>· 改名會同步更新所有引用的項目</li>
        <li>· 隱藏後不再出現在篩選與建議,資料保留</li>
      </ul>

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
          <BaseButton type="submit" size="sm" :disabled="!newTag.trim()"><Plus :size="15" /> 新增</BaseButton>
        </form>
        <div class="flex rounded-lg border border-line p-0.5">
          <button
            type="button"
            class="rounded-md p-1.5"
            :class="view === 'list' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
            aria-label="清單模式"
            @click="view = 'list'"
          >
            <List :size="16" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5"
            :class="view === 'cloud' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
            aria-label="標籤牆模式"
            title="標籤牆(依文字長度自適應)"
            @click="view = 'cloud'"
          >
            <LayoutDashboard :size="16" />
          </button>
        </div>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- 標籤牆:chip 依文字長度自適應寬度 -->
      <div v-if="view === 'cloud'" class="max-h-[52vh] overflow-y-auto thin-scroll">
        <p v-if="!loading && filtered.length === 0" class="py-8 text-center text-sm text-muted">沒有標籤</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="t in filtered"
            :key="t.name"
            class="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink"
            :class="t.hidden ? 'opacity-50' : ''"
          >
            <template v-if="editing === t.name">
              <input
                v-model="editValue"
                class="w-28 rounded-md border border-accent bg-surface px-1.5 py-0.5 text-sm text-ink focus:outline-none"
                @keyup.enter="saveEdit(t.name)"
                @keyup.esc="editing = null"
              />
              <button class="icon-btn text-accent" aria-label="儲存" @click="saveEdit(t.name)"><Check :size="14" /></button>
            </template>
            <template v-else>
              #{{ t.name }}
              <span class="text-xs text-muted">{{ t.count }}</span>
              <button class="icon-btn" title="改名" @click="startEdit(t)"><Pencil :size="13" /></button>
              <button class="icon-btn" :title="t.hidden ? '取消隱藏' : '隱藏'" @click="toggleHidden(t)">
                <component :is="t.hidden ? EyeOff : Eye" :size="13" />
              </button>
            </template>
          </span>
        </div>
      </div>

      <!-- list -->
      <div v-else class="max-h-[52vh] overflow-y-auto thin-scroll">
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
