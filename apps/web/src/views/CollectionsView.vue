<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Boxes, Plus, Pencil, Trash2, Check, X } from 'lucide-vue-next'
import BaseConfirm from '@/components/common/BaseConfirm.vue'
import { toast } from '@/composables/useToast'
import {
  createCollection,
  deleteCollection,
  fetchCollections,
  renameCollection,
  type CollectionMeta,
} from '@/features/collections/api/collectionsApi'
import { humanError } from '@/utils/humanError'

// 集合清單:把多筆項目組成場景(行程/清單)。集合只引用項目,不複製內容。
const collections = ref<CollectionMeta[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    collections.value = await fetchCollections()
  } catch (e) {
    error.value = humanError(e, '載入集合失敗,請重新整理再試')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// 新增(inline 輸入,便利優先:不開彈窗)
const adding = ref(false)
const newName = ref('')
const doCreate = async () => {
  const n = newName.value.trim()
  if (!n) return
  try {
    await createCollection(n)
    newName.value = ''
    adding.value = false
    await load()
    toast.success(`已建立集合「${n}」`)
  } catch (e) {
    error.value = humanError(e, '建立集合失敗,請稍後再試')
  }
}

// 改名(inline)
const editing = ref<string | null>(null)
const editValue = ref('')
const startEdit = (c: CollectionMeta) => {
  editing.value = c.id
  editValue.value = c.name
}
const saveEdit = async (c: CollectionMeta) => {
  const n = editValue.value.trim()
  editing.value = null
  if (!n || n === c.name) return
  try {
    await renameCollection(c.id, n)
    await load()
    toast.success(`已改名為「${n}」`)
  } catch (e) {
    error.value = humanError(e, '改名失敗,請稍後再試')
  }
}

// 刪除(破壞性 → BaseConfirm;只刪集合,項目本身不受影響)
const removing = ref<CollectionMeta | null>(null)
const doRemove = async () => {
  const c = removing.value
  if (!c) return
  removing.value = null
  try {
    await deleteCollection(c.id)
    await load()
    toast.success(`已刪除集合「${c.name}」(裡面的項目不受影響)`)
  } catch (e) {
    error.value = humanError(e, '刪除失敗,請稍後再試')
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6">
    <header class="mb-6 flex items-center justify-between gap-3">
      <h1 class="flex items-center gap-2 text-xl font-bold text-ink">
        <Boxes :size="22" class="text-accent" /> 集合
      </h1>
      <div class="flex items-center gap-2">
        <template v-if="adding">
          <input
            v-model="newName"
            placeholder="集合名稱(如:東京五日遊)"
            class="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            @keyup.enter="doCreate"
            @keyup.esc="adding = false"
          />
          <button class="icon-btn text-accent" aria-label="建立" @click="doCreate"><Check :size="18" /></button>
          <button class="icon-btn" aria-label="取消" @click="adding = false"><X :size="18" /></button>
        </template>
        <button
          v-else
          class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
          @click="adding = true; newName = ''"
        >
          <Plus :size="16" /> 新增集合
        </button>
      </div>
    </header>

    <p v-if="error" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

    <p v-if="!loading && collections.length === 0" class="py-16 text-center text-sm text-muted">
      還沒有集合——把相關項目組成一個場景(行程、清單、專題)就從「新增集合」開始。
    </p>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="c in collections"
        :key="c.id"
        class="card-bg group relative rounded-xl border border-line p-4 transition hover:border-accent"
      >
        <template v-if="editing === c.id">
          <div class="flex items-center gap-2">
            <input
              v-model="editValue"
              class="flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-sm font-semibold text-ink focus:outline-none"
              @keyup.enter="saveEdit(c)"
              @keyup.esc="editing = null"
            />
            <button class="icon-btn text-accent" aria-label="儲存" @click="saveEdit(c)"><Check :size="16" /></button>
            <button class="icon-btn" aria-label="取消" @click="editing = null"><X :size="16" /></button>
          </div>
        </template>
        <template v-else>
          <RouterLink :to="{ name: 'collection-detail', params: { id: c.id } }" class="block">
            <p class="truncate text-base font-semibold text-ink">{{ c.name }}</p>
            <p class="mt-1 text-xs text-muted">{{ c.count }} 個項目</p>
          </RouterLink>
          <div class="absolute right-3 top-3 hidden gap-1 group-hover:flex">
            <button class="icon-btn" title="改名" @click.stop="startEdit(c)"><Pencil :size="14" /></button>
            <button class="icon-btn hover:text-red-600" title="刪除" @click.stop="removing = c"><Trash2 :size="14" /></button>
          </div>
        </template>
      </div>
    </div>

    <BaseConfirm
      :open="removing !== null"
      title="刪除集合?"
      :message="removing ? `「${removing.name}」會被刪除;裡面引用的項目本身不受影響。` : ''"
      confirm-text="刪除"
      variant="danger"
      @confirm="doRemove"
      @close="removing = null"
    />
  </div>
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
