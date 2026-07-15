import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import QuickCapture from '@/features/capture/QuickCapture.vue'
import { createEntry } from '@/features/entries/api/entriesApi'
import { extractUrl } from '@/services/extract'

// 提案 H2 驗收:extract 進行中(可控 deferred promise)按鈕提交 +
// Meta/Ctrl+Enter 混合連發 → createEntry 僅被呼叫一次。

vi.mock('@/features/entries/api/entriesApi', () => ({
  createEntry: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/services/extract', () => ({
  extractUrl: vi.fn(),
}))
vi.mock('@/features/capture/classify', () => ({
  classifyText: vi.fn().mockResolvedValue({ type: null, confidence: 0.3, reason: null }),
}))
vi.mock('@/features/categories/stores/categoriesStore', () => ({
  useCategoriesStore: () => ({
    categories: [],
    typeByKey: {},
    tagNames: [],
    touch: vi.fn().mockResolvedValue(undefined),
  }),
}))
vi.mock('@/composables/useToast', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const mountCapture = () =>
  mount(QuickCapture, {
    props: { open: true },
    global: {
      stubs: {
        BaseModal: { template: '<div><slot /></div>' },
        BaseButton: { template: '<button type="submit"><slot /></button>' },
        CategoryCascader: true,
        TagInput: true,
        ChevronDown: true,
      },
    },
  })

describe('H2:submit 防重入', () => {
  it('extract 進行中連發(表單 submit + ⌘Enter + Ctrl+Enter)→ createEntry 僅一次', async () => {
    // 共用同一個 gate:若沒有 guard,四次 submit 會同時卡在這裡,
    // 放行後 createEntry 會被呼叫 4 次 —— 測試才有鑑別力。
    let release!: (v: null) => void
    const gate = new Promise<null>((resolve) => (release = resolve))
    vi.mocked(extractUrl).mockReturnValue(gate)

    const w = mountCapture()
    await w.find('textarea').setValue('https://example.com/slow-page')

    // 第一發:進入 submit,卡在 await extractUrl
    await w.find('form').trigger('submit')
    // 連發:鍵盤快捷鍵(disabled 擋不到)+ 再一次表單 submit
    await w.find('textarea').trigger('keydown.enter', { metaKey: true })
    await w.find('textarea').trigger('keydown.enter', { ctrlKey: true })
    await w.find('form').trigger('submit')

    release(null) // 放行擷取
    await flushPromises()

    expect(vi.mocked(createEntry)).toHaveBeenCalledTimes(1)
  })

  it('第一次儲存完成後可再次送出(guard 不是一次性鎖)', async () => {
    vi.mocked(extractUrl).mockResolvedValue(null)
    vi.mocked(createEntry).mockClear()

    const w = mountCapture()
    await w.find('textarea').setValue('https://example.com/a')
    await w.find('form').trigger('submit')
    await flushPromises()

    await w.find('textarea').setValue('https://example.com/b')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(vi.mocked(createEntry)).toHaveBeenCalledTimes(2)
  })
})
