import { beforeEach, describe, expect, it } from 'vitest'
import {
  getLearnedDict,
  learnFromCorrection,
  mergeDictImport,
  parseDictImport,
  type CategoryLike,
  type DictImportPreview,
} from '@/features/capture/ruleClassifier'

// 班表 #1:字典批次匯入——解析(名稱→key/過濾/夾限)與合併(取較大權重)。

const cats: CategoryLike[] = [
  { key: 'learn_ai', name: 'AI 技能', domain: '學習' },
  { key: 'food_japanese', name: '日式料理', domain: '美食' },
]

beforeEach(() => localStorage.clear())

describe('parseDictImport', () => {
  it('名稱/大類斜線/直接 key 三種寫法都解析得到', () => {
    const r = parseDictImport(
      JSON.stringify({
        'AI 技能': { 'huggingface.co': 3 },
        '美食/日式料理': { 壽司: 2 },
        learn_ai: { ollama: 2 },
      }),
      cats,
    ) as DictImportPreview
    expect(typeof r).not.toBe('string')
    expect(r.matched.map((m) => m.typeKey).sort()).toEqual(['food_japanese', 'learn_ai', 'learn_ai'].sort())
    expect(r.termCount).toBe(3)
  })

  it('容忍整段 ```json code block```', () => {
    const r = parseDictImport('```json\n{ "AI 技能": { "ollama": 2 } }\n```', cats)
    expect(typeof r).not.toBe('string')
    expect((r as DictImportPreview).termCount).toBe(1)
  })

  it('對不上的分類列進 unknownCategories,不硬塞', () => {
    const r = parseDictImport(
      JSON.stringify({ 不存在的分類: { x: 2 }, 'AI 技能': { ollama: 2 } }),
      cats,
    ) as DictImportPreview
    expect(r.unknownCategories).toEqual(['不存在的分類'])
    expect(r.matched).toHaveLength(1)
  })

  it('通用平台 hostname 與權重不合法的詞被過濾', () => {
    const r = parseDictImport(
      JSON.stringify({
        'AI 技能': { 'youtube.com': 3, 'www.instagram.com': 3, ollama: 0, valid: 2 },
      }),
      cats,
    ) as DictImportPreview
    expect(r.filteredTerms.sort()).toEqual(['ollama', 'www.instagram.com', 'youtube.com'].sort())
    expect(Object.keys(r.matched[0].terms)).toEqual(['valid'])
  })

  it('權重夾限到 8;詞轉小寫、去 www', () => {
    const r = parseDictImport(
      JSON.stringify({ 'AI 技能': { 'WWW.HuggingFace.co': 99, OLLAMA: 2 } }),
      cats,
    ) as DictImportPreview
    expect(r.matched[0].terms).toEqual({ 'huggingface.co': 8, ollama: 2 })
  })

  it('壞 JSON / 空內容回錯誤訊息字串', () => {
    expect(typeof parseDictImport('not json', cats)).toBe('string')
    expect(typeof parseDictImport('{}', cats)).toBe('string')
    expect(typeof parseDictImport('[1,2]', cats)).toBe('string')
  })
})

describe('mergeDictImport', () => {
  it('同詞取較大權重,不覆蓋較高的既有權重', () => {
    // 先由正常修正學到 hostname(+3)
    learnFromCorrection('看看 https://legendsverse.com/home', 'learn_ai')
    expect(getLearnedDict().learn_ai['legendsverse.com']).toBe(3)

    const r = parseDictImport(
      JSON.stringify({ 'AI 技能': { 'legendsverse.com': 2, ollama: 2 } }),
      cats,
    ) as DictImportPreview
    mergeDictImport(r)

    const dict = getLearnedDict()
    expect(dict.learn_ai['legendsverse.com']).toBe(3) // 較大者保留
    expect(dict.learn_ai['ollama']).toBe(2) // 新詞進來
  })

  it('匯入後分類器立即吃得到(端到端)', async () => {
    const r = parseDictImport(
      JSON.stringify({ 'AI 技能': { 'legendsverse.com': 3 } }),
      cats,
    ) as DictImportPreview
    mergeDictImport(r)
    const { ruleClassify } = await import('@/features/capture/ruleClassifier')
    const guess = ruleClassify('https://legendsverse.com/home', cats)
    expect(guess.type).toBe('learn_ai')
  })
})
