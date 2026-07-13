<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { PanelLeft, Search, PlusCircle, Menu, X, Power, Settings, Tag, SwatchBook, Droplet } from 'lucide-vue-next'
import CategorySidebar from '@/features/categories/components/CategorySidebar.vue'
import QuickCapture from '@/features/capture/QuickCapture.vue'
import NewCategoryModal from '@/features/categories/components/NewCategoryModal.vue'
import CommandPalette from '@/features/search/CommandPalette.vue'
import CategoryThemeSettings from '@/features/theme/CategoryThemeSettings.vue'
import DomainThemeSettings from '@/features/theme/DomainThemeSettings.vue'
import TagManager from '@/features/tags/components/TagManager.vue'
import HoverMenu from '@/components/common/HoverMenu.vue'
import { applyTheme } from '@/features/theme/useCategoryTheme'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { isMock } from '@/services/dataMode'

const store = useCategoriesStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const settingsOpen = ref(false)
const tagsOpen = ref(false)
const domainThemeOpen = ref(false)
const mock = computed(() => isMock())

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}

// The active 大類別 themes the whole app — its "world" (bg + text + accent).
// Categories carry their domain; the domain view carries the domain directly.
const activeType = computed(() =>
  route.name === 'category' ? String(route.params.type) : null,
)
const themeContext = computed<{ domain: string | null; color: string | null }>(() => {
  if (route.name === 'category') {
    const c = store.typeByKey[String(route.params.type)]
    return { domain: c?.domain ?? null, color: c?.color ?? null }
  }
  if (route.name === 'domain') return { domain: String(route.params.domain), color: null }
  return { domain: null, color: null }
})
const activeDomain = computed(() => themeContext.value.domain)
watch(
  [themeContext, () => store.categories],
  () => {
    // The detail page drives its own theme (it knows the entry's domain); don't
    // reset it here as we pass through the entry-detail route.
    if (route.name === 'entry-detail') return
    applyTheme(themeContext.value.domain, themeContext.value.color)
  },
  { immediate: true },
)
const collapsed = useLocalStorage('ki-sidebar-collapsed', false)
const mobileOpen = ref(false)
const captureOpen = ref(false)
const newCategoryOpen = ref(false)
const paletteOpen = ref(false)

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = true
  } else if (!typing && e.key === 'n') {
    captureOpen.value = true
  } else if (!typing && e.key === '/') {
    e.preventDefault()
    paletteOpen.value = true
  }
}

onMounted(() => {
  store.init()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Fixed top bar -->
    <header
      class="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-4"
    >
      <button
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden"
        aria-label="開啟選單"
        @click="mobileOpen = true"
      >
        <Menu :size="18" />
      </button>
      <button
        class="hidden h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:inline-flex"
        aria-label="收合側欄"
        @click="collapsed = !collapsed"
      >
        <PanelLeft :size="18" />
      </button>

      <RouterLink
        to="/"
        class="pointer-events-auto absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 font-semibold text-ink"
      >
        <span
          class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs text-accent-fg"
          aria-hidden="true"
        >KI</span>
        <span class="hidden sm:inline">Knowledge Inbox</span>
      </RouterLink>

      <button
        class="ml-auto flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-canvas"
        @click="paletteOpen = true"
      >
        <Search :size="15" />
        <span class="hidden sm:inline">搜尋</span>
        <kbd class="hidden rounded bg-canvas px-1 text-xs sm:inline">⌘K</kbd>
      </button>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90"
        @click="captureOpen = true"
      >
        <PlusCircle :size="16" />
        <span class="hidden sm:inline">捕捉</span>
      </button>
      <HoverMenu>
        <template #trigger>
          <button
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
            aria-label="設定"
            title="設定"
          >
            <Settings :size="18" />
          </button>
        </template>
        <button class="menu-item" @click="domainThemeOpen = true">
          <SwatchBook :size="16" /> 大類主題
        </button>
        <button class="menu-item" @click="settingsOpen = true">
          <Droplet :size="16" /> 子類主色
        </button>
        <button class="menu-item" @click="tagsOpen = true">
          <Tag :size="16" /> 標籤管理
        </button>
      </HoverMenu>
    </header>
    <!-- Thin bar reflecting the active category's color. -->
    <div class="h-0.5 shrink-0 bg-accent transition-colors" />

    <div v-if="mock" class="shrink-0 border-b border-slate-200 bg-white px-4 py-1.5 text-center text-xs text-slate-500">
      訪客 / Demo 模式 — 使用本機假資料,變更只存在這個瀏覽器,不會影響雲端。
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Desktop sidebar (fixed height, its own scroll — never moves the page) -->
      <aside
        class="hidden h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] md:flex"
        :class="collapsed ? 'w-14' : 'w-60'"
      >
        <div class="min-h-0 flex-1 overflow-y-auto thin-scroll">
          <CategorySidebar :collapsed="collapsed" @new-category="newCategoryOpen = true" />
        </div>
        <div class="shrink-0 border-t border-line p-2">
          <div v-if="!collapsed" class="truncate px-1 pb-1 text-center text-xs text-muted">
            {{ auth.label }}
          </div>
          <button
            class="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm text-muted transition-colors hover:bg-canvas hover:text-red-600"
            :title="collapsed ? '登出' : undefined"
            @click="logout"
          >
            <Power :size="18" />
            <span v-if="!collapsed">登出</span>
          </button>
        </div>
      </aside>

      <!-- Mobile drawer -->
      <Teleport to="body">
        <div v-if="mobileOpen" class="fixed inset-0 z-40 md:hidden">
          <div class="absolute inset-0 bg-slate-900/50" @click="mobileOpen = false" />
          <aside class="absolute left-0 top-0 h-full w-72 border-r border-line bg-surface shadow-xl">
            <div class="flex h-14 items-center justify-between border-b border-line px-4">
              <span class="font-semibold text-ink">分類</span>
              <button class="rounded-md p-1 text-muted hover:bg-canvas" @click="mobileOpen = false">
                <X :size="18" />
              </button>
            </div>
            <div class="h-[calc(100%-3.5rem)]" @click="mobileOpen = false">
              <CategorySidebar :collapsed="false" @new-category="newCategoryOpen = true" />
            </div>
          </aside>
        </div>
      </Teleport>

      <!-- Main (the only scrolling region) -->
      <main class="min-w-0 flex-1 overflow-y-auto overflow-x-hidden thin-scroll">
        <div class="flex min-h-full flex-col px-4 py-6 sm:px-6">
          <slot />
        </div>
      </main>
    </div>

    <QuickCapture :open="captureOpen" @close="captureOpen = false" />
    <NewCategoryModal :open="newCategoryOpen" @close="newCategoryOpen = false" />
    <CommandPalette :open="paletteOpen" @close="paletteOpen = false" />
    <CategoryThemeSettings :open="settingsOpen" :active-type="activeType" @close="settingsOpen = false" />
    <DomainThemeSettings :open="domainThemeOpen" :active-domain="activeDomain" @close="domainThemeOpen = false" />
    <TagManager :open="tagsOpen" @close="tagsOpen = false" />
  </div>
</template>

<style scoped>
.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--ink);
  transition: background-color 0.15s;
}
.menu-item:hover {
  background: var(--canvas);
}
</style>
