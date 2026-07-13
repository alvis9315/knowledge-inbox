<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { PanelLeft, Search, PlusCircle, Menu, X, Power, Settings, Tag, SwatchBook, Droplet, Image as ImageIcon } from 'lucide-vue-next'
import CategorySidebar from '@/features/categories/components/CategorySidebar.vue'
import QuickCapture from '@/features/capture/QuickCapture.vue'
import NewCategoryModal from '@/features/categories/components/NewCategoryModal.vue'
import CommandPalette from '@/features/search/CommandPalette.vue'
import CategoryThemeSettings from '@/features/theme/CategoryThemeSettings.vue'
import DomainThemeSettings from '@/features/theme/DomainThemeSettings.vue'
import TagManager from '@/features/tags/components/TagManager.vue'
import HoverMenu from '@/components/common/HoverMenu.vue'
import BaseConfirm from '@/components/common/BaseConfirm.vue'
import { applyTheme, domainThemeKey, homeThemeKey } from '@/features/theme/useCategoryTheme'
import { presetByKey, type LiveBgKind } from '@/features/theme/themePresets'
import { activeLiveBg, bgControlsOpen } from '@/features/theme/liveBgControls'
import FileUploadModal from '@/components/common/FileUploadModal.vue'
import { saveFile, removeFile, loadFile, LOGIN_COVER_KEY } from '@/services/localFiles'
import { toast } from '@/composables/useToast'
import { useCategoriesStore } from '@/features/categories/stores/categoriesStore'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { isMock } from '@/services/dataMode'
import KnowledgeGalaxy from '@/components/backgrounds/KnowledgeGalaxy.vue'
import KnowledgeThreads from '@/components/backgrounds/KnowledgeThreads.vue'
import GalaxyImageBackground from '@/components/backgrounds/GalaxyImageBackground.vue'
import BackgroundSettings from '@/features/theme/BackgroundSettings.vue'
import { topbarOpacity, sidebarOpacity, cardOpacity, entryOpacity, cardGlass, chromeBg } from '@/features/theme/chromeOpacity'
import {
  GALAXY_BG_CSS,
  GALAXY_BG_STARS,
  currentLoginBg,
  currentGalaxyBg,
} from '@/features/theme/loginBackdrop'

const store = useCategoriesStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const settingsOpen = ref(false)
const tagsOpen = ref(false)
const domainThemeOpen = ref(false)
const mock = computed(() => isMock())

// 登入頁選定的「活背景」鋪滿整站(AppShell 掛載時讀定;換風格 = 回登入頁換)。
const liveBg = currentLoginBg()
const liveGalaxy = currentGalaxyBg()
const liveGalaxyCss = GALAXY_BG_CSS[liveGalaxy]
const liveStars = GALAXY_BG_STARS[liveGalaxy]

// 圖片活背景:控制器按鈕 = 開上傳封面(直觀、不佔版面)。
const coverUploadOpen = ref(false)
const coverVersion = ref(0)
const hasCover = ref(false)
async function refreshHasCover() {
  hasCover.value = !!(await loadFile(LOGIN_COVER_KEY))
}
refreshHasCover()
watch(bgControlsOpen, (o) => {
  if (o && activeLive.value === 'image') {
    bgControlsOpen.value = false
    coverUploadOpen.value = true
  }
})
async function onCoverConfirm(file: File) {
  try {
    await saveFile(LOGIN_COVER_KEY, file)
    coverVersion.value++
    coverUploadOpen.value = false
    await refreshHasCover()
    toast.success('封面已更新')
  } catch (e) {
    console.error('[cover]', e)
    toast.error('封面儲存失敗,檔案可能太大')
  }
}
async function onCoverRemove() {
  await removeFile(LOGIN_COVER_KEY)
  coverVersion.value++
  coverUploadOpen.value = false
  await refreshHasCover()
  toast.success('已回復預設封面')
}

const logoutConfirmOpen = ref(false)
const loggingOut = ref(false)
async function doLogout() {
  loggingOut.value = true
  try {
    await auth.logout()
    router.push({ name: 'login' })
  } finally {
    loggingOut.value = false
    logoutConfirmOpen.value = false
  }
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

// 活背景解析:無大類別頁 = 登入頁選擇;大類別頁 = 該大類別「主題風格」
// 若指定 liveBg(星空/線條/圖片)則鋪對應活背景,否則純世界配色。
const activeLive = computed<LiveBgKind | null>(() => {
  if (route.name === 'entry-detail') return null
  const d = themeContext.value.domain
  if (d === null) {
    const hk = homeThemeKey()
    return hk ? (presetByKey(hk).liveBg ?? null) : liveBg
  }
  return presetByKey(domainThemeKey(d)).liveBg ?? null
})
watch(activeLive, (v) => (activeLiveBg.value = v), { immediate: true })
const liveBgActive = computed(() => activeLive.value !== null)
const bgSettingsOpen = ref(false)

// 活背景調校的持久化:完成=存 localStorage(下次掛載沿用)、取消=元件內還原快照。
const readCfg = (k: string) => {
  try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? {} } catch { return {} }
}
const galaxySaved = readCfg('ki-app-galaxy-cfg')
const threadsSaved = readCfg('ki-app-threads-cfg')
function onBgDone(kind: 'galaxy' | 'threads', cfg: Record<string, unknown>) {
  localStorage.setItem(kind === 'galaxy' ? 'ki-app-galaxy-cfg' : 'ki-app-threads-cfg', JSON.stringify(cfg))
  bgControlsOpen.value = false
}
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
const collapsed = useLocalStorage('ki-sidebar-collapsed-v2', false) // 預設展開
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

