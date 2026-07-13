<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { Sparkles, ArrowRight, LogIn, SlidersHorizontal } from 'lucide-vue-next'
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

const router = useRouter()
const auth = useAuthStore()

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
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden p-4 text-white">
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
      :mouse-repulsion="true"
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
    <GalaxyImageBackground v-else class="absolute inset-0" />

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

    <div
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
  </div>
</template>

<style scoped>
/* Galaxy theme title — light, wide, cosmic gradient with a soft glow. */
.title-galaxy {
  font-weight: 300;
  letter-spacing: 0.16em;
  background: linear-gradient(180deg, #ffffff 0%, #c4d8ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 26px rgba(150, 180, 255, 0.4);
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
}
</style>
