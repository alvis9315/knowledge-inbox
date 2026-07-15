import { describe, expect, it } from 'vitest'
import {
  dnsCheck,
  ipBlocked,
  ipv4Blocked,
  parseIpv4,
  parseIpv6,
  portAllowed,
} from '../../../supabase/functions/extract/ssrf'

// 提案 H1 驗收:port allowlist、IP 各種編碼正規化、保留段黑名單、
// DNS 分族解析(單族 NODATA 通過 / 多筆其中一筆內網擋)。

describe('portAllowed(port allowlist)', () => {
  it('協定預設 port 通過(明寫預設會被 URL 正規化為空)', () => {
    expect(portAllowed(new URL('https://example.com/a'))).toBe(true)
    expect(portAllowed(new URL('http://example.com:80/a'))).toBe(true)
    expect(portAllowed(new URL('https://example.com:443/a'))).toBe(true)
  })
  it('非標準 port 一律擋(http:8080 / https:8443 / redirect 目的地同規則)', () => {
    expect(portAllowed(new URL('http://example.com:8080/'))).toBe(false)
    expect(portAllowed(new URL('https://example.com:8443/'))).toBe(false)
    expect(portAllowed(new URL('http://1.2.3.4:6379/'))).toBe(false)
  })
})

describe('parseIpv4(非標準編碼正規化)', () => {
  it('十進位整數 → 127.0.0.1', () => expect(parseIpv4('2130706433')).toBe(0x7f000001))
  it('十六進位 → 127.0.0.1', () => expect(parseIpv4('0x7f000001')).toBe(0x7f000001))
  it('八進位 → 127.0.0.1', () => expect(parseIpv4('017700000001')).toBe(0x7f000001))
  it('點分十進位', () => expect(parseIpv4('10.0.0.1')).toBe(0x0a000001))
  it('二段式(127.1)', () => expect(parseIpv4('127.1')).toBe(0x7f000001))
  it('網域不是 IP', () => {
    expect(parseIpv4('example.com')).toBeNull()
    expect(parseIpv4('ace.face')).toBeNull() // 純 hex 字母但無 0x 前綴
  })
})

describe('ipv4Blocked / ipBlocked(保留段黑名單)', () => {
  const blocked = [
    '127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '172.31.255.255',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '240.0.0.1',
    '198.18.0.1', '192.0.2.1', '198.51.100.7', '203.0.113.9',
  ]
  it.each(blocked)('%s → 擋', (ip) => expect(ipBlocked(ip)).toBe(true))

  const ok = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '198.20.0.1']
  it.each(ok)('%s → 放行', (ip) => expect(ipBlocked(ip)).toBe(false))

  it('各種編碼的 127.0.0.1 全擋', () => {
    expect(ipBlocked('2130706433')).toBe(true)
    expect(ipBlocked('0x7f000001')).toBe(true)
    expect(ipBlocked('017700000001')).toBe(true)
    expect(ipBlocked('127.1')).toBe(true)
  })
  it('網域回 null(交由 DNS 層)', () => expect(ipBlocked('example.com')).toBeNull())
})

describe('parseIpv6 / ipBlocked(IPv6 與 v4-mapped)', () => {
  it('loopback 與 unspecified 擋', () => {
    expect(ipBlocked('::1')).toBe(true)
    expect(ipBlocked('::')).toBe(true)
  })
  it('v4-mapped 拆出內嵌 v4 重驗', () => {
    expect(ipBlocked('::ffff:127.0.0.1')).toBe(true)
    expect(ipBlocked('::ffff:10.0.0.1')).toBe(true)
    expect(ipBlocked('::ffff:8.8.8.8')).toBe(false)
  })
  it('ULA / link-local / doc / multicast 擋', () => {
    expect(ipBlocked('fd00::1')).toBe(true)
    expect(ipBlocked('fe80::1')).toBe(true)
    expect(ipBlocked('2001:db8::1')).toBe(true)
    expect(ipBlocked('ff02::1')).toBe(true)
  })
  it('公網 v6 放行;壞字串直接擋', () => {
    expect(ipBlocked('2606:4700::1111')).toBe(false)
    expect(ipBlocked('::::')).toBe(true)
    expect(parseIpv6('1:2:3:4:5:6:7:8:9')).toBeNull()
  })
})

describe('dnsCheck(分族解析契約)', () => {
  const resolver = (a: string[] | Error, aaaa: string[] | Error) =>
    (_h: string, t: 'A' | 'AAAA') => {
      const v = t === 'A' ? a : aaaa
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
    }

  it('IPv4-only(AAAA NODATA)通過', async () => {
    expect(await dnsCheck('x.com', resolver(['8.8.8.8'], new Error('NODATA')))).toBeNull()
  })
  it('IPv6-only(A NODATA)通過', async () => {
    expect(await dnsCheck('x.com', resolver(new Error('NODATA'), ['2606:4700::1111']))).toBeNull()
  })
  it('兩族皆無位址 → 解析失敗', async () => {
    expect(await dnsCheck('x.com', resolver(new Error('x'), new Error('x')))).toBe('網域無法解析')
    expect(await dnsCheck('x.com', resolver([], []))).toBe('網域無法解析')
  })
  it('多筆其中一筆內網 → 擋(DNS 指內網)', async () => {
    expect(await dnsCheck('x.com', resolver(['8.8.8.8', '10.0.0.1'], []))).toBe('不支援內部網址')
    expect(await dnsCheck('x.com', resolver(['8.8.8.8'], ['::ffff:127.0.0.1']))).toBe('不支援內部網址')
  })
  it('全公網 → 通過', async () => {
    expect(await dnsCheck('x.com', resolver(['8.8.8.8'], ['2606:4700::1111']))).toBeNull()
  })
})
