<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { Sparkles, ArrowRight, LogIn, SlidersHorizontal, ImageUp } from 'lucide-vue-next'
import FileUploadModal from '@/components/common/FileUploadModal.vue'
import { saveFile, removeFile, loadFile, LOGIN_COVER_KEY } from '@/services/localFiles'
import { toast } from '@/composables/useToast'
import KnowledgeGalaxy from '@/components/backgrounds/KnowledgeGalaxy.vue'
import KnowledgeThreads from '@/components/backgrounds/KnowledgeThreads.vue'
import GalaxyImageBackground from '@/components/backgrounds/GalaxyImageBackground.vue'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { humanError } from '@/utils/humanError'

const bg = useLocalStorage<'galaxy' | 'threads' | 'image'>('ki-login-bg', 'galaxy')

// Galaxy backdrop colour — three testable options.
type GalaxyBg = 'black' | 'blue' | 'nebula'
const galaxyBg = useLocalStorage<GalaxyBg>('ki-login-galaxy-bg-v4', 'black')

// 夜幕藍星雲:深夜藍底 + 有機分佈的星雲色暈(靛藍/紫/青)+ 細顆粒噪點層
// (SVG feTurbulence,給背景真實粒子質感、避免平滑霧面)。crisp 星點由 shader
// 疊上。噪點層放最上、以 140px 平鋪、低不透明度。
const nebulaBg =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E") 0 0 / 140px 140px repeat,` +
  `radial-gradient(ellipse 42% 36% at 28% 32%, rgba(84,118,220,0.16) 0%, transparent 60%),` +
  `radial-gradient(ellipse 48% 42% at 72% 64%, rgba(122,82,192,0.15) 0%, transparent 62%),` +
  `radial-gradient(ellipse 40% 30% at 60% 20%, rgba(56,150,180,0.10) 0%, transparent 60%),` +
  `radial-gradient(ellipse 55% 46% at 40% 78%, rgba(48,96,170,0.10) 0%, transparent 64%),` +
  `radial-gradient(ellipse 122% 112% at 50% 50%, #0c1b40 0%, #0a1533 40%, #070f26 72%, #04091a 100%)`

const BG: Record<GalaxyBg, string> = {
  black: 'radial-gradient(circle at 50% 50%, #0a0a14 0%, #000 82%)',
  blue: 'radial-gradient(circle at 50% 50%, #0e1b40 0%, #091229 36%, #05091c 64%, #02040c 100%)',
  nebula: nebulaBg,
}
// 每個底色掛自己的星星參數(使用者調校定案 2026-07-13)。
const BG_STARS: Record<GalaxyBg, { density: number; starTint: string; glow: number }> = {
  black: { density: 0.9, starTint: '#ffffff', glow: 0.35 },
  blue: { density: 2.1, starTint: '#37598b', glow: 0.65 },
  nebula: { density: 0.5, starTint: '#3282ec', glow: 0.35 },
}
const bgOptions: Array<{ key: GalaxyBg; label: string }> = [
  { key: 'black', label: '黑底' },
  { key: 'blue', label: '深邃藍' },
  { key: 'nebula', label: '夜幕藍星雲' },
]
const galaxyBgCss = computed(() => BG[galaxyBg.value])
const galaxyStars = computed(() => BG_STARS[galaxyBg.value])
const titleClass = computed(() => (bg.value === 'threads' ? 'title-threads' : 'title-galaxy'))
const showGalaxyControls = ref(false)
const showThreadsControls = ref(false)

