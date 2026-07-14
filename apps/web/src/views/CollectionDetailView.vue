<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowLeft, GripVertical, StickyNote, Trash2 } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import TypeBadge from '@/features/entries/components/TypeBadge.vue'
import { toast } from '@/composables/useToast'
import {
  fetchCollectionDetail,
  removeFromCollection,
  reorderCollectionEntries,
  setCollectionNote,
  type CollectionItem,
} from '@/features/collections/api/collectionsApi'
import { humanError } from '@/utils/humanError'

// 集合詳情:引用的項目列表(可拖曳排序、行內備註、移除)。
// 點列開項目詳情;移除只解除引用,項目本身不動。
const props = defineProps<{ id: string }>()
const router = useRouter()

const name = ref('')
const items = ref<CollectionItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const notFound = ref(false)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const d = await fetchCollectionDetail(props.id)
    if (!d) {
      notFound.value = true
      return
    }
    name.value = d.name
    items.value = d.items
  } catch (e) {
    error.value = humanError(e, '載入集合失敗,請重新整理再試')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const persistOrder = async () => {
  try {
    await reorderCollectionEntries(props.id, items.value.map((it) => it.entry.id))
  } catch (e) {
    error.value = humanError(e, '排序儲存失敗,請重新整理再試')
    await load()
  }
}

const removeItem = async (it: CollectionItem) => {
  try {
    await removeFromCollection(props.id, it.entry.id)
    items.value = items.value.filter((x) => x.entry.id !== it.entry.id)
    toast.success(`已從集合移除「${it.entry.title}」(項目本身還在)`)
  } catch (e) {
    error.value = humanError(e, '移除失敗,請稍後再試')
  }
}

// 行內備註(blur/Enter 存檔;空字串=清除)
const editingNote = ref<string | null>(null)
const noteValue = ref('')
const startNote = (it: CollectionItem) => {
  editingNote.value = it.entry.id
  noteValue.value = it.note ?? ''
}
const saveNote = async (it: CollectionItem) => {
  if (editingNote.value !== it.entry.id) return
  editingNote.value = null
  const next = noteValue.value.trim() || null
  if (next === it.note) return
  try {
    await setCollectionNote(props.id, it.entry.id, next)
    it.note = next
    toast.success('備註已更新')
  } catch (e) {
    error.value = humanError(e, '備註儲存失敗,請稍後再試')
  }
}

const openEntry = (it: CollectionItem) => {
  router.push({ name: 'entry-detail', params: { id: it.entry.id } })
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <RouterLink
      :to="{ name: 'collections' }"
      class="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-muted transition hover:text-ink"
    >
      <ArrowLeft :size="15" /> 回集合清單
    </RouterLink>

    <template v-if="notFound">
      <p class="py-16 text-center text-sm text-muted">找不到這個集合,可能已被刪除。</p>
    </template>
    <template v-else>
      <h1 class="mb-1 text-xl font-bold text-ink">{{ name }}</h1>
      <p class="mb-6 text-xs text-muted">{{ items.length }} 個項目 · 拖曳排序 · 點列開啟項目</p>

      <p v-if="error" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <p v-if="!loading && items.length === 0" class="py-16 text-center text-sm text-muted">
        這個集合還是空的——到任何項目卡片按「加入集合」把它收進來。
      </p>

      <VueDraggable
        v-model="items"
        handle=".drag-handle"
        :animation="150"
        class="space-y-2"
        @end="persistOrder"
      >
        <div
          v-for="it in items"
          :key="it.entry.id"
          class="entry-bg group flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 transition hover:border-accent"
          @click="openEntry(it)"
        >
          <button class="drag-handle mt-0.5 cursor-grab text-muted" aria-label="拖曳排序" @click.stop>
            <GripVertical :size="16" />
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm font-medium text-ink">{{ it.entry.title }}</p>
              <TypeBadge :type-key="it.entry.type" class="shrink-0" />
            </div>
            <!-- 備註:集合場景專屬(存在關聯上,不動項目本身) -->
            <div class="mt-1.5" @click.stop>
              <input
                v-if="editingNote === it.entry.id"
                v-model="noteValue"
                placeholder="這個項目在此集合的備註…(Enter 儲存)"
                class="w-full rounded-md border border-accent bg-surface px-2 py-1 text-xs text-ink focus:outline-none"
                @keyup.enter="saveNote(it)"
                @blur="saveNote(it)"
                @keyup.esc="editingNote = null"
              />
              <button
                v-else
                class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-muted transition hover:bg-canvas hover:text-ink"
                @click="startNote(it)"
              >
                <StickyNote :size="12" />
                {{ it.note || '加備註…' }}
              </button>
            </div>
          </div>
          <button
            class="icon-btn hidden shrink-0 hover:text-red-600 group-hover:block"
            title="從集合移除(項目本身還在)"
            @click.stop="removeItem(it)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </VueDraggable>
    </template>
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
