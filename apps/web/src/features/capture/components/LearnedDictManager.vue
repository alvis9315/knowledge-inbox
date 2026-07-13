<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, X, Trash2, BrainCircuit } from 'lucide-vue-next'
import { toast } from '@/composables/useToast'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseConfirm from '@/components/common/BaseConfirm.vue'
import {
  getLearnedDict,
  removeLearnedTerm,
  removeLearnedType,
  clearLearned,
  type LearnedMap,
} from '@/features/capture/ruleClassifier'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'

// 自學字典管理:檢視/刪除回饋自學學到的網址與關鍵詞(學錯可修)。
// 資料在 localStorage(ki-learned-kw-v1),操作即時生效、無網路請求。
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCategoriesStore()
const dict = ref<LearnedMap>({})
const search = ref('')
const confirmClearAll = ref(false)

const load = () => {
  dict.value = getLearnedDict()
}
watch(() => props.open, (o) => o && load())

const catName = (key: string) => {
  const c = store.categories.find((x) => x.key === key)
  return c ? `${c.domain}/${c.name}` : key
}

interface Group {
  typeKey: string
  label: string
  terms: { term: string; weight: number }[]
}
const groups = computed<Group[]>(() => {
  const t = search.value.trim().toLowerCase()
  const out: Group[] = []
  for (const [typeKey, bucket] of Object.entries(dict.value)) {
    const label = catName(typeKey)
    const terms = Object.entries(bucket)
      .filter(([term]) => !t || term.includes(t) || label.toLowerCase().includes(t))
      .map(([term, weight]) => ({ term, weight }))
      .sort((a, b) => b.weight - a.weight)
    if (terms.length) out.push({ typeKey, label, terms })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'))
})
const isEmpty = computed(() => Object.keys(dict.value).length === 0)

const delTerm = (typeKey: string, term: string) => {
  removeLearnedTerm(typeKey, term)
  load()
  toast.success(`已刪除「${term}」`)
}
const delType = (g: Group) => {
  removeLearnedType(g.typeKey)
  load()
  toast.success(`已清空「${g.label}」的自學詞`)
}
const doClearAll = () => {
  clearLearned()
  confirmClearAll.value = false
  load()
  toast.success('已清空整本自學字典')
}
</script>

<template>
  <BaseModal :open="props.open" title="自學字典" size="xl" @close="emit('close')">
    <div class="flex flex-col gap-3">
      <p class="flex items-center gap-1.5 text-sm font-medium text-ink">
        <BrainCircuit :size="16" class="text-accent" />
        這裡是分類器從你的修正中學到的詞。
      </p>
      <ul class="-mt-1 space-y-0.5 text-xs text-muted">
        <li>· 在待確認畫面修正分類時,該筆文字的網址與關鍵詞會自動加權記進對應分類</li>
        <li>· 權重越高影響越大(上限 8);學錯了直接刪掉即可,之後修正會再學回來</li>
      </ul>

      <div class="flex flex-wrap gap-2">
        <div class="flex min-w-40 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search :size="15" class="text-muted" />
          <input
            v-model="search"
            type="search"
            placeholder="搜尋詞或分類…"
            class="w-full bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          v-if="!isEmpty"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          @click="confirmClearAll = true"
        >
          <Trash2 :size="14" /> 全部清空
        </button>
      </div>

      <div class="h-[52vh] overflow-y-auto thin-scroll">
        <p v-if="isEmpty" class="py-10 text-center text-sm text-muted">
          字典還是空的——去待確認畫面修正幾筆分類,它就會開始長大。
        </p>
        <p v-else-if="groups.length === 0" class="py-10 text-center text-sm text-muted">
          沒有符合的詞,換個關鍵字試試。
        </p>
        <div v-for="g in groups" :key="g.typeKey" class="mb-3">
          <div class="mb-1 flex items-center justify-between px-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              {{ g.label }}
              <span class="ml-1 font-normal normal-case">{{ g.terms.length }} 詞</span>
            </p>
            <button
              type="button"
              class="rounded-md px-1.5 py-0.5 text-xs text-muted transition hover:bg-red-50 hover:text-red-600"
              :title="`清空「${g.label}」的自學詞`"
              @click="delType(g)"
            >
              清空
            </button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="it in g.terms"
              :key="it.term"
              class="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-sm text-ink"
            >
              {{ it.term }}
              <span class="text-xs text-muted">×{{ it.weight }}</span>
              <button
                type="button"
                class="rounded-full text-muted transition-colors hover:text-red-600"
                :aria-label="`刪除「${it.term}」`"
                @click="delTerm(g.typeKey, it.term)"
              >
                <X :size="12" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>

  <BaseConfirm
    :open="confirmClearAll"
    title="清空自學字典?"
    :message="'所有分類學過的詞都會被刪除,之後要重新從修正中累積。'"
    confirm-text="全部清空"
    variant="danger"
    @confirm="doClearAll"
    @close="confirmClearAll = false"
  />
</template>
