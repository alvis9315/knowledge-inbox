<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { loadFile, LOGIN_COVER_KEY } from '@/services/localFiles'

/**
 * Photo-real galaxy login backdrop. A shader/gradient can't reproduce a real
 * spiral galaxy (structured tilted disk, dust lanes) — so this uses an actual
 * image plus lightweight motion, per the 仙女座 login investigation:
 *   base image → dark gradient mask → breathing scale → subtle mouse parallax.
 *
 * Drop the image into apps/web/public/images/ as (any subset of):
 *   login-galaxy.avif / login-galaxy.webp / login-galaxy.jpg
 * Recommended: your own AI-generated galaxy, or a NASA/ESA public-domain
 * Andromeda photo (avoid the Apple macOS wallpaper — copyright). Keep it
 * ≤ ~1.2 MB desktop; AVIF/WebP preferred. If no file exists yet, a deep-navy
 * andromeda gradient shows instead (so it's never blank).
 */
const props = withDefaults(defineProps<{ src?: string; parallax?: boolean; version?: number }>(), {
  src: '/images/login-galaxy',
  parallax: true,
  version: 0,
})

const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const isMobile = useMediaQuery('(max-width: 767px)')
const imgError = ref(false)
const parallaxEl = ref<HTMLElement | null>(null)

// 使用者自訂封面(IndexedDB;圖/GIF/影片)。version 變動時重新載入。
const customUrl = ref<string | null>(null)
const customIsVideo = ref(false)
const loadCustom = async () => {
  const blob = await loadFile(LOGIN_COVER_KEY)
  if (customUrl.value) URL.revokeObjectURL(customUrl.value)
  if (blob) {
    customUrl.value = URL.createObjectURL(blob)
    customIsVideo.value = blob.type.startsWith('video/')
  } else {
    customUrl.value = null
    customIsVideo.value = false
  }
}
watch(() => props.version, loadCustom)

// Subtle mouse parallax (≤ 8px) — desktop only, off for reduced-motion.
let raf = 0
const onMove = (e: MouseEvent) => {
  const el = parallaxEl.value
  if (!el) return
  const x = (e.clientX / window.innerWidth - 0.5) * 2 // -1..1
  const y = (e.clientY / window.innerHeight - 0.5) * 2
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    el.style.transform = `translate(${x * -8}px, ${y * -8}px)`
  })
}
const motionOn = () => {
  return props.parallax && !reduceMotion.value && !isMobile.value
}
onMounted(() => {
  loadCustom()
  if (motionOn()) window.addEventListener('mousemove', onMove, { passive: true })
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  cancelAnimationFrame(raf)
  if (customUrl.value) URL.revokeObjectURL(customUrl.value)
})
</script>

<template>
  <div class="galaxy-img" aria-hidden="true">
    <div ref="parallaxEl" class="galaxy-img__parallax">
      <!-- 使用者自訂封面(影片自動靜音循環;圖/GIF 直接顯示) -->
      <video
        v-if="customUrl && customIsVideo"
        :src="customUrl"
        class="galaxy-img__img"
        autoplay
        muted
        loop
        playsinline
      />
      <img
        v-else-if="customUrl"
        :src="customUrl"
        alt=""
        class="galaxy-img__img"
        :class="{ 'galaxy-img__img--breathe': !reduceMotion }"
      />
      <picture v-else-if="!imgError">
        <source :srcset="`${src}.avif`" type="image/avif" />
        <source :srcset="`${src}.webp`" type="image/webp" />
        <img
          :src="`${src}.jpg`"
          alt=""
          class="galaxy-img__img"
          :class="{ 'galaxy-img__img--breathe': !reduceMotion }"
          @error="imgError = true"
        />
      </picture>
      <div v-else class="galaxy-img__fallback" />
    </div>
    <div class="galaxy-img__overlay" />
  </div>
</template>

<style scoped>
.galaxy-img {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
/* Oversized so parallax translate never reveals an edge. */
.galaxy-img__parallax {
  position: absolute;
  inset: -24px;
  will-change: transform;
  transition: transform 0.25s ease-out;
}
.galaxy-img__img,
.galaxy-img__fallback {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 44% center;
}
/* Slow "breathing" zoom, 12s, respects reduced-motion (class not applied). */
.galaxy-img__img--breathe {
  animation: galaxy-breathe 14s ease-in-out infinite;
}
@keyframes galaxy-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}
/* Shown only when no image file is present — deep-navy andromeda gradient. */
.galaxy-img__fallback {
  background:
    radial-gradient(ellipse 42% 30% at 41% 50%, rgba(255, 242, 222, 0.42) 0%, rgba(242, 214, 186, 0.24) 17%, rgba(198, 170, 182, 0.12) 33%, rgba(120, 132, 178, 0.05) 48%, transparent 62%),
    radial-gradient(ellipse 88% 62% at 44% 50%, rgba(72, 126, 198, 0.17) 0%, rgba(42, 88, 152, 0.1) 40%, transparent 70%),
    radial-gradient(ellipse 132% 120% at 46% 48%, #123063 0%, #0e2450 34%, #0a1a3c 62%, #071429 84%, #050c1e 100%);
}
/* Dark mask so the centered glass card and white text stay readable. */
.galaxy-img__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 58% 66% at 50% 50%, rgba(4, 8, 16, 0.36) 0%, rgba(4, 8, 16, 0.12) 46%, transparent 72%),
    linear-gradient(180deg, rgba(4, 8, 16, 0.28) 0%, rgba(4, 8, 16, 0.16) 42%, rgba(4, 8, 16, 0.44) 100%);
}
@media (max-width: 767px) {
  .galaxy-img__overlay {
    background: linear-gradient(
      180deg,
      rgba(4, 8, 16, 0.5) 0%,
      rgba(4, 8, 16, 0.68) 45%,
      rgba(4, 8, 16, 0.9) 100%
    );
  }
}
</style>
