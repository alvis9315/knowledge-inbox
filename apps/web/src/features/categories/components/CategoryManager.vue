<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, Pencil, Check, X, ChevronRight } from 'lucide-vue-next'
import { toast } from '@/composables/useToast'
import BaseModal from '@/components/common/BaseModal.vue'
import { renameCategory, renameDomain } from '@/features/categories/api/categoriesApi'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { humanError } from '@/utils/humanError'

// 類別管理:大類別/子類別改名。項目歸檔綁的是分類 key,
// 名稱只是顯示文字——改名不影響任何既有資料。
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
const search = ref('')
const error = ref<string | null>(null)

// 編輯狀態:'d:大類別名' 或 'c:分類key',一次只編一個。
const editing = ref<string | null>(null)
const editValue = ref('')
const saving = ref(false)

// 大類別收合狀態:預設全收合;搜尋時自動展開有命中的。
const expanded = ref<Record<string, boolean>>({})
const toggleDomain = (d: string) => {
  expanded.value = { ...expanded.value, [d]: !expanded.value[d] }
}
const isExpanded = (d: string) => !!search.value.trim() || !!expanded.value[d]

watch(() => props.open, (o) => {
  if (o) {
    search.value = ''
    error.value = null
    editing.value = null
    expanded.value = {}
  }
})

const groups = computed(() => {
  const t = search.value.trim().toLowerCase()
  return store.domains
    .map((domain) => ({
      domain,
      items: store.categories.filter(
        (c) =>
          c.domain === domain &&
          (!t || c.name.toLowerCase().includes(t) || domain.toLowerCase().includes(t)),
      ),
    }))
    .filter((g) => g.items.length > 0 || g.domain.toLowerCase().includes(t))
})

const startEdit = (id: string, current: string) => {
  editing.value = id
  editValue.value = current
}

// 大類別改名後,本機以「名稱」為 key 的設定要跟著搬(主題指派/收合/輪播隱藏)。
const migrateDomainLocalKeys = (oldD: string, newD: string) => {
  try {
    const themeRaw = localStorage.getItem('ki-domain-theme')
    if (themeRaw) {
      const m = JSON.parse(themeRaw) as Record<string, string>
      if (m[oldD]) {
        m[newD] = m[oldD]
        delete m[oldD]
        localStorage.setItem('ki-domain-theme', JSON.stringify(m))
      }
    }
    const collapsedRaw = localStorage.getItem('ki-expanded-domains-v1')
    if (collapsedRaw) {
      const m = JSON.parse(collapsedRaw) as Record<string, boolean>
      if (oldD in m) {
        m[newD] = m[oldD]
        delete m[oldD]
        localStorage.setItem('ki-expanded-domains-v1', JSON.stringify(m))
      }
    }
    const hiddenRaw = localStorage.getItem('ki-carousel-hidden-domains')
    if (hiddenRaw) {
      const list = JSON.parse(hiddenRaw) as string[]
      const i = list.indexOf(oldD)
      if (i >= 0) {
        list[i] = newD
        localStorage.setItem('ki-carousel-hidden-domains', JSON.stringify(list))
      }
    }
  } catch (e) {
    console.warn('[category-manager] 本機設定搬移失敗(改名本身已成功):', e)
  }
}

const saveDomain = async (oldName: string) => {
  const next = editValue.value.trim()
  editing.value = null
  if (!next || next === oldName) return
  if (store.domains.includes(next)) {
    error.value = `已存在大類別「${next}」,請換個名稱`
    return
  }
  saving.value = true
  error.value = null
  try {
    await renameDomain(oldName, next)
    migrateDomainLocalKeys(oldName, next)
    await store.reload()
    toast.success(`大類別「${oldName}」已改名為「${next}」`)
  } catch (e) {
    error.value = humanError(e, '改名失敗,請稍後再試')
  } finally {
    saving.value = false
  }
}

