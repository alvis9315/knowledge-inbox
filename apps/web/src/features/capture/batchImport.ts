import { ruleClassify, type CategoryLike } from './ruleClassifier'

/**
 * 書籤批次匯入(班表 2026-07-17 #2)——純函式層,UI 在 BatchImportModal。
 *
 * 效率關鍵是 hostname 分組:300 條書籤通常只有三四十個網站,
 * 一組選一次分類 = 整組套用 + 分類器學會該 hostname(終身有效)。
 * 不呼叫 extract(百連發成本/速度都不划算);標題用書籤自帶的,
 * 存檔後個別打開時要補再補。
 */
export interface BookmarkItem {
  url: string
  title: string
}

/** 貼上清單:每行「URL」或「URL 標題」;非 http(s) 行忽略。 */
export const parseBookmarkInput = (raw: string): BookmarkItem[] => {
  const out: BookmarkItem[] = []
  for (const line of raw.split(/\r?\n/)) {
    const m = /^(https?:\/\/\S+)\s*(.*)$/.exec(line.trim())
    if (!m) continue
    out.push({ url: m[1], title: m[2].trim() || m[1] })
  }
  return dedupe(out)
}

/** Chrome / Safari / Firefox 匯出的書籤 HTML(Netscape 格式):<A HREF="url">標題</A> */
export const parseBookmarkHtml = (html: string): BookmarkItem[] => {
  const out: BookmarkItem[] = []
  const re = /<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]*)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const title = m[2].trim()
    out.push({ url: m[1], title: title || m[1] })
  }
  return dedupe(out)
}

const dedupe = (items: BookmarkItem[]): BookmarkItem[] => {
  const seen = new Set<string>()
  return items.filter((it) => {
    if (seen.has(it.url)) return false
    seen.add(it.url)
    return true
  })
}

export interface HostGroup {
  host: string
  items: BookmarkItem[]
  /** 分類器對組內各筆的多數決建議(可能 null=沒把握)。 */
  guessType: string | null
}

/** 依 hostname 分組 + 逐筆分類猜測取多數決。解析失敗的 URL 歸 "(無法解析)"。 */
export const groupByHost = (items: BookmarkItem[], categories: CategoryLike[]): HostGroup[] => {
  const map = new Map<string, BookmarkItem[]>()
  for (const it of items) {
    let host = '(無法解析)'
    try {
      host = new URL(it.url).hostname.replace(/^www\./, '')
    } catch {
      /* noop */
    }
    const arr = map.get(host) ?? []
    arr.push(it)
    map.set(host, arr)
  }

  const groups: HostGroup[] = []
  for (const [host, arr] of map) {
    const votes = new Map<string, number>()
    for (const it of arr) {
      const guess = ruleClassify(`${it.title} ${it.url}`, categories)
      if (guess.type) votes.set(guess.type, (votes.get(guess.type) ?? 0) + 1)
    }
    let guessType: string | null = null
    let best = 0
    for (const [type, n] of votes) {
      if (n > best) {
        best = n
        guessType = type
      }
    }
    groups.push({ host, items: arr, guessType })
  }
  // 筆數多的組排前面(先處理最有價值的決策)
  return groups.sort((a, b) => b.items.length - a.items.length)
}
