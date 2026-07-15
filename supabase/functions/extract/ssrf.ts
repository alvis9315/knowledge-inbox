// SSRF 純函式層(不碰 Deno API,apps/web 的 vitest 可直接 import 驗證)。
// 規格:docs/proposals/link-meta-no-ai.md H1;要求來源:docs/security §3.2。
//
// 職責:port allowlist、hostname 的各種 IP 編碼正規化、IP 保留段黑名單。
// DNS 解析(Deno.resolveDns)的編排在 index.ts,不在本檔。

/** effective port 僅允許協定預設(WHATWG URL 會把明寫的預設 port 正規化為空)。 */
export const portAllowed = (u: URL): boolean => u.port === ''

/**
 * hostname → IPv4 uint32(涵蓋非標準編碼)。非 IP 形式回 null。
 * WHATWG URL 通常已把 0x7f000001 / 2130706433 / 017700000001 正規化成
 * 點分十進位,這裡自行解析一次做縱深防禦(不同 runtime 行為不賭)。
 */
export const parseIpv4 = (host: string): number | null => {
  if (!host || /[^0-9a-fx.]/i.test(host)) return null
  const parts = host.split('.')
  if (parts.length > 4 || parts.some((p) => p === '')) return null
  const nums: number[] = []
  for (const p of parts) {
    let n: number
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16)
    else if (/^0[0-7]*$/.test(p)) n = parseInt(p, 8)
    else if (/^[1-9][0-9]*$/.test(p)) n = parseInt(p, 10)
    else return null
    if (!Number.isFinite(n) || n < 0) return null
    nums.push(n)
  }
  // 尾段吃剩餘位元組:1 段=32bit、2 段=8+24、3 段=8+8+16、4 段=8×4
  const last = nums[nums.length - 1]
  const maxLast = 2 ** (8 * (5 - nums.length))
  if (last >= maxLast) return null
  if (nums.slice(0, -1).some((n) => n > 255)) return null
  let prefix = 0
  for (let i = 0; i < nums.length - 1; i++) prefix = prefix * 256 + nums[i]
  return (prefix * maxLast + last) >>> 0
}

const inCidr4 = (ip: number, base: string, bits: number): boolean => {
  const b = base.split('.').reduce((acc, p) => acc * 256 + Number(p), 0) >>> 0
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return ((ip & mask) >>> 0) === ((b & mask) >>> 0)
}

/** IPv4 保留段黑名單(提案 H1 完整清單)。 */
export const ipv4Blocked = (ip: number): boolean =>
  inCidr4(ip, '0.0.0.0', 8) ||
  inCidr4(ip, '10.0.0.0', 8) ||
  inCidr4(ip, '100.64.0.0', 10) ||
  inCidr4(ip, '127.0.0.0', 8) ||
  inCidr4(ip, '169.254.0.0', 16) ||
  inCidr4(ip, '172.16.0.0', 12) ||
  inCidr4(ip, '192.0.0.0', 24) ||
  inCidr4(ip, '192.0.2.0', 24) ||
  inCidr4(ip, '192.168.0.0', 16) ||
  inCidr4(ip, '198.18.0.0', 15) ||
  inCidr4(ip, '198.51.100.0', 24) ||
  inCidr4(ip, '203.0.113.0', 24) ||
  inCidr4(ip, '224.0.0.0', 4) ||
  inCidr4(ip, '240.0.0.0', 4)

/** IPv6 字串 → 8 個 16-bit group;失敗回 null。支援 `::` 縮寫與內嵌 v4。 */
export const parseIpv6 = (host: string): number[] | null => {
  let h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (!/^[0-9a-f:.]+$/.test(h)) return null
  // 內嵌 v4(如 ::ffff:127.0.0.1)→ 換成兩個 group
  const v4m = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h)
  if (v4m) {
    const v4 = parseIpv4(v4m[2])
    if (v4 === null) return null
    h = v4m[1] + ((v4 >>> 16).toString(16) || '0') + ':' + (v4 & 0xffff).toString(16)
  }
  const dbl = h.split('::')
  if (dbl.length > 2) return null
  const head = dbl[0] ? dbl[0].split(':') : []
  const tail = dbl.length === 2 && dbl[1] ? dbl[1].split(':') : []
  if (dbl.length === 1 && head.length !== 8) return null
  if (head.length + tail.length > 8) return null
  const groups = [
    ...head.map((g) => parseInt(g || '0', 16)),
    ...Array(8 - head.length - tail.length).fill(0),
    ...tail.map((g) => parseInt(g || '0', 16)),
  ]
  if (groups.some((g) => !Number.isFinite(g) || g < 0 || g > 0xffff)) return null
  return groups
}

/** IPv6 保留段黑名單;v4-mapped(::ffff:0:0/96)拆出內嵌 v4 重驗。 */
export const ipv6Blocked = (g: number[]): boolean => {
  const allZeroTo = (n: number) => g.slice(0, n).every((x) => x === 0)
  // :: 與 ::1
  if (allZeroTo(7) && (g[7] === 0 || g[7] === 1)) return true
  // ::ffff:0:0/96 → 內嵌 v4
  if (allZeroTo(5) && g[5] === 0xffff) return ipv4Blocked(((g[6] << 16) | g[7]) >>> 0)
  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // 2001:db8::/32
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8
  return false
}

/** 任意 IP 字串(v4 各種編碼 / v6)是否落在黑名單。非 IP 回 null 交由 DNS 層。 */
export const ipBlocked = (host: string): boolean | null => {
  const v4 = parseIpv4(host)
  if (v4 !== null) return ipv4Blocked(v4)
  if (host.includes(':') || host.startsWith('[')) {
    const v6 = parseIpv6(host)
    return v6 ? ipv6Blocked(v6) : true // 形似 v6 但解析失敗 → 直接擋
  }
  return null
}

export type DnsResolver = (host: string, type: 'A' | 'AAAA') => Promise<string[]>

/**
 * DNS 分族解析 + 黑名單(提案 H1):A/AAAA 分開解析,單族 NODATA/NotFound
 * 屬正常(IPv4-only / IPv6-only 皆合法);兩族皆無位址才算解析失敗。
 * 所有取得的 IP 任一落黑名單即擋。resolver 注入以便單元測試
 * (index.ts 傳 Deno.resolveDns)。回傳錯誤訊息或 null(通過)。
 */
export const dnsCheck = async (host: string, resolve: DnsResolver): Promise<string | null> => {
  const one = async (type: 'A' | 'AAAA'): Promise<string[]> => {
    try {
      return await resolve(host, type)
    } catch {
      return [] // 該族 NODATA / NXDOMAIN:視為無位址,不是整體失敗
    }
  }
  const [a, aaaa] = await Promise.all([one('A'), one('AAAA')])
  const ips = [...a, ...aaaa]
  if (ips.length === 0) return '網域無法解析'
  for (const ip of ips) {
    if (ipBlocked(ip) !== false) return '不支援內部網址'
  }
  return null
}
