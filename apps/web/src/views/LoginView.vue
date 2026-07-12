<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { Sparkles, ArrowRight, LogIn, SlidersHorizontal } from 'lucide-vue-next'
import KnowledgeGalaxy from '@/components/backgrounds/KnowledgeGalaxy.vue'
import KnowledgeThreads from '@/components/backgrounds/KnowledgeThreads.vue'
import { useAuthStore } from '@/features/auth/stores/authStore'

const bg = useLocalStorage<'galaxy' | 'threads'>('ki-login-bg', 'galaxy')

// Galaxy backdrop colour — three testable options.
type GalaxyBg = 'black' | 'blue' | 'nebula'
const galaxyBg = useLocalStorage<GalaxyBg>('ki-login-galaxy-bg-v2', 'black')
const BG: Record<GalaxyBg, string> = {
  black: 'radial-gradient(circle at 50% 50%, #0a0a14 0%, #000 82%)',
  blue: 'radial-gradient(circle at 50% 50%, #12224e 0%, #0b1636 36%, #070d24 64%, #03050f 100%)',
  nebula:
    'radial-gradient(ellipse 82% 56% at 50% 50%, #fbe4d2 0%, #f2d9c3 5%, #dfbca9 11%, #dbb0a0 16%, #a26b66 21%, #967786 26%, #83718b 32%, #858baf 37%, #3a3f77 42%, #3667aa 47%, #ddf0ff 53%, #4e94d0 58%, #1c6cb3 63%, #15559d 68%, #0e4585 74%, #14336a 79%, #142752 84%, #0d1834 89%, #0c1125 95%, #0b0b17 100%)',
}
const bgOptions: Array<{ key: GalaxyBg; label: string }> = [
  { key: 'black', label: '黑底' },
  { key: 'blue', label: '深邃藍' },
  { key: 'nebula', label: '星雲多彩' },
]
const galaxyBgCss = computed(() => BG[galaxyBg.value])
const titleClass = computed(() => (bg.value === 'galaxy' ? 'title-galaxy' : 'title-threads'))
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
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
async function withGoogle() {
  error.value = null
  try {
    await auth.loginWithGoogle()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
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
      :density="0.9"
      :glow-intensity="0.35"
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
      v-else
      class="absolute inset-0"
      :show-controls="showThreadsControls"
      :color="[0.55, 0.72, 1.0]"
      :amplitude="2.3"
      :distance="0"
      :enable-mouse-interaction="true"
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
          placeholder="Email"
          class="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
        <input
          v-model="password"
          type="password"
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