// 圖片模式:自訂封面上傳(存 IndexedDB,僅此瀏覽器)。
const uploadOpen = ref(false)
const coverVersion = ref(0)
const hasCover = ref(false)
async function refreshHasCover() {
  hasCover.value = !!(await loadFile(LOGIN_COVER_KEY))
}
refreshHasCover()
async function onCoverConfirm(file: File) {
  try {
    await saveFile(LOGIN_COVER_KEY, file)
    coverVersion.value++
    uploadOpen.value = false
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
  uploadOpen.value = false
  await refreshHasCover()
  toast.success('已回復預設封面')
}

const router = useRouter()
const auth = useAuthStore()

// ── 開機序列:亂碼解碼打字 → glitch → [ START ] → 登入卡片 ──
type Stage = 'typing' | 'start' | 'leaving' | 'form'
const stage = ref<Stage>('typing')
const display = ref('')
const glitching = ref(false)
const TITLE_TEXT = 'Knowledge Inbox'
const GLYPHS = '!<>-_\\/[]{}=+*^?#░▒▓█01'
let introTimer = 0

function runDecode() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.value = 'form'
    return
  }
  let frame = 0
  introTimer = window.setInterval(() => {
    frame++
    const locked = Math.floor(frame / 3) // 每 3 幀鎖定一個字
    let out = ''
    for (let i = 0; i < TITLE_TEXT.length; i++) {
      if (i < locked) out += TITLE_TEXT[i]
      else if (i < locked + 5) out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
    }
    display.value = out
    if (locked >= TITLE_TEXT.length) {
      clearInterval(introTimer)
      // glitch → 完全消失(保留版位)→ 數位亂碼快速拼裝重現 → START
      showCaret.value = false
      glitching.value = true
      setTimeout(() => {
        glitching.value = false
        titleHidden.value = true
        setTimeout(() => {
          titleHidden.value = false
          runScrambleIn(() => (stage.value = 'start'))
        }, 650)
      }, 500)
    }
  }, 45)
}
const titleHidden = ref(false)
const showCaret = ref(true)

