/**
 * 規則分類器 v2 — 無 AI API 的分類主力(docs/ai-strategy.md)。
 *
 * 三層訊號,由強到弱:
 *   1. 網域對照表:URL 的 hostname 就是強分類訊號(youtube→社群…),
 *      不需要抓網頁(所以 mock/純前端也能用,不受 CORS 限制)。
 *   2. 關鍵字加權字典:靜態字典 + 「回饋自學」權重(待確認畫面的人工
 *      修正會把該文字的詞加權進 localStorage,越用越準)。
 *   3. 之後可插 Ollama / 雲端 LLM 當第三層(classifyText 介面不變)。
 *
 * 純前端、零成本;mock 與 supabase 模式共用。
 */

export interface CategoryLike {
  key: string
  name: string
  domain: string
}

export interface RuleClassification {
  type: string | null
  confidence: number
  /** 命中原因,審核畫面可顯示(e.g. "網域 youtube.com" / "關鍵字 拉麵, 道頓堀")。 */
  reason: string | null
}

// ── 1. 網域對照表 ──────────────────────────────────────────────────────
// 以「大類別名 + 子分類名稱關鍵字」對應,不硬編 type key——使用者自訂分類
// 也能對上;找不到精確子分類時退回該大類別第一個子分類(低信心 → 待確認)。
interface DomainRule {
  host: RegExp
  domain: string
  nameHint?: string
}

const DOMAIN_RULES: DomainRule[] = [
  { host: /(youtube\.com|youtu\.be)/, domain: '社群', nameHint: 'youtube' },
  { host: /instagram\.com/, domain: '社群', nameHint: 'ig' },
  { host: /threads\.(net|com)/, domain: '社群', nameHint: 'threads' },
  { host: /(facebook\.com|fb\.com|fb\.watch)/, domain: '社群' },
  { host: /tiktok\.com/, domain: '社群', nameHint: '短影音' },
  { host: /(github\.com|stackoverflow\.com|dev\.to|medium\.com|ithome\.com\.tw)/, domain: '學習' },
  { host: /tabelog\.com/, domain: '日本旅遊' },
  { host: /(104\.com\.tw|1111\.com\.tw|linkedin\.com|cakeresume\.com|yourator\.co)/, domain: '求職' },
  { host: /(unsplash\.com|flickr\.com|500px\.com)/, domain: '攝影' },
]

// Google Maps:地點名就在 URL path 裡,decode 出來丟進關鍵字評分。
const MAPS_HOST = /(maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps)/

const extractMapsPlace = (url: string): string | null => {
  try {
    const m = /\/maps\/place\/([^/@?]+)/.exec(url)
    if (m) return decodeURIComponent(m[1]).replace(/\+/g, ' ')
  } catch {
    /* noop */
  }
  return null
}

// ── 2. 關鍵字加權字典(靜態)────────────────────────────────────────────
// 從 mock 分類器遷移並擴充;key 對應 seed 的 type key,使用者自訂分類靠
// 名稱命中 + 回饋自學補。
const KEYWORDS: Record<string, string[]> = {
  food_cafe: ['咖啡', 'cafe', '拿鐵', '手沖', '烘豆'],
  food_drinks: ['手搖', '珍奶', '奶茶', '飲料', '茶飲'],
  food_japanese: ['壽司', '日料', '生魚片', '丼', '居酒屋'],
  food_brunch: ['早午餐', 'brunch'],
  learn_ai: ['ai', 'llm', 'claude', 'gpt', 'mcp', 'prompt', 'agent', 'rag'],
  learn_frontend: ['vue', 'react', 'css', '前端', 'tailwind', 'vite'],
  learn_backend: ['api', 'spring', 'node', '後端', 'server', 'fastapi'],
  learn_database: ['sql', 'postgres', 'mysql', '資料庫', 'pgvector', 'redis'],
  job_interview: ['面試', 'interview'],
  job_resume: ['履歷', 'resume', 'cv'],
  photo_lighting: ['打光', '燈光', '補光'],
  photo_lens: ['鏡頭', 'lens', '定焦', '變焦'],
  photo_camera: ['相機', 'fuji', 'sony', 'canon', 'nikon'],
  social_ig_copy: ['文案', 'caption', 'hashtag'],
  social_shortvideo: ['reels', '短影音', 'tiktok', 'shorts'],
}

// ── 回饋自學權重(localStorage)─────────────────────────────────────────
const LEARNED_KEY = 'ki-learned-kw-v1'
export type LearnedMap = Record<string, Record<string, number>>

const loadLearned = (): LearnedMap => {
  try {
    return JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '{}') as LearnedMap
  } catch {
    return {}
  }
}
const saveLearned = (m: LearnedMap) => {
  localStorage.setItem(LEARNED_KEY, JSON.stringify(m))
}

// 「通用 hostname」不得進自學字典:這些網域什麼主題都有(地圖、短網址、
// 大平台),學起來會過度泛化(例:把 maps.app.goo.gl 學成美食,之後所有
// 地圖連結都被塞進美食)。單主題網站(如 figurelist.co)才適合 hostname 學習。
const GENERIC_HOSTS =
  /(^|\.)(goo\.gl|google\.[a-z.]+|youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.com|threads\.(net|com)|x\.com|twitter\.com|t\.co|bit\.ly|reurl\.cc|tinyurl\.com|lin\.ee|line\.me|maps\.app\.goo\.gl)$/

