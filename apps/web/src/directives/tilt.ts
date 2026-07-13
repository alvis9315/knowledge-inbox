import type { Directive } from 'vue'

/**
 * v-tilt — TiltedCard(react-bits)的 Vue 改編版:滑鼠位置驅動 3D 傾斜
 * + 輕微放大。改編點:幅度調柔(預設 8°)、拖曳中自動停用、觸控裝置
 * 不啟用;不含官方的 tooltip/overlay/mobile 警告(內容卡用不到)。
 * 用法:v-tilt 或 v-tilt="12"(自訂幅度)。
 */
const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

type TiltEl = HTMLElement & { _tiltCleanup?: () => void }

export const vTilt: Directive<TiltEl, number | undefined> = {
  mounted(el, binding) {
    if (coarse) return
    const amp = binding.value ?? 8
    let raf = 0
    el.style.transition = 'transform 0.25s ease-out'
    el.style.willChange = 'transform'

    const onMove = (e: MouseEvent) => {
      // 拖曳中(vue-draggable-plus / SortableJS 的狀態 class)不傾斜
      if (el.classList.contains('sortable-chosen') || el.classList.contains('sortable-drag')) return
      const r = el.getBoundingClientRect()
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -2 * amp
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 2 * amp
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.03)`
      })
    }
    const reset = () => {
      cancelAnimationFrame(raf)
      el.style.transform = ''
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', reset)
    el._tiltCleanup = () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', reset)
    }
  },
  unmounted(el) {
    el._tiltCleanup?.()
  },
}
