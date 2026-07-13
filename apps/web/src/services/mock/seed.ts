import type { Json, TypeDefinition } from '@inbox/shared-types'
import type { EntryWithTags } from '@/features/entries/types'

/**
 * Seed data used when Supabase is not configured (mock mode).
 * 大類別 = domain, 子類別 = each category (type_definition).
 *
 * NOTE: 景點 / 社群 的部分子類別是建議值(使用者未逐一指定),可自由增刪。
 */

interface MajorSpec {
  domain: string
  color: string
  attrs: Json
  subs: Array<[key: string, name: string, icon: string]>
}

const MAJORS: MajorSpec[] = [
  {
    domain: '國內旅遊',
    color: '#0d9488',
    attrs: {
      地點: 'string',
      類型: 'enum:景點/美食/住宿/交通/購物',
      門票: 'string',
      備註: 'string',
    },
    subs: [
      ['tw_taipei', '台北市', '📍'],
      ['tw_new_taipei', '新北市', '📍'],
      ['tw_taoyuan', '桃園市', '📍'],
      ['tw_taichung', '台中市', '📍'],
      ['tw_tainan', '台南市', '📍'],
      ['tw_kaohsiung', '高雄市', '📍'],
      ['tw_keelung', '基隆市', '📍'],
      ['tw_hsinchu_city', '新竹市', '📍'],
      ['tw_chiayi_city', '嘉義市', '📍'],
      ['tw_hsinchu_county', '新竹縣', '📍'],
      ['tw_miaoli', '苗栗縣', '📍'],
      ['tw_changhua', '彰化縣', '📍'],
      ['tw_nantou', '南投縣', '📍'],
      ['tw_yunlin', '雲林縣', '📍'],
      ['tw_chiayi_county', '嘉義縣', '📍'],
      ['tw_pingtung', '屏東縣', '📍'],
      ['tw_yilan', '宜蘭縣', '📍'],
      ['tw_hualien', '花蓮縣', '📍'],
      ['tw_taitung', '台東縣', '📍'],
      ['tw_penghu', '澎湖縣', '🏝️'],
      ['tw_kinmen', '金門縣', '🏝️'],
      ['tw_lienchiang', '連江縣', '🏝️'],
    ],
  },
  {
    domain: '日本旅遊',
    color: '#dc2626',
    attrs: {
      地點: 'string',
      類型: 'enum:景點/美食/住宿/交通/購物',
      門票: 'string',
      備註: 'string',
    },
    subs: [
      ['jp_tokyo', '東京', '🗼'],
      ['jp_osaka', '大阪', '🏯'],
      ['jp_kyoto', '京都', '⛩️'],
      ['jp_fukuoka', '福岡', '🍜'],
      ['jp_hokkaido', '北海道', '❄️'],
      ['jp_kyushu', '九州', '♨️'],
      ['jp_nagoya', '名古屋', '🏯'],
      ['jp_okinawa', '沖繩', '🏝️'],
    ],
  },
  {
    domain: '美食',
    color: '#ea580c',
    attrs: {
      城市: 'string',
      地址: 'string',
      價位: 'enum:$/$$/$$$',
      營業時間: 'string',
      推薦品項: 'string',
    },
    subs: [
      ['food_cafe', '咖啡廳', '☕'],
      ['food_cat_cafe', '貓咪咖啡廳', '🐱'],
      ['food_brunch', '早午餐', '🍳'],
      ['food_izakaya', '居酒屋', '🍶'],
      ['food_italian', '義式料理', '🍝'],
      ['food_japanese', '日式料理', '🍣'],
      ['food_omakase', '無菜單', '🍱'],
      ['food_buffet', 'buffet', '🍽️'],
      ['food_dessert', '甜點店', '🍰'],
      ['food_ice', '冰品', '🍧'],
      ['food_drinks', '飲料店', '🧋'],
      ['food_western', '西餐', '🥩'],
      ['food_chinese', '中式料理', '🥟'],
    ],
  },
  {
    domain: '學習',
    color: '#2563eb',
    attrs: { 難度: 'enum:入門/中階/進階', 資源連結: 'string', 筆記: 'string' },
    subs: [
      ['learn_ai', 'AI 技能', '🤖'],
      ['learn_frontend', '前端軟體技術', '🎨'],
      ['learn_backend', '後端軟體技術', '⚙️'],
      ['learn_database', '資料庫技能', '🗄️'],
      ['learn_uiux', 'UIUX', '📐'],
      ['learn_photoshop', 'Photoshop', '🖌️'],
      ['learn_illustrator', 'Illustrator', '✒️'],
    ],
  },
  {
    domain: '求職',
    color: '#7c3aed',
    attrs: { 適用階段: 'string', 重點: 'string' },
    subs: [
      ['job_interview', '面試技巧', '🗣️'],
      ['job_resume', '履歷撰寫', '📄'],
    ],
  },
  {
    domain: '攝影',
    color: '#e11d48',
    attrs: { 器材: 'string', 難度: 'enum:入門/中階/進階', 範例連結: 'string' },
    subs: [
      ['photo_lighting', '打光技巧', '💡'],
      ['photo_camera', '相機挑選', '📷'],
      ['photo_technique', '攝影技巧', '📸'],
      ['photo_lens', '鏡頭挑選', '🔭'],
    ],
  },
  {
    domain: '社群',
    color: '#db2777',
    attrs: { 平台: 'string', 類型: 'string', 範例連結: 'string' },
    subs: [
      ['social_ig_copy', 'IG 文案撰寫', '✍️'],
      ['social_ig_growth', 'IG 經營技巧', '📈'],
      ['social_shortvideo', '短影音製作', '🎬'],
      ['social_threads', 'Threads 經營', '🧵'],
      ['social_youtube', 'YouTube 經營', '▶️'],
      ['social_hashtag', 'Hashtag 策略', '#️⃣'],
      ['social_visual', '社群視覺設計', '🖼️'],
    ],
  },
]

