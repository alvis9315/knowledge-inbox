import { beforeEach, describe, expect, it } from 'vitest'
import { groupByHost, parseBookmarkHtml, parseBookmarkInput } from '@/features/capture/batchImport'
import type { CategoryLike } from '@/features/capture/ruleClassifier'

// 班表 #2:書籤批次匯入——清單/書籤 HTML 解析、去重、hostname 分組多數決。

const cats: CategoryLike[] = [
  { key: 'learn_ai', name: 'AI 技能', domain: '學習' },
  { key: 'food_japanese', name: '日式料理', domain: '美食' },
  { key: 'jp_food', name: '餐廳口袋名單', domain: '日本旅遊' },
]

beforeEach(() => localStorage.clear())

describe('parseBookmarkInput(貼清單)', () => {
  it('每行一條;可帶標題;非連結行忽略;去重', () => {
    const items = parseBookmarkInput(
      [
        'https://a.com/x 標題A',
        'https://b.com/y',
        '不是連結的行',
        '  https://a.com/x 重複的',
        'ftp://c.com/z',
        '',
      ].join('\n'),
    )
    expect(items).toEqual([
      { url: 'https://a.com/x', title: '標題A' },
      { url: 'https://b.com/y', title: 'https://b.com/y' },
    ])
  })
})

describe('parseBookmarkHtml(瀏覽器書籤匯出)', () => {
  it('Netscape 格式 <DT><A HREF>title</A> 解析 + 去重', () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://a.com/x" ADD_DATE="1700000000">標題A</A>
  <DT><A HREF="https://b.com/y" ICON="data:image/png;base64,xx">B</A>
  <DT><A HREF="https://a.com/x">重複</A>
  <DT><A HREF="javascript:void(0)">不是http</A>
</DL></p>`
    expect(parseBookmarkHtml(html)).toEqual([
      { url: 'https://a.com/x', title: '標題A' },
      { url: 'https://b.com/y', title: 'B' },
    ])
  })
})

describe('groupByHost(分組 + 多數決建議)', () => {
  it('同站合組(www 去除),筆數多的組排前;分類建議取多數決', () => {
    const groups = groupByHost(
      [
        { url: 'https://www.tabelog.com/tokyo/1', title: '燒肉' },
        { url: 'https://tabelog.com/osaka/2', title: '拉麵' },
        { url: 'https://tabelog.com/kyoto/3', title: '甜點' },
        { url: 'https://unknown-spa.com/home', title: 'unknown-spa' },
      ],
      cats,
    )
    expect(groups.map((g) => g.host)).toEqual(['tabelog.com', 'unknown-spa.com'])
    expect(groups[0].items).toHaveLength(3)
    // tabelog 走網域規則 → 圈定日本旅遊保底 jp_food
    expect(groups[0].guessType).toBe('jp_food')
    // 沒任何線索的站 → 無建議(留給使用者選或略過)
    expect(groups[1].guessType).toBeNull()
  })

  it('壞 URL 歸「(無法解析)」組,不會炸', () => {
    const groups = groupByHost([{ url: 'https://[bad', title: 'x' }], cats)
    expect(groups[0].host).toBe('(無法解析)')
  })
})