const saveCategory = async (key: string, oldName: string) => {
  const next = editValue.value.trim()
  editing.value = null
  if (!next || next === oldName) return
  saving.value = true
  error.value = null
  try {
    await renameCategory(key, next)
    await store.reload()
    toast.success(`「${oldName}」已改名為「${next}」`)
  } catch (e) {
    error.value = humanError(e, '改名失敗,請稍後再試')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="類別管理" size="lg" @close="emit('close')">
    <div class="flex flex-col gap-3">
      <p class="text-sm font-medium text-ink">大類別與子類別都可以改名。</p>
      <ul class="-mt-1 space-y-0.5 text-xs text-muted">
        <li>· 項目歸檔綁的是分類代號,改名不影響任何既有資料</li>
        <li>· 大類別改名會一併搬移它的主題風格與 icon 設定</li>
      </ul>

      <div class="flex items-center gap-2 rounded-lg border border-line bg-surface px-3">
        <Search :size="15" class="text-muted" />
        <input
          v-model="search"
          type="search"
          placeholder="搜尋大類別或子類別…"
          class="w-full bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="h-[52vh] overflow-y-auto thin-scroll" :class="saving ? 'pointer-events-none opacity-60' : ''">
        <p v-if="groups.length === 0" class="py-10 text-center text-sm text-muted">沒有符合的類別</p>
        <div v-for="g in groups" :key="g.domain" class="mb-2">
          <!-- 大類別列(整列點擊 = 收合/展開;預設收合) -->
          <div
            class="flex cursor-pointer items-center gap-2 rounded-lg bg-canvas px-2.5 py-2"
            @click="editing !== `d:${g.domain}` && toggleDomain(g.domain)"
          >
            <ChevronRight
              :size="15"
              class="shrink-0 text-muted transition-transform"
              :class="isExpanded(g.domain) ? 'rotate-90' : ''"
            />
            <template v-if="editing === `d:${g.domain}`">
              <input
                v-model="editValue"
                class="flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-sm font-semibold text-ink focus:outline-none"
                @click.stop
                @keyup.enter="saveDomain(g.domain)"
                @keyup.esc="editing = null"
              />
              <button class="icon-btn text-accent" aria-label="儲存" @click.stop="saveDomain(g.domain)"><Check :size="16" /></button>
              <button class="icon-btn" aria-label="取消" @click.stop="editing = null"><X :size="16" /></button>
            </template>
            <template v-else>
              <span class="flex-1 truncate text-sm font-semibold text-ink">{{ g.domain }}</span>
              <span class="shrink-0 text-xs text-muted">{{ g.items.length }} 個子類別</span>
              <button class="icon-btn" title="改名" @click.stop="startEdit(`d:${g.domain}`, g.domain)"><Pencil :size="15" /></button>
            </template>
          </div>
          <!-- 子類別列 -->
          <div
            v-for="c in isExpanded(g.domain) ? g.items : []"
            :key="c.key"
            class="ml-4 flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-canvas"
          >
            <template v-if="editing === `c:${c.key}`">
              <span v-if="c.icon" class="shrink-0 text-base leading-none">{{ c.icon }}</span>
              <input
                v-model="editValue"
                class="flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-sm text-ink focus:outline-none"
                @keyup.enter="saveCategory(c.key, c.name)"
                @keyup.esc="editing = null"
              />
              <button class="icon-btn text-accent" aria-label="儲存" @click="saveCategory(c.key, c.name)"><Check :size="15" /></button>
              <button class="icon-btn" aria-label="取消" @click="editing = null"><X :size="15" /></button>
            </template>
            <template v-else>
              <span v-if="c.icon" class="shrink-0 text-base leading-none">{{ c.icon }}</span>
              <span class="flex-1 truncate text-sm text-ink">{{ c.name }}</span>
              <span class="shrink-0 rounded bg-canvas px-2 py-0.5 text-xs text-muted">{{ c.count }} 筆</span>
              <button class="icon-btn" title="改名" @click="startEdit(`c:${c.key}`, c.name)"><Pencil :size="14" /></button>
            </template>
          </div>
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