/** 重現:全長亂碼快速逐字解析成完整標題(digital 拼裝感)。 */
function runScrambleIn(done: () => void) {
  let frame = 0
  introTimer = window.setInterval(() => {
    frame++
    const locked = frame * 2 // 一幀解兩字,約 0.4s 拼完
    let out = ''
    for (let i = 0; i < TITLE_TEXT.length; i++) {
      out += i < locked ? TITLE_TEXT[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0]
    }
    display.value = out
    if (locked >= TITLE_TEXT.length) {
      clearInterval(introTimer)
      done()
    }
  }, 40)
}
/** 點畫面跳過打字,直接到 START。 */
function skipTyping() {
  if (stage.value !== 'typing') return
  clearInterval(introTimer)
  display.value = TITLE_TEXT
  showCaret.value = false
  titleHidden.value = false
  glitching.value = false
  stage.value = 'start'
}
/** 按 START:glitch 退場 → 登入卡片進場。 */
function enterApp() {
  glitching.value = true
  stage.value = 'leaving'
  setTimeout(() => {
    glitching.value = false
    stage.value = 'form'
  }, 450)
}
// ── TargetCursor(外型版):四角括號+中心點跟隨滑鼠;不帶官方的旋轉/
// 鎖定動畫(避免和 START 對焦框互搶)。僅精準指標裝置啟用。
const finePointer = window.matchMedia('(pointer: fine)').matches
const cursorEl = ref<HTMLElement | null>(null)
function onCursorMove(e: PointerEvent) {
  if (cursorEl.value) {
    cursorEl.value.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`
  }
}

onMounted(() => {
  runDecode()
  if (finePointer) window.addEventListener('pointermove', onCursorMove, { passive: true })
})
onUnmounted(() => {
  clearInterval(introTimer)
  window.removeEventListener('pointermove', onCursorMove)
})

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

function guest() {
  auth.loginGuest()
  router.push('/')
}
async function withPassword() {
  error.value = null
  busy.value = true
  try {
    await auth.loginWithPassword(email.value.trim(), password.value)
    router.push('/')
  } catch (e) {
    error.value = humanError(e, '登入失敗,請稍後再試')
  } finally {
    busy.value = false
  }
}
async function withGoogle() {
  error.value = null
  try {
    await auth.loginWithGoogle()
  } catch (e) {
    error.value = humanError(e, '登入失敗,請稍後再試')
  }
}
</script>

<template>
  <div
    class="relative flex min-h-screen items-center justify-center overflow-hidden p-4 text-white"
    :class="finePointer ? 'login-cursor-none' : ''"
  >
    <!-- TargetCursor 外型(跟隨,無動畫) -->
    <div v-if="finePointer" ref="cursorEl" class="target-cursor" style="transform: translate3d(-100px, -100px, 0)" aria-hidden="true">
      <span class="tc-spin">
        <i class="tc-corner tl" /><i class="tc-corner tr" />
        <i class="tc-corner bl" /><i class="tc-corner br" />
      </span>
      <i class="tc-dot" />
    </div>
    <KnowledgeGalaxy
      v-if="bg === 'galaxy'"
      class="absolute inset-0"
      :background="galaxyBgCss"
      :show-controls="showGalaxyControls"
      :focal="[0.5, 0.5]"
      :density="galaxyStars.density"
      :star-tint="galaxyStars.starTint"
      :glow-intensity="galaxyStars.glow"
      :saturation="0.15"
      :hue-shift="210"
      :twinkle-intensity="0.3"
      :rotation-speed="0.09"
      :repulsion-strength="1.1"
      :auto-center-repulsion="0"
      :star-speed="0.65"
      :speed="0.9"
      :mouse-interaction="false"
      :mouse-repulsion="stage === 'form'"
      :transparent="true"
    />
    <KnowledgeThreads
      v-else-if="bg === 'threads'"
      class="absolute inset-0"
      :show-controls="showThreadsControls"
      :color="[0.55, 0.72, 1.0]"
      :amplitude="2.3"
      :distance="0"
      :enable-mouse-interaction="true"
    />
    <GalaxyImageBackground v-else class="absolute inset-0" :version="coverVersion" />

    <!-- 圖片模式:上傳自訂封面 -->
    <div v-if="bg === 'image'" class="absolute bottom-4 left-4 z-20">
      <button
        class="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
        @click="uploadOpen = true"
      >
        <ImageUp :size="14" /> 上傳封面
      </button>
    </div>

    <FileUploadModal
      :open="uploadOpen"
      title="上傳登入頁封面"
      hint="建議 1920×1080(16:9)以上;顯示時會自動滿版裁切。圖最大 8MB、影片 50MB,僅存於此瀏覽器。"
      :has-existing="hasCover"
      @close="uploadOpen = false"
      @confirm="onCoverConfirm"
      @remove-existing="onCoverRemove"
    />

    <!-- galaxy backdrop colour swatches -->
    <div v-if="bg === 'galaxy'" class="absolute bottom-4 left-4 z-20 flex items-center gap-2">
      <button
        v-for="opt in bgOptions"
        :key="opt.key"
        class="h-6 w-6 rounded-full border border-white/25 transition hover:scale-110"
        :class="galaxyBg === opt.key ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''"
        :style="{ background: BG[opt.key] }"
        :title="opt.label"
        @click="galaxyBg = opt.key"
      />
      <button
        class="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/25 text-white/80 transition hover:scale-110 hover:text-white"
        :class="showGalaxyControls ? 'bg-white/25 ring-2 ring-white' : 'bg-white/10'"
        title="調整星系參數"
        @click="showGalaxyControls = !showGalaxyControls"
      >
        <SlidersHorizontal :size="13" />
      </button>
    </div>

    <!-- threads controls toggle -->
    <div v-if="bg === 'threads'" class="absolute bottom-4 left-4 z-20">
      <button
        class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/25 text-white/80 transition hover:scale-110 hover:text-white"
        :class="showThreadsControls ? 'bg-white/25 ring-2 ring-white' : 'bg-white/10'"
        title="調整線條參數"
        @click="showThreadsControls = !showThreadsControls"
      >
        <SlidersHorizontal :size="13" />
      </button>
    </div>

    <!-- background switcher -->
    <div class="absolute bottom-4 right-4 z-20 flex gap-1 rounded-full border border-white/15 bg-white/10 p-1 text-xs backdrop-blur">
      <button
        class="rounded-full px-3 py-1 transition"
        :class="bg === 'galaxy' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'"
        @click="bg = 'galaxy'"
      >星空</button>
      <button
        class="rounded-full px-3 py-1 transition"
        :class="bg === 'threads' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'"
        @click="bg = 'threads'"
      >線條</button>
      <button
        class="rounded-full px-3 py-1 transition"
        :class="bg === 'image' ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white'"
        @click="bg = 'image'"
      >圖片</button>
    </div>

    <!-- 開機序列:解碼標題 + [ START ] -->
    <div
      v-if="stage !== 'form'"
      class="relative z-10 flex cursor-default flex-col items-center gap-10"
      @click="skipTyping"
    >
      <!-- invisible 保留版位:消失/重現、START 出現時標題都不位移 -->
      <!-- 隱形完整標題撐死寬度,動畫文字絕對定位疊上 → 全程零位移 -->
      <h1
        class="relative whitespace-nowrap text-4xl sm:text-6xl"
        :class="[titleClass, glitching ? 'intro-glitch' : '', titleHidden ? 'invisible' : '']"
      >
        <span class="invisible">{{ TITLE_TEXT }}</span>
        <span class="absolute inset-0">{{ display }}<span v-if="showCaret" class="intro-caret">▌</span></span>
      </h1>
      <!-- 按鈕版位從頭保留(h-12),出現時不推擠標題 -->
      <div class="flex h-12 items-center justify-center">
      <Transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="opacity-0 translate-y-3"
        enter-to-class="opacity-100 translate-y-0"
      >
        <button
          v-if="stage === 'start' || stage === 'leaving'"
          class="start-btn group relative"
          :class="stage === 'leaving' ? 'intro-glitch' : ''"
          @click.stop="enterApp"
        >
          <!-- TrueFocus 對焦框:hover 由外縮入對焦,移開向外擴散消失 -->
          <span class="focus-frame" aria-hidden="true">
            <i class="focus-corner tl" /><i class="focus-corner tr" />
            <i class="focus-corner bl" /><i class="focus-corner br" />
          </span>
          <span class="tracking-[0.4em]">START</span>
        </button>
      </Transition>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-500 ease-out"
      enter-from-class="opacity-0 translate-y-6 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
    >
    <div
      v-if="stage === 'form'"
      class="relative z-10 w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl"
    >
      <div class="mb-7 text-center">
        <h1 class="text-4xl" :class="titleClass">Knowledge Inbox</h1>
        <p class="mt-2 text-sm text-white/70">懶人福音 —— 丟進來就好,剩下交給它</p>
      </div>

      <!-- Block 1 — 訪客 / Demo -->
      <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">訪客 / Demo</p>
      <button
        class="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-white/90"
        @click="guest"
      >
        <Sparkles :size="18" /> 以訪客身分試用 <ArrowRight :size="16" />
      </button>

      <!-- Block 2 — Google -->
      <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">用 Google 登入</p>
      <button
        class="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10"
        @click="withGoogle"
      >
        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-bold text-[#4285F4]">G</span>
        使用 Google 帳號
      </button>

      <!-- Block 3 — Email / 密碼 -->
      <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">用 Email / 密碼</p>
      <form class="flex flex-col gap-2.5 rounded-2xl border border-white/15 bg-white/5 p-3" @submit.prevent="withPassword">
        <input
          v-model="email"
          type="email"
          required
          placeholder="Email"
          class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
        <input
          v-model="password"
          type="password"
          required
          placeholder="密碼"
          class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          :disabled="busy"
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-white/20 px-4 py-2.5 text-sm font-medium transition hover:bg-white/30 disabled:opacity-50"
        >
          <LogIn :size="16" /> {{ busy ? '登入中…' : '登入' }}
        </button>
      </form>

      <p v-if="error" class="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">{{ error }}</p>
      <p v-if="!auth.supabaseReady" class="mt-4 text-center text-xs leading-relaxed text-white/50">
        帳號登入需先設定 Supabase。<br />
        目前可用「訪客試用」體驗完整功能。
      </p>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Galaxy theme title — light, wide, cosmic gradient with a soft glow. */
.title-galaxy {
  font-weight: 300;
  letter-spacing: 0.16em;
  /* ShinyText(react-bits 語意):半透明底色字 + 白色光帶掃過。
     字色 = 原標題底色 #c4d8ff(帶透明度讓光帶透出)。 */
  color: rgba(196, 216, 255, 0.78);
  background: linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.95) 50%, rgba(255, 255, 255, 0) 60%);
  background-size: 200% 100%;
  animation: title-shine 2.4s linear infinite;
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 26px rgba(150, 180, 255, 0.4);
  /* background-clip:text + 行高 1 會讓 g/y 的下伸部超出背景範圍而隱形 */
  padding-bottom: 0.18em;
  margin-bottom: -0.18em;
}
@keyframes title-shine {
  0% { background-position: 100% 50%; }
  100% { background-position: -100% 50%; }
}
/* Threads theme title — techy monospace, uppercase, tight. */
.title-threads {
  font-family: ui-monospace, SFMono-Regular, Menlo, "Cascadia Code", monospace;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #eaf6ff 0%, #93d6ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 20px rgba(120, 200, 255, 0.35);
  padding-bottom: 0.18em;
  margin-bottom: -0.18em;
}

/* ── 開機序列 ── */
.intro-caret {
  display: inline-block;
  margin-left: 0.1em;
  color: #9fd7ff;
  -webkit-text-fill-color: #9fd7ff;
  animation: caret-blink 0.7s steps(1) infinite;
}
@keyframes caret-blink {
  50% { opacity: 0; }
}
/* 資訊雜訊 glitch:RGB 分離 + 抖動 + 條紋裁切 */
.intro-glitch {
  animation: glitch-jitter 0.12s steps(2) infinite;
}
@keyframes glitch-jitter {
  0%   { transform: translate(0, 0) skewX(0deg); filter: none; clip-path: none; }
  25%  { transform: translate(-3px, 1px) skewX(-2deg); filter: drop-shadow(2px 0 0 rgba(255, 60, 90, 0.8)) drop-shadow(-2px 0 0 rgba(60, 200, 255, 0.8)); clip-path: inset(12% 0 44% 0); }
  50%  { transform: translate(3px, -2px) skewX(1.5deg); filter: drop-shadow(-2px 0 0 rgba(255, 60, 90, 0.8)) drop-shadow(2px 0 0 rgba(60, 200, 255, 0.8)); clip-path: inset(55% 0 8% 0); }
  75%  { transform: translate(-2px, 2px); filter: drop-shadow(1px 0 0 rgba(120, 255, 200, 0.8)); clip-path: inset(30% 0 30% 0); }
  100% { transform: translate(0, 0); filter: none; clip-path: none; }
}
/* 半透科技感 START */
/* 素顏 START:無底色、無霧面、無脈動——只有白色光感邊框 + 文字 */
.start-btn {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 0.75rem;
  background: transparent;
  padding: 0.7rem 1.6rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(240, 248, 255, 0.95);
  text-shadow: 0 0 12px rgba(180, 220, 255, 0.6);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.35);
  transition: box-shadow 0.2s, transform 0.2s;
}
.start-btn:hover {
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}
/* TargetCursor 外型版:四角括號 + 中心點,純跟隨無動畫 */
.login-cursor-none,
.login-cursor-none * {
  cursor: none !important;
}
.target-cursor {
  position: fixed;
  top: 0;
  left: 0;
  width: 34px;
  height: 34px;
  pointer-events: none;
  z-index: 95;
  will-change: transform;
}
/* 官方 TargetCursor 的持續旋轉(2s/圈);位移在外層,旋轉放內層互不干擾 */
.tc-spin {
  position: absolute;
  inset: 0;
  animation: tc-rotate 2s linear infinite;
}
@keyframes tc-rotate {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .tc-spin { animation: none; }
}
.tc-corner {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 0 solid #c4d8ff;
  filter: drop-shadow(0 0 4px rgba(196, 216, 255, 0.6));
}
.tc-corner.tl { top: 0; left: 0; border-top-width: 2px; border-left-width: 2px; }
.tc-corner.tr { top: 0; right: 0; border-top-width: 2px; border-right-width: 2px; }
.tc-corner.bl { bottom: 0; left: 0; border-bottom-width: 2px; border-left-width: 2px; }
.tc-corner.br { bottom: 0; right: 0; border-bottom-width: 2px; border-right-width: 2px; }
.tc-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.85);
}

/* TrueFocus 對焦框(hover 由外縮入;移開向外擴散淡出) */
.focus-frame {
  position: absolute;
  inset: -10px;
  pointer-events: none;
  opacity: 0;
  transform: scale(1.7);
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.3s ease;
}
.group:hover .focus-frame {
  opacity: 1;
  transform: scale(1);
}
.focus-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  /* 與 Knowledge Inbox 標題同色系(白 → #c4d8ff 淡藍) */
  border: 0 solid #c4d8ff;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.55)) drop-shadow(0 0 10px rgba(150, 180, 255, 0.45));
}
.focus-corner.tl { top: 0; left: 0; border-top-width: 2px; border-left-width: 2px; border-top-left-radius: 4px; }
.focus-corner.tr { top: 0; right: 0; border-top-width: 2px; border-right-width: 2px; border-top-right-radius: 4px; }
.focus-corner.bl { bottom: 0; left: 0; border-bottom-width: 2px; border-left-width: 2px; border-bottom-left-radius: 4px; }
.focus-corner.br { bottom: 0; right: 0; border-bottom-width: 2px; border-right-width: 2px; border-bottom-right-radius: 4px; }

</style>
