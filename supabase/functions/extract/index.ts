// supabase/functions/extract/index.ts
//
// URL 擷取:貼連結 → server 端抓網頁 metadata(og:title/description、
// YouTube oEmbed、Google Maps 店名),回傳給前端做標題/摘要/分類評分。
// 瀏覽器因 CORS 做不到,所以必須在 Edge Function(docs/ai-strategy.md)。
//
// SSRF 防護(docs/security Phase 2b lite):僅 http(s)、擋 IP 直連/內網
// hostname、redirect 手動展開逐跳重驗(≤3)、8s 逾時、1MB 上限、
// 僅 text/html。完整 DNS pinning 留待 Phase 2b full。
//
// Deploy: supabase functions deploy extract(或 Dashboard → Edge Functions 貼上)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const MAX_BYTES = 1_048_576
const FETCH_TIMEOUT = 8000
const MAX_REDIRECTS = 3

/** SSRF:擋 IP 直連、內網/保留 hostname、非 http(s)、帳密夾帶。 */
function validateUrl(raw: string): URL | string {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return '網址格式不正確'
  }
  if (!/^https?:$/.test(u.protocol)) return '只支援 http/https 網址'
  if (u.username || u.password) return '不支援夾帶帳密的網址'
  const h = u.hostname.toLowerCase()
  if (
    h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') // IPv4 literal / IPv6
  ) return '不支援內部網址'
  return u
}

/** 手動展開 redirect,每一跳重新驗證(短網址 → 真網址)。 */
async function expand(url: URL): Promise<URL | string> {
  let cur = url
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await fetch(cur, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'user-agent': 'KnowledgeInboxBot/1.0', accept: 'text/html' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      await res.body?.cancel()
      if (!loc) return cur
      const next = validateUrl(new URL(loc, cur).href)
      if (typeof next === 'string') return next
      cur = next
      continue
    }
    await res.body?.cancel()
    return cur
  }
  return cur
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

  try {
    // 1) 展開短網址(maps.app.goo.gl、bit.ly…)
    const finalUrl = await expand(parsed)
    if (typeof finalUrl === 'string') return json({ error: finalUrl }, 400)

    const host = finalUrl.hostname.replace(/^www\./, '')

    // 2) YouTube:官方 oEmbed(免費無 key)
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) {
      const o = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(finalUrl.href)}&format=json`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT) },
      )
      if (o.ok) {
        const d = await o.json()
        return json({ title: d.title ?? null, description: d.author_name ? `YouTube · ${d.author_name}` : null, finalUrl: finalUrl.href, source: 'youtube' })
      }
    }

    // 3) Google Maps:店名就在展開後的 URL path
    const place = /\/maps\/place\/([^/@?]+)/.exec(finalUrl.href)
    if (place) {
      return json({ title: decodeURIComponent(place[1]).replace(/\+/g, ' '), description: null, finalUrl: finalUrl.href, source: 'maps' })
    }

    // 4) 一般網頁:og:title / og:description / <title>
    const res = await fetch(finalUrl, {
      headers: { 'user-agent': 'KnowledgeInboxBot/1.0', accept: 'text/html' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    })
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