onMounted(async () => {
  // 關鍵順序:先等 auth 恢復 session、確立資料模式(guest/supabase),
  // 再載入分類——否則登入狀態下會搶跑渲染出 mock 假資料(時有時無 bug 根因)。
  await auth.init()
  store.init()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="relative flex h-full flex-col overflow-hidden"
    :style="{
      '--card-alpha': liveBgActive ? String(cardOpacity) : '100',
      '--entry-alpha': liveBgActive ? String(entryOpacity) : '100',
      '--card-blur': liveBgActive && cardGlass ? '6px' : '0px',
    }"
  >
    <!-- 登入頁同款活背景(fixed 鋪滿;介面表層半透明讓它透出) -->
    <!-- 調參時背景層升到最上層(全螢幕預覽),平時墊在內容底下 -->
    <div v-if="liveBgActive" class="fixed inset-0" :class="bgControlsOpen ? 'z-40' : '-z-10'" :aria-hidden="!bgControlsOpen">

      <KnowledgeGalaxy
        v-if="activeLive === 'galaxy'"
        class="absolute inset-0"
        :background="liveGalaxyCss"
        :focal="[0.5, 0.5]"
        :density="liveStars.density"
        :star-tint="liveStars.starTint"
        :glow-intensity="liveStars.glow"
        :saturation="0.15"
        :hue-shift="210"
        :twinkle-intensity="0.3"
        :rotation-speed="0.09"
        :repulsion-strength="0"
        :auto-center-repulsion="0"
        :star-speed="0.65"
        :speed="0.9"
        :mouse-interaction="false"
        :mouse-repulsion="false"
        :transparent="true"
        :show-controls="bgControlsOpen"
        v-bind="galaxySaved"
        @controls-done="onBgDone('galaxy', $event)"
        @controls-cancel="bgControlsOpen = false"
      />
      <KnowledgeThreads
        v-else-if="activeLive === 'threads'"
        class="absolute inset-0"
        :color="[0.55, 0.72, 1.0]"
        :amplitude="2.3"
        :distance="0"
        :enable-mouse-interaction="false"
        :show-controls="bgControlsOpen"
        v-bind="threadsSaved"
        @controls-done="onBgDone('threads', $event)"
        @controls-cancel="bgControlsOpen = false"
      />
      <GalaxyImageBackground v-else class="absolute inset-0" :parallax="false" :version="coverVersion" />
    </div>
    <!-- Fixed top bar -->
    <header
      class="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 backdrop-blur sm:px-4"
      :style="{ background: liveBgActive ? chromeBg(topbarOpacity) : 'color-mix(in srgb, var(--surface) 92%, transparent)' }"
    >
      <button
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:hidden"
        aria-label="開啟選單"
        @click="mobileOpen = true"
      >
        <Menu :size="18" />
      </button>
      <button
        class="-ml-0.5 hidden h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink sm:-ml-1.5 md:inline-flex"
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
          <SwatchBook :size="16" /> 主題風格
        </button>
        <button class="menu-item" @click="settingsOpen = true">
          <Droplet :size="16" /> 子類主色
        </button>
        <button class="menu-item" @click="tagsOpen = true">
          <Tag :size="16" /> 標籤管理
        </button>
        <button class="menu-item" @click="bgSettingsOpen = true">
          <ImageIcon :size="16" /> 玻璃感
        </button>
      </HoverMenu>
    </header>
    <!-- Thin bar reflecting the active category's color. -->
    <div class="h-0.5 shrink-0 bg-accent transition-colors" />

    <div v-if="mock" class="shrink-0 border-b border-line bg-surface/70 px-4 py-1.5 text-center text-xs text-muted backdrop-blur">
      訪客 / Demo 模式 — 使用本機假資料,變更只存在這個瀏覽器,不會影響雲端。
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Desktop sidebar (fixed height, its own scroll — never moves the page) -->
      <aside
        class="relative hidden h-full shrink-0 flex-col overflow-hidden border-r border-line backdrop-blur-md transition-[width] duration-300 ease-in-out md:flex"
        :style="{ background: liveBgActive ? chromeBg(sidebarOpacity) : 'var(--surface)' }"
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
            @click="logoutConfirmOpen = true"
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
      <main class="min-w-0 flex-1 overflow-y-auto overflow-x-hidden thin-scroll" :class="liveBgActive ? '' : 'bg-canvas'">
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
    <BackgroundSettings :open="bgSettingsOpen" @close="bgSettingsOpen = false" />
    <FileUploadModal
      :open="coverUploadOpen"
      title="上傳封面(圖片活背景)"
      hint="建議 1920×1080(16:9)以上;顯示時自動滿版裁切。圖最大 8MB、影片 50MB,僅存於此瀏覽器。"
      :has-existing="hasCover"
      @close="coverUploadOpen = false"
      @confirm="onCoverConfirm"
      @remove-existing="onCoverRemove"
    />
    <BaseConfirm
      :open="logoutConfirmOpen"
      title="登出"
      variant="primary"
      confirm-text="登出"
      :busy="loggingOut"
      @confirm="doLogout"
      @close="logoutConfirmOpen = false"
    >
      確定要登出嗎?
    </BaseConfirm>
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
