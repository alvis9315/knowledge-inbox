<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileUp, Link2 } from 'lucide-vue-next'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import CategoryCascader from '@/features/categories/components/CategoryCascader.vue'
import { createEntry } from '@/features/entries/api/entriesApi'
import { learnFromCorrection } from '@/features/capture/ruleClassifier'
import { groupByHost, parseBookmarkHtml, parseBookmarkInput, type HostGroup } from '@/features/capture/batchImport'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { toast } from '@/composables/useToast'
import { humanError } from '@/utils/humanError'

// 書籤批次匯入:貼清單 / 上傳書籤 HTML → hostname 分組 → 一組選一次
// 分類 → 批次建檔 + 分類器學 hostname。選了分類=人工確認,直接 filed;
// 留空的組=略過不匯入。
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const store = useCategoriesStore()

type Step = 'input' | 'review' | 'importing'
const step = ref<Step>('input')
const rawText = ref('')
const groups = ref<HostGroup[]>([])
/** host → 使用者選的分類 key(null = 略過)。 */
const picks = ref<Record<string, string | null>>({})
const progress = ref({ done: 0, total: 0 })
const error = ref<string | null>(null)

const reset = () => {
  step.value = 'input'
  rawText.value = ''
  groups.value = []
  picks.value = {}
  error.value = null
}
const close = () => {
  if (step.value === 'importing') return // 匯入中不可關(避免半套)
  reset()
  emit('close')
}

const onFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  rawText.value = await file.text()
  ;(e.target as HTMLInputElement).value = ''
}

const toReview = () => {
  error.value = null
  const raw = rawText.value.trim()
  if (!raw) return
  const items = raw.includes('<a') || raw.includes('<A') ? parseBookmarkHtml(raw) : parseBookmarkInput(raw)
  if (items.length === 0) {
    error.value = '沒有解析到任何連結——貼「每行一條網址」或上傳瀏覽器匯出的書籤 HTML'
    return
  }
  groups.value = groupByHost(items, store.categories)
  picks.value = Object.fromEntries(groups.value.map((g) => [g.host, g.guessType]))
  step.value = 'review'
}

const totalItems = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))
const pickedItems = computed(() =>
  groups.value.reduce((n, g) => n + (picks.value[g.host] ? g.items.length : 0), 0),
)

const doImport = async () => {
  step.value = 'importing'
  progress.value = { done: 0, total: pickedItems.value }
  let failed = 0
  try {
    for (const g of groups.value) {
      const type = picks.value[g.host]
      if (!type) continue
      // 一組學一次 hostname(只餵 URL:extractTerms 只會抽出 hostname,不帶標題雜訊)
      learnFromCorrection(g.items[0].url, type)
      for (const it of g.items) {
        try {
          await createEntry({
            title: it.title.slice(0, 120),
            type,
            summary: null,
            content: it.url,
            source_url: it.url,
            attrs: {},
            status: 'filed', // 使用者親選分類 = 已確認
            tags: [],
          })
        } catch {
          failed++
        }
        progress.value.done++
      }
    }
    await store.touch()
    if (failed > 0) toast.info(`匯入完成:成功 ${progress.value.total - failed} 筆,失敗 ${failed} 筆`)
    else toast.success(`已匯入 ${progress.value.total} 筆,分類器學會 ${groups.value.filter((g) => picks.value[g.host]).length} 個網站`)
    reset()
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = humanError(e, '匯入失敗,請稍後再試')
    step.value = 'review'
  }
}
</script>

<template>
  <BaseModal :open="props.open" title="批次匯入書籤" size="xl" @close="close">
    <!-- 步驟 1:輸入 -->
    <div v-if="step === 'input'" class="flex flex-col gap-3">
      <p class="flex items-center gap-1.5 text-sm font-medium text-ink">
        <Link2 :size="16" class="text-accent" />
        貼上連結清單(每行一條,網址後可接標題),或上傳瀏覽器匯出的書籤 HTML。
      </p>
      <textarea
        v-model="rawText"
        rows="10"
        placeholder="https://legendsverse.com/home&#10;https://tabelog.com/tokyo/... 東京燒肉名店&#10;…"
        class="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <div class="flex items-center justify-between">
        <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:bg-canvas hover:text-ink">
          <FileUp :size="14" /> 上傳書籤 HTML
          <input type="file" accept=".html,.htm" class="hidden" @change="onFile" />
        </label>
        <div class="flex gap-2">
          <BaseButton variant="secondary" @click="close">取消</BaseButton>
          <BaseButton :disabled="!rawText.trim()" @click="toReview">下一步:分組確認</BaseButton>
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>

    <!-- 步驟 2:hostname 分組確認 -->
    <div v-else-if="step === 'review'" class="flex flex-col gap-3">
      <p class="text-sm text-ink">
        共 <b>{{ totalItems }}</b> 條連結、<b>{{ groups.length }}</b> 個網站。
        每個網站選一次分類(= 整組套用 + 分類器記住這個網站);留空 = 該組不匯入。
      </p>
      <div class="max-h-[46vh] overflow-y-auto thin-scroll">
        <div
          v-for="g in groups"
          :key="g.host"
          class="mb-2 flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3"
          :class="picks[g.host] ? '' : 'opacity-60'"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-semibold text-ink">
              {{ g.host }}
              <span class="ml-1 font-normal text-muted">{{ g.items.length }} 筆</span>
            </p>
            <div class="w-56">
              <CategoryCascader
                :model-value="picks[g.host]"
                placeholder="略過(不匯入)"
                @update:model-value="picks[g.host] = $event"
              />
            </div>
          </div>
          <p class="truncate text-xs text-muted" :title="g.items.map((i) => i.title).join('\n')">
            {{ g.items.slice(0, 3).map((i) => i.title).join(' · ') }}<span v-if="g.items.length > 3"> …</span>
          </p>
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div class="flex items-center justify-between">
        <BaseButton variant="secondary" @click="step = 'input'">上一步</BaseButton>
        <BaseButton :disabled="pickedItems === 0" @click="doImport">
          匯入 {{ pickedItems }} 筆
        </BaseButton>
      </div>
    </div>

    <!-- 步驟 3:匯入中 -->
    <div v-else class="flex flex-col items-center gap-3 py-8">
      <p class="text-sm text-ink">匯入中… {{ progress.done }} / {{ progress.total }}</p>
      <div class="h-2 w-64 overflow-hidden rounded-full bg-canvas">
        <div
          class="h-full bg-accent transition-all"
          :style="{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }"
        />
      </div>
    </div>
  </BaseModal>
</template>
