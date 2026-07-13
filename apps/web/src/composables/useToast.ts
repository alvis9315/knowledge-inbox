import { ref } from 'vue'

/**
 * 全域 toast(非阻斷提示)。規則:任何建立/更新/刪除等操作,成功與失敗
 * 都要給使用者明確回饋——成功用 toast(不打斷流程,絕不用彈窗),
 * 失敗用 toast 或表單內 inline 紅字。由 ToastHost.vue 統一渲染。
 */
export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

const items = ref<ToastItem[]>([])
let seq = 0

const push = (type: ToastType, message: string, duration = 3200) => {
  const id = ++seq
  items.value.push({ id, type, message })
  setTimeout(() => dismiss(id), duration)
}

export const dismiss = (id: number) => {
  items.value = items.value.filter((t) => t.id !== id)
}

export const toast = {
  success: (msg: string) => push('success', msg),
  error: (msg: string) => push('error', msg, 5000),
  info: (msg: string) => push('info', msg),
}

export const useToastItems = () => {
  return items
}
