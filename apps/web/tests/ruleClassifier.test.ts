import { beforeEach, describe, expect, it } from 'vitest'
import { ruleClassify, type CategoryLike } from '@/features/capture/ruleClassifier'

// 提案 H3 驗收案例 1/2/2b/3/4/5 + 純 URL 回歸。
// fixture 鏡射 seed(0007_seed_user_taxonomy):社群排前面以證明
// 決勝規則(而非陣列順序)決定結果。filed 門檻 = confidence > 0.85(嚴格大於)。

const cats: CategoryLike[] = [
  { key: 'social_ig_copy', name: 'IG 文案撰寫', domain: '社群' },
  { key: 'social_shortvideo', name: '短影音製作', domain: '社群' },
  { key: 'social_youtube', name: 'YouTube 經營', domain: '社群' },
  { key: 'food_cafe', name: '咖啡廳', domain: '美食' },
  { key: 'food_japanese', name: '日式料理', domain: '美食' },
  { key: 'jp_food', name: '餐廳口袋名單', domain: '日本旅遊' },
]

beforeEach(() => localStorage.clear())

describe('H3:hasMeta 時多主題平台降軟訊號', () => {
  it('案例 1:美食標題的 YouTube 連結 → 自動歸檔美食(conf 0.95 > 0.85)', () => {
    const r = ruleClassify(
      '東京壽司丼飯開箱 https://www.youtube.com/watch?v=abc',
      cats,
      { hasMeta: true },
    )
    expect(r.type).toBe('food_japanese') // 壽司+2、丼+2 壓過社群軟訊號+1
    expect(r.confidence).toBe(0.95)
    expect(r.confidence > 0.85).toBe(true) // status=filed
  })

  it('案例 2:單一關鍵字 → 分類正確但低信心進待確認(0.8 ≤ 0.85)', () => {
    const r = ruleClassify('壽司職人專訪 https://youtu.be/abc', cats, { hasMeta: true })
    expect(r.type).toBe('food_japanese')
    expect(r.confidence).toBe(0.8)
    expect(r.confidence > 0.85).toBe(false) // status=pending_review
  })

  it('案例 2b:confidence 恰為 0.85 → 邊界值不自動歸檔(嚴格大於)', () => {
    // 靜態 咖啡+2,自學詞權重 1 折半 +0.5 → score 2.5 → conf 0.85
    localStorage.setItem('ki-learned-kw-v1', JSON.stringify({ food_cafe: { 職人: 1 } }))
    const r = ruleClassify('咖啡職人 https://www.youtube.com/watch?v=abc', cats, { hasMeta: true })
    expect(r.type).toBe('food_cafe')
    expect(r.confidence).toBe(0.85)
    expect(r.confidence > 0.85).toBe(false) // status=pending_review
  })

  it('案例 3:無擷取標題(hasMeta=false)→ 行為同現狀:nameHint 早退 0.9', () => {
    const r = ruleClassify('https://www.youtube.com/watch?v=abc', cats)
    expect(r.type).toBe('social_youtube')
    expect(r.confidence).toBe(0.9)
  })

  it('案例 4:tabelog(單主題網域)有無 meta 行為一致', () => {
    const noMeta = ruleClassify('https://tabelog.com/tokyo/A1301/', cats)
    const withMeta = ruleClassify('https://tabelog.com/tokyo/A1301/', cats, { hasMeta: true })
    expect(noMeta).toEqual(withMeta)
    expect(noMeta.type).toBe('jp_food') // 圈定日本旅遊,保底第一個子分類
    expect(noMeta.confidence).toBe(0.6)
  })

  it('案例 5:同分決勝——實質命中壓過軟訊號(社群排陣列前面仍輸)', () => {
    // food_cafe:咖啡+2(實質 1 命中)。社群各分類:domain 詞「社群」+1 + 軟訊號+1 = 2(實質 0)
    const r = ruleClassify('咖啡 社群 https://www.youtube.com/watch?v=abc', cats, { hasMeta: true })
    expect(r.type).toBe('food_cafe')
    expect(r.confidence).toBe(0.8)
  })

  it('hasMeta 但純軟訊號無任何實質命中 → 保底社群第一子分類 0.6(不冒充關鍵字結果)', () => {
    const r = ruleClassify('無關內容 https://www.youtube.com/watch?v=abc', cats, { hasMeta: true })
    expect(r.type).toBe('social_ig_copy')
    expect(r.confidence).toBe(0.6)
  })
})

describe('回歸:純 URL(no-meta)行為不變', () => {
  it('generic 平台無 meta 仍走 nameHint 早退', () => {
    expect(ruleClassify('https://youtu.be/x', cats).type).toBe('social_youtube')
    expect(ruleClassify('https://www.threads.net/@x/post/1', cats).confidence).toBe(0.6) // 無 threads 命名分類 → 圈定保底
  })
  it('關鍵字文字(無 URL)照舊評分', () => {
    const r = ruleClassify('壽司 丼飯 名店', cats)
    expect(r.type).toBe('food_japanese')
    expect(r.confidence).toBe(0.95)
  })
  it('什麼都沒中 → null / 0.3', () => {
    const r = ruleClassify('完全無關的內容', cats)
    expect(r.type).toBeNull()
    expect(r.confidence).toBe(0.3)
  })
})
