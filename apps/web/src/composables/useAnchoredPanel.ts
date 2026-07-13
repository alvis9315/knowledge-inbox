import { onUnmounted, ref, watch, type Ref, type CSSProperties } from 'vue'

/** 浮動面板與視窗邊緣的最小間距(規則:元件不得貼死畫面邊緣)。 */
const EDGE = 12

/**
 * 下拉面板定位:面板 Teleport 到 body(fixed),錨定在觸發元素下方——
 * 徹底擺脫彈窗/捲動容器的裁切。空間不足時自動往上開;高度依剩餘空間
 * 動態夾制(面板內部自己捲),四邊永遠留 ≥12px;捲動/縮放跟著重新定位。
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
    const wantH = opts.panelMaxHeight ?? 320
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - width - EDGE))

    const spaceBelow = window.innerHeight - r.bottom - EDGE - 4
    const spaceAbove = r.top - EDGE - 4
    // 下方放不下想要的高度、且上方比較寬裕 → 往上開。
    const openUp = spaceBelow < wantH && spaceAbove > spaceBelow
    const maxHeight = Math.max(120, Math.min(wantH, openUp ? spaceAbove : spaceBelow))

    style.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
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
