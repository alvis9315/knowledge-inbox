<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, Download, ExternalLink, FileText, Braces, Sheet } from 'lucide-vue-next'
import LoadingState from '@/components/common/LoadingState.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import TypeBadge from '@/features/entries/components/TypeBadge.vue'
import { detailBodyFor } from '@/features/entries/detail/registry'
import { fetchEntry } from '@/features/entries/api/entriesApi'
import { useExport, type ExportFormat } from '@/features/entries/composables/useExport'
import { applyTheme } from '@/features/theme/useCategoryTheme'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import type { EntryWithTags } from '@/features/entries/types'
import { humanError } from '@/utils/humanError'

const props = defineProps<{ id: string }>()
const store = useCategoriesStore()
const { exportEntries } = useExport()

const entry = ref<EntryWithTags | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const exportOpen = ref(false)

const category = computed(() => (entry.value?.type ? store.typeByKey[entry.value.type] : null))

// Pick the detail body by the entry's 大類別 (domain). Falls back to default.
const bodyComponent = computed(() => detailBodyFor(category.value?.domain))

// Back link → the entry's own sub-category list (not the overview).
const backTo = computed(() =>
  entry.value?.type
    ? { name: 'category', params: { type: entry.value.type } }
    : { name: 'home' },
)
const backLabel = computed(() => (category.value ? `回「${category.value.name}」` : '回總覽'))

const load = async () => {
  loading.value = true
  error.value = null
  try {
    if (!store.ready) await store.init()
    entry.value = await fetchEntry(props.id)
    if (!entry.value) error.value = '找不到這筆內容'
    // Apply the entry's 大類別 world theme (covers deep-links to a detail page).
    applyTheme(category.value?.domain, category.value?.color)
  } catch (e) {
    error.value = humanError(e, '載入項目失敗,請重新整理再試')
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.id, load)

const doExport = async (format: ExportFormat) => {
  if (!entry.value) return
  await exportEntries(format, [entry.value], entry.value.title)
  exportOpen.value = false
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <RouterLink
      :to="backTo"
      class="inline-flex w-fit items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:-translate-x-0.5 hover:bg-canvas"
    >
      <ArrowLeft :size="16" /> {{ backLabel }}
    </RouterLink>

    <LoadingState :loading="loading" :error="error">
      <article v-if="entry" class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <TypeBadge :type-key="entry.type" />
            <span
              v-if="entry.status === 'pending_review'"
              class="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-fg"
            >待確認</span>
            <span v-if="entry.confidence != null" class="text-xs text-muted">
              信心 {{ Math.round(entry.confidence * 100) }}%
            </span>
          </div>
          <BaseButton variant="secondary" size="sm" @click="exportOpen = true">
            <Download :size="14" /> 匯出
          </BaseButton>
        </div>

        <h1 class="break-words text-2xl font-semibold text-ink">{{ entry.title }}</h1>

        <!-- type-specific body (modular; registry maps 大類別 → component) -->
        <component :is="bodyComponent" :entry="entry" />

        <a
          v-if="entry.source_url"
          :href="entry.source_url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <ExternalLink :size="14" /> {{ entry.source_url }}
        </a>

        <p class="text-xs text-muted">
          建立於 {{ new Date(entry.created_at).toLocaleString() }} ·
          更新於 {{ new Date(entry.updated_at).toLocaleString() }}
        </p>
      </article>
    </LoadingState>

    <BaseModal :open="exportOpen" title="匯出此項目" @close="exportOpen = false">
      <div class="grid grid-cols-3 gap-3">
        <BaseButton variant="secondary" @click="doExport('md')"><FileText :size="15" /> Markdown</BaseButton>
        <BaseButton variant="secondary" @click="doExport('json')"><Braces :size="15" /> JSON</BaseButton>
        <BaseButton variant="secondary" @click="doExport('excel')"><Sheet :size="15" /> Excel</BaseButton>
      </div>
    </BaseModal>
  </section>
</template>
