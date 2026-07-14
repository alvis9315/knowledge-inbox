<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { VueDraggable } from 'vue-draggable-plus'
import { useLocalStorage } from '@vueuse/core'
import { Inbox, Clock, Plus, ChevronRight } from 'lucide-vue-next'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { domainIcon } from '@/features/categories/domainIcons'
import { SCOPE_ALL, SCOPE_PENDING } from '@/features/entries/constants'
import type { CategoryMeta } from '@/features/categories/api/categoriesApi'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ 'new-category': [] }>()

const store = useCategoriesStore()

interface Group {
  domain: string
  items: CategoryMeta[]
}
const groups = ref<Group[]>([])
watch(
  () => [store.categories, store.domains] as const,
  () => {
    groups.value = store.domains.map((domain) => ({
      domain,
      items: store.categories.filter((c) => c.domain === domain),
    }))
  },
  { immediate: true, deep: true },
)

// 預設全部收合:只記「被展開的」,沒記到 = 收合。
const expandedDomains = useLocalStorage<Record<string, boolean>>('ki-expanded-domains-v1', {})
const toggleDomain = (d: string) => {
  expandedDomains.value = { ...expandedDomains.value, [d]: !expandedDomains.value[d] }
}
const persistOrder = () => {
  store.reorder(groups.value.flatMap((g) => g.items.map((c) => c.key)))
}
const persistDomainOrder = () => {
  store.reorderDomains(groups.value.map((g) => g.domain))
}
const domainCount = (g: Group) => {
  return g.items.reduce((n, c) => n + c.count, 0)
}
</script>

<template>
  <nav class="flex h-full flex-col p-2" aria-label="分類導覽">
    <!-- Collapsed rail: 全部 / 待確認 + 大類別 icons, centered -->
    <template v-if="collapsed">
      <div class="flex flex-col items-center gap-1">
        <RouterLink :to="{ name: 'browse', params: { type: SCOPE_ALL } }" class="icon-nav" active-class="nav-active" title="全部">
          <Inbox :size="18" />
        </RouterLink>
        <RouterLink :to="{ name: 'browse', params: { type: SCOPE_PENDING } }" class="icon-nav" active-class="nav-active" title="待確認">
          <Clock :size="18" />
        </RouterLink>
      </div>
      <div class="my-2 border-t border-line" />
      <div class="flex flex-col items-center gap-1 overflow-y-auto thin-scroll">
        <RouterLink
          v-for="group in groups"
          :key="group.domain"
          :to="{ name: 'domain', params: { domain: group.domain } }"
          class="icon-nav text-lg" active-class="nav-active" :title="group.domain"
        >
          {{ domainIcon(group.domain) }}
        </RouterLink>
      </div>
    </template>

    <!-- Expanded: compact top toolbar (全部 / 待確認 / +) then the tree -->
    <template v-else>
      <div class="flex items-center gap-1 px-1 pb-1">
        <span class="mr-auto pl-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Menu</span>
        <RouterLink :to="{ name: 'browse', params: { type: SCOPE_ALL } }" class="icon-nav" active-class="nav-active" title="全部">
          <Inbox :size="17" />
        </RouterLink>
        <RouterLink :to="{ name: 'browse', params: { type: SCOPE_PENDING } }" class="icon-nav" active-class="nav-active" title="待確認">
          <Clock :size="17" />
        </RouterLink>
        <button class="icon-nav" title="新增分類" @click="emit('new-category')">
          <Plus :size="17" />
        </button>
      </div>
      <div class="mb-1 border-t border-line" />

      <!-- Whole-row draggable (no grip handle) — same feel as the subcategory items. -->
      <VueDraggable
        v-model="groups"
        :animation="150"
        class="flex flex-1 flex-col gap-1 overflow-y-auto thin-scroll"
        @update="persistDomainOrder"
      >
        <div
          v-for="(group, gi) in groups"
          :key="group.domain"
          class="menu-stagger flex flex-col"
          :style="{ animationDelay: `${Math.min(gi, 14) * 35}ms` }"
        >
          <div class="group flex cursor-grab items-center rounded-lg pl-1 transition-transform hover:scale-[1.02] hover:bg-canvas">
            <button
              class="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:text-ink"
              :aria-label="`展開 ${group.domain}`"
              @click="toggleDomain(group.domain)"
            >
              <ChevronRight :size="15" class="transition-transform" :class="expandedDomains[group.domain] ? 'rotate-90' : ''" />
            </button>
            <RouterLink
              :to="{ name: 'domain', params: { domain: group.domain } }"
              class="flex flex-1 items-center gap-1.5 truncate py-1.5 text-sm font-medium text-ink"
              active-class="text-accent"
            >
              <span>{{ domainIcon(group.domain) }}</span>
              <span class="flex-1 truncate">{{ group.domain }}</span>
            </RouterLink>
            <span class="px-2 text-xs text-muted">{{ domainCount(group) }}</span>
          </div>

          <VueDraggable
            v-if="expandedDomains[group.domain]"
            v-model="group.items"
            :animation="150"
            class="ml-3 flex flex-col gap-0.5 border-l border-line pl-1"
            @update="persistOrder"
          >
            <RouterLink
              v-for="(cat, i) in group.items"
              :key="cat.key"
              :to="{ name: 'category', params: { type: cat.key } }"
              class="nav-item menu-stagger cursor-grab transition-transform hover:scale-[1.02]" active-class="nav-active"
              :style="{ animationDelay: `${Math.min(i, 14) * 28}ms` }"
            >
              <span class="shrink-0 text-sm leading-none">{{ cat.icon || '🏷️' }}</span>
              <span class="flex-1 truncate">{{ cat.name }}</span>
              <span class="shrink-0 text-xs text-muted">{{ cat.count }}</span>
            </RouterLink>
          </VueDraggable>
        </div>
      </VueDraggable>
    </template>
  </nav>
</template>

<style scoped>
.icon-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
  width: 2rem;
  border-radius: 0.5rem;
  color: var(--muted);
  transition: background-color 0.15s, color 0.15s;
}
.icon-nav:hover {
  background: var(--canvas);
  color: var(--ink);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  color: var(--muted);
  transition: background-color 0.15s, color 0.15s, transform 0.15s;
}
.nav-item:hover {
  background: var(--canvas);
  color: var(--ink);
}
.nav-active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

/* StaggeredMenu(react-bits)式展開:子項逐一滑入 */
.menu-stagger {
  opacity: 0;
  transform: translateX(-14px);
  animation: menu-stagger-in 0.3s ease-out forwards;
}
@keyframes menu-stagger-in {
  to { opacity: 1; transform: translateX(0); }
}
</style>