/** 從文字抽候選詞:hostname(通用網域除外)、拉丁詞、中日韓 2~4 字段。 */
const extractTerms = (text: string): string[] => {
  const terms = new Set<string>()
  const cleaned = text.toLowerCase().replace(/https?:\/\/\S+/g, (m) => {
    try {
      const host = new URL(m).hostname.replace(/^www\./, '')
      if (!GENERIC_HOSTS.test(host)) terms.add(host)
    } catch {
      /* noop */
    }
    return ' '
  })
  for (const m of cleaned.matchAll(/[a-z][a-z0-9]{1,19}/g)) terms.add(m[0])
  for (const run of cleaned.match(/[぀-ヿ一-鿿]{2,}/g) ?? []) {
    if (run.length <= 4) terms.add(run)
    else for (let i = 0; i < Math.min(run.length - 1, 6); i++) terms.add(run.slice(i, i + 2))
  }
  return [...terms].slice(0, 12)
}

/**
 * 回饋自學:人工修正(或確認)分類時呼叫,把該文字的詞加權進正確分類。
 * 積木原則第 5 條(AI 建議、人核准)的無 AI 版。
 */
export const learnFromCorrection = (text: string, typeKey: string) => {
  const learned = loadLearned()
  const bucket = (learned[typeKey] ??= {})
  for (const term of extractTerms(text)) {
    // Hostname 是強訊號(同網站≈同分類):一次修正就足以讓下次自動歸檔;
    // 一般詞彙保守累積,避免單次雜訊詞污染字典。
    const inc = term.includes('.') ? 3 : 2
    bucket[term] = Math.min((bucket[term] ?? 0) + inc, 8)
  }
  saveLearned(learned)
}

// ── 自學字典管理(齒輪選單「自學字典」畫面用)──────────────────────────
/** 讀出完整自學字典(分類 key → 詞 → 權重)。 */
export const getLearnedDict = (): LearnedMap => {
  return loadLearned()
}
/** 刪除某分類下學過的一個詞(學錯可修)。 */
export const removeLearnedTerm = (typeKey: string, term: string) => {
  const m = loadLearned()
  if (m[typeKey]) {
    delete m[typeKey][term]
    if (Object.keys(m[typeKey]).length === 0) delete m[typeKey]
    saveLearned(m)
  }
}
/** 清空某分類的所有自學詞。 */
export const removeLearnedType = (typeKey: string) => {
  const m = loadLearned()
  delete m[typeKey]
  saveLearned(m)
}
/** 清空整本自學字典。 */
export const clearLearned = () => {
  localStorage.removeItem(LEARNED_KEY)
}

// ── 3. 分類主函式 ──────────────────────────────────────────────────────
export const ruleClassify = (text: string, categories: CategoryLike[]): RuleClassification => {
  const raw = text.trim()
  let t = raw.toLowerCase()
  let domainScope: string | null = null
  let reason: string | null = null

  // (1) URL → 網域對照
  const urlMatch = /https?:\/\/\S+/.exec(raw)
  if (urlMatch) {
    let host = ''
    try {
      host = new URL(urlMatch[0]).hostname.replace(/^www\./, '')
    } catch {
      /* noop */
    }

    // Google Maps:地點名進評分文字,不鎖大類別(地點可能是美食或旅遊)。
    if (MAPS_HOST.test(urlMatch[0]) || MAPS_HOST.test(host)) {
      const place = extractMapsPlace(urlMatch[0])
      if (place) t += ` ${place.toLowerCase()}`
      reason = `Google Maps${place ? `:${place}` : ''}`
    } else {
      const rule = DOMAIN_RULES.find((r) => r.host.test(host))
      if (rule) {
        const inDomain = categories.filter((c) => c.domain === rule.domain)
        const hinted = rule.nameHint
          ? inDomain.find((c) => c.name.toLowerCase().includes(rule.nameHint!))
          : undefined
        if (hinted) {
          return { type: hinted.key, confidence: 0.9, reason: `網域 ${host}` }
        }
        if (inDomain.length) {
          // 大類別確定、子分類不確定 → 圈定範圍給關鍵字層,保底第一個子分類。
          domainScope = rule.domain
          reason = `網域 ${host} → ${rule.domain}`
        }
      }
    }
  }

  // (2) 關鍵字加權(靜態 + 自學 + 分類名)
  const learned = loadLearned()
  const scope = domainScope ? categories.filter((c) => c.domain === domainScope) : categories
  let best: { key: string; score: number; hits: string[] } | null = null

  for (const c of scope) {
    let score = 0
    const hits: string[] = []
    if (t.includes(c.name.toLowerCase())) {
      score += 3
      hits.push(c.name)
    }
    if (t.includes(c.domain.toLowerCase())) score += 1
    for (const w of KEYWORDS[c.key] ?? []) {
      if (t.includes(w)) {
        score += 2
        hits.push(w)
      }
    }
    for (const [term, weight] of Object.entries(learned[c.key] ?? {})) {
      if (t.includes(term)) {
        // Hostname 詞吃全額權重(一次學會);一般詞折半(需累積)。
        score += term.includes('.') ? Math.min(weight, 6) : Math.min(weight, 6) * 0.5
        hits.push(term)
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { key: c.key, score, hits }
  }

  if (best) {
    const conf = Math.min(0.95, 0.6 + best.score * 0.1)
    const why = `關鍵字 ${best.hits.slice(0, 4).join('、')}`
    return { type: best.key, confidence: conf, reason: reason ? `${reason};${why}` : why }
  }

  // (3) 只有大類別線索 → 保底該大類別第一個子分類,低信心進待確認。
  if (domainScope) {
    const first = categories.find((c) => c.domain === domainScope)
    if (first) return { type: first.key, confidence: 0.6, reason }
  }

  return { type: null, confidence: 0.3, reason: null }
}
