// supabase/functions/extract/index.ts
//
// URL 擷取:貼連結 → server 端抓網頁 metadata(og:title/description、
// YouTube oEmbed、Google Maps 店名),回傳給前端做標題/摘要/分類評分。
// 瀏覽器因 CORS 做不到,所以必須在 Edge Function(docs/ai-strategy.md)。
//
// SSRF 防護(docs/proposals/link-meta-no-ai.md H1):僅 http(s):80/443、
// IP 各種編碼正規化 + 保留段黑名單(ssrf.ts 純函式)、Deno.resolveDns
// 分族解析(單族 NODATA 屬正常)且緊貼 fetch、redirect 手動展開逐跳
// 重驗(≤3)、1MB 上限、僅 text/html。
// 殘餘風險(明寫):DNS rebinding TOCTOU——Deno fetch 無 connect-to-IP
// pinning,「解析緊貼 fetch + 每跳重驗」為 edge runtime 可達上限。
//
// Deadline(H2):整體 6s 預算單一 AbortSignal 貫穿所有 fetch;
// expand 走到 2xx 直接回傳該 Response 重用,不重複 GET。
//
// Deploy: supabase functions deploy extract(或 Dashboard → Edge Functions 貼上)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { dnsCheck, ipBlocked, portAllowed } from './ssrf.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const MAX_BYTES = 1_048_576
const TOTAL_BUDGET = 6000
const MAX_REDIRECTS = 3

/** SSRF 靜態驗證:協定/帳密/port allowlist/hostname 字面(含 IP 各種編碼)。 */
function validateUrl(raw: string): URL | string {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return '網址格式不正確'
  }
  if (!/^https?:$/.test(u.protocol)) return '只支援 http/https 網址'
  if (u.username || u.password) return '不支援夾帶帳密的網址'
  if (!portAllowed(u)) return '不支援自訂連接埠的網址'
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return '不支援內部網址'
  // IP 直連(任何編碼):黑名單段一律擋;非黑名單公網 IP 直連也不常見於
  // 收藏連結,保守起見僅放行網域(與現行行為一致:IP literal 全擋)
  if (ipBlocked(h) !== null) return '不支援 IP 直連的網址'
  return u
}

/** dnsCheck 的 resolver(緊貼 fetch 前呼叫,縮小 rebinding 時窗)。 */
const denoResolver = (host: string, type: 'A' | 'AAAA') => Deno.resolveDns(host, type)

/**
 * 手動展開 redirect,每一跳「靜態驗證 + DNS 檢查」後才 fetch(短網址 → 真網址)。
 * 走到 2xx 直接回傳該 Response 供後續重用(不重複 GET,H2)。
 */
async function expand(url: URL, signal: AbortSignal): Promise<{ url: URL; res: Response } | string> {
  let cur = url
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const dnsErr = await dnsCheck(cur.hostname, denoResolver)
    if (dnsErr) return dnsErr
    const res = await fetch(cur, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'user-agent': 'KnowledgeInboxBot/1.0', accept: 'text/html' },
      signal,
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      await res.body?.cancel()
      if (!loc || i === MAX_REDIRECTS) return '轉址次數過多或缺少目的地'
      const next = validateUrl(new URL(loc, cur).href)
      if (typeof next === 'string') return next
      cur = next
      continue
    }
    return { url: cur, res }
  }
  return '轉址次數過多或缺少目的地'
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .trim()
}
function metaContent(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    'i',
  )
  const m = re.exec(html)
  return m ? decodeEntities(m[1] ?? m[2]) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: '不支援的請求方式' }, 405)

  // 驗證呼叫者(登入使用者才可用,避免被當免費代理)。
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return json({ error: '請先登入' }, 401)

  let url: unknown
  try {
    ;({ url } = await req.json())
  } catch {
    return json({ error: '請求格式不正確' }, 400)
  }
  if (typeof url !== 'string' || url.length > 2048) return json({ error: '網址格式不正確' }, 400)

  const parsed = validateUrl(url)
  if (typeof parsed === 'string') return json({ error: parsed }, 400)

  // 整體 6s 預算:單一 signal 貫穿展開與所有後續 fetch(H2)。
  const signal = AbortSignal.timeout(TOTAL_BUDGET)

  const isYoutube = (h: string) => /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h.replace(/^www\./, ''))
  const oembed = async (target: URL): Promise<Response> => {
    const o = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(target.href)}&format=json`,
      { signal },
    )
    if (o.ok) {
      const d = await o.json()
      return json({ title: d.title ?? null, description: d.author_name ? `YouTube · ${d.author_name}` : null, finalUrl: target.href, source: 'youtube' })
    }
    return json({ title: null, description: null, finalUrl: target.href, source: 'youtube' })
  }

  try {
    // 1) YouTube 直連:oEmbed 直接吃原始 watch/youtu.be URL,完全不抓頁面
    //    ——機房 IP 抓 youtube 頁面會被重導到 google.com/sorry 機器人牆,
    //    走 expand 反而把 oEmbed 分支繞掉(2026-07-16 dev 實測)。
    if (isYoutube(parsed.hostname)) return await oembed(parsed)

    // 2) 展開短網址(maps.app.goo.gl、bit.ly…);2xx Response 直接重用
    const expanded = await expand(parsed, signal)
    if (typeof expanded === 'string') return json({ error: expanded }, 400)
    const { url: finalUrl, res } = expanded

    const host = finalUrl.hostname.replace(/^www\./, '')

    // 2b) 短網址展開後才發現是 YouTube(bit.ly → youtube)
    if (isYoutube(host)) {
      await res.body?.cancel()
      return await oembed(finalUrl)
    }

    // 2c) 被機器人驗證牆攔下(google /sorry/ 等):沒有可用 metadata,
    //     回錯誤讓前端 fail-soft 照原樣存,不要拿驗證牆的 title 冒充
    if (/(^|\.)google\.[a-z.]+$/.test(host) && finalUrl.pathname.startsWith('/sorry')) {
      await res.body?.cancel()
      return json({ error: '對方網站擋了機器人,無法擷取' }, 502)
    }

    // 3) Google Maps:店名就在展開後的 URL path(不需要 body)
    const place = /\/maps\/place\/([^/@?]+)/.exec(finalUrl.href)
    if (place) {
      await res.body?.cancel()
      return json({ title: decodeURIComponent(place[1]).replace(/\+/g, ' '), description: null, finalUrl: finalUrl.href, source: 'maps' })
    }

    // 4) 一般網頁:重用 expand 的 Response,不再 GET 第二次(H2)
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('text/html') && !type.includes('text/plain')) {
      await res.body?.cancel()
      return json({ error: '這個網址不是網頁,無法擷取' }, 422)
    }
    const buf = await res.arrayBuffer()
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, MAX_BYTES))

    const title =
      metaContent(html, 'og:title') ??
      (/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ? decodeEntities(/<title[^>]*>([^<]+)<\/title>/i.exec(html)![1]) : null)
    const description = metaContent(html, 'og:description') ?? metaContent(html, 'description')

    return json({ title, description, finalUrl: finalUrl.href, source: 'og' })
  } catch (e) {
    console.error('[extract]', e)
    return json({ error: '擷取失敗,對方網站可能無回應或擋了機器人' }, 502)
  }
})
