import { onUnmounted, ref, watch, type Ref, type CSSProperties } from 'vue'

/**
 * 下拉面板定位:面板 Teleport 到 body(fixed),錨定在觸發元素下方——
 * 徹底擺脫彈窗/捲動容器的裁切(overflow)。空間不足時自動往上開;
 * 捲動/縮放時跟著重新定位。
 */
export function useAnchoredPanel(
  anchor: Ref<HTMLElement | null>,
  opts: { matchWidth?: boolean; panelWidth?: number; panelMaxHeight?: number } = {},
) {
  const open = ref(false)
  const style = ref<CSSProperties>({})

  function reposition() {
    const el = anchor.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = opts.matchWidth !== false && !opts.panelWidth ? Math.max(r.width, 208) : (opts.panelWidth ?? r.width)
    const maxH = opts.panelMaxHeight ?? 320
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    // 下方放不下且上方夠高 → 往上開。
    const openUp = r.bottom + maxH + 12 > window.innerHeight && r.top > maxH + 12
    style.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${width}px`,
      zIndex: 80,
      ...(openUp
        ? { bottom: `${window.innerHeight - r.top + 4}px` }
        : { top: `${r.bottom + 4}px` }),
    }
  }

  function onWindow() {
    if (open.value) reposition()
  }

  watch(open, (o) => {
    if (o) {
      reposition()
      window.addEventListener('scroll', onWindow, true)
      window.addEventListener('resize', onWindow)
    } else {
      window.removeEventListener('scroll', onWindow, true)
      window.removeEventListener('resize', onWindow)
    }
  })
  onUnmounted(() => {
    window.removeEventListener('scroll', onWindow, true)
    window.removeEventListener('resize', onWindow)
  })

  return { open, style, reposition }
}
