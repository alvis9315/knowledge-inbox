import { ref } from 'vue'
import type { LiveBgKind } from './themePresets'

/** 當前頁面的活背景型別(AppShell 維護;null=無活背景)。 */
export const activeLiveBg = ref<LiveBgKind | null>(null)
/** 控制面板開關(galaxy/threads 開參數面板;image 開上傳封面)。 */
export const bgControlsOpen = ref(false)