// Display order of 大類別(國內旅遊 最後、日本旅遊 在其上)。
const DOMAIN_ORDER = ['美食', '學習', '求職', '攝影', '社群', '日本旅遊', '國內旅遊']

export const seedCategories = (): TypeDefinition[] => {
  const out: TypeDefinition[] = []
  let order = 0
  const majors = [...MAJORS].sort(
    (a, b) => DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain),
  )
  for (const major of majors) {
    for (const [key, name, icon] of major.subs) {
      order += 10
      out.push({
        key,
        name,
        domain: major.domain,
        description: `${major.domain}－${name}`,
        attrs_schema: major.attrs,
        icon,
        color: major.color,
        default_view: 'card',
        status: 'active',
        created_at: new Date().toISOString(),
        // sort_order is a DB column not declared on TypeDefinition; carry it anyway.
        sort_order: order,
      } as TypeDefinition)
    }
  }
  return out
}

let idc = 0
const makeEntry = (
  type: string,
  title: string,
  summary: string,
  attrs: Record<string, unknown>,
  tags: string[],
  status: 'filed' | 'pending_review' = 'filed',
): EntryWithTags => {
  idc += 1
  const now = new Date(Date.now() - idc * 3600_000).toISOString()
  return {
    id: `mock-${idc}`,
    user_id: 'mock',
    type,
    title,
    summary,
    content: summary,
    source_url: null,
    attrs: attrs as Json,
    confidence: status === 'filed' ? 0.92 : 0.6,
    status,
    sort_order: idc * 10,
    closed: false,
    created_at: now,
    updated_at: now,
    tags,
  }
}

export const seedEntries = (): EntryWithTags[] => {
  return [
    makeEntry('food_cafe', '興波咖啡 Simple Kaffa', '世界冠軍咖啡師的店,手沖與甜點都強', { 城市: '台北', 價位: '$$', 推薦品項: '手沖耶加雪菲' }, ['咖啡', '台北', '手沖']),
    makeEntry('food_cafe', '學校咖啡館', '老屋改建的安靜咖啡廳,適合工作', { 城市: '台北', 價位: '$$' }, ['咖啡', '不限時']),
    makeEntry('food_cat_cafe', '小貓花園', '可以擼貓的咖啡廳,貓咪親人', { 城市: '台北', 價位: '$$' }, ['貓', '療癒']),
    makeEntry('food_brunch', 'Fifty Fifty', '份量大的早午餐,班尼迪克蛋必點', { 城市: '高雄', 價位: '$$', 推薦品項: '班尼迪克蛋' }, ['早午餐', '高雄']),
    makeEntry('food_japanese', '鮨天本', '高級無菜單日料,需提前訂位', { 城市: '台北', 價位: '$$$' }, ['壽司', '訂位']),
    makeEntry('food_drinks', '龜記茶飲', '手搖飲,楊枝甘露好喝', { 城市: '台中', 價位: '$', 推薦品項: '楊枝甘露' }, ['手搖', '台中']),
    makeEntry('tw_taipei', '象山步道', '看台北 101 夜景的熱門步道', { 地點: '信義區', 類型: '景點', 門票: '免費' }, ['夜景', '爬山']),
    makeEntry('tw_tainan', '台南孔廟', '全台首學,古色古香', { 地點: '中西區', 類型: '景點', 門票: 'NT$50' }, ['古蹟', '台南']),
    makeEntry('jp_osaka', '道頓堀 一蘭拉麵', '大阪必吃拉麵,24 小時營業', { 地點: '道頓堀', 類型: '美食' }, ['拉麵', '大阪']),
    makeEntry('learn_ai', 'MCP 是什麼', 'Model Context Protocol,讓 LLM 接工具的標準', { 難度: '中階', 資源連結: 'https://modelcontextprotocol.io' }, ['MCP', 'AI', 'agent']),
    makeEntry('learn_ai', 'Prompt caching 省 token', 'Anthropic prompt caching 用法與計費', { 難度: '中階' }, ['claude', 'prompt']),
    makeEntry('learn_frontend', 'Vue 3 defineModel', '3.4+ 的雙向綁定語法糖', { 難度: '入門' }, ['vue', '前端']),
    makeEntry('learn_database', 'pgvector 入門', 'Postgres 向量搜尋擴充', { 難度: '中階' }, ['postgres', '向量']),
    makeEntry('job_interview', 'STAR 面試法', '用 Situation/Task/Action/Result 回答行為題', { 適用階段: '面試', 重點: '結構化回答' }, ['面試']),
    makeEntry('job_resume', 'ATS 履歷關鍵字', '讓履歷通過 ATS 篩選的關鍵字技巧', { 重點: '關鍵字對齊 JD' }, ['履歷', 'ATS']),
    makeEntry('photo_lighting', '三點打光', '主光/補光/背光的基本佈局', { 難度: '入門', 器材: '常亮燈 x2' }, ['打光', '棚拍']),
    makeEntry('photo_lens', '35mm vs 50mm', '人文與人像的鏡頭選擇', { 難度: '入門' }, ['鏡頭']),
    makeEntry('social_ig_copy', '鉤子開頭公式', '前三行決定停留,用痛點開場', { 平台: 'IG', 類型: '文案' }, ['IG', '文案']),
    makeEntry('social_shortvideo', 'Reels 黃金三秒', '短影音前三秒留人技巧', { 平台: 'IG', 類型: '短影音' }, ['reels', '短影音'], 'pending_review'),
  ].filter((e) => e.title) // drop the placeholder
}
