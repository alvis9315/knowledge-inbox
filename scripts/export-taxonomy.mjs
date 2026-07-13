#!/usr/bin/env node
/**
 * 一鍵把「雲端分類樹」匯出成 SQL 快照(災難重建/搬家用)。
 *
 * 用法:
 *   1. repo 根目錄 .env 填 SUPABASE_PROJECT_ID 與 SUPABASE_SERVICE_ROLE_KEY
 *      (service_role 只放這裡與伺服器端,絕不進前端/git)
 *   2. node scripts/export-taxonomy.mjs
 *   → 產出 supabase/taxonomy_snapshot.sql(冪等 upsert,可貼 SQL Editor 還原)
 *
 * 心法:雲端 DB 是分類樹的活正本;migration 0007 只是初始種子。
 * 平常在 app 裡增刪分類不需要同步任何檔案——想留快照時才跑這支。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(path) {
  const out = {}
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (m) out[m[1]] = m[2]
    }
  } catch {
    /* no .env */
  }
  return out
}

const env = { ...loadEnv(resolve(root, '.env')), ...process.env }
const projectId = env.SUPABASE_PROJECT_ID
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!projectId || !serviceKey) {
  console.error('缺設定:請在 repo 根目錄 .env 填 SUPABASE_PROJECT_ID 與 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const url = `https://${projectId}.supabase.co/rest/v1/type_definitions` +
  '?select=key,name,domain,description,attrs_schema,icon,color,sort_order&order=sort_order.asc'
const res = await fetch(url, {
  headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
})
if (!res.ok) {
  console.error(`讀取失敗 HTTP ${res.status}:${await res.text()}`)
  process.exit(1)
}
const rows = await res.json()
if (!rows.length) {
  console.error('type_definitions 是空的,不產快照。')
  process.exit(1)
}

const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const values = rows
  .map((r) =>
    `(${q(r.key)}, ${q(r.name)}, ${q(r.domain)}, ${q(r.description)}, ` +
    `${q(JSON.stringify(r.attrs_schema ?? {}))}, ${q(r.icon)}, ${q(r.color)}, ${r.sort_order ?? 0})`,
  )
  .join(',\n')

const sql = `-- taxonomy_snapshot.sql — 由 scripts/export-taxonomy.mjs 產生
-- 產生時間:${new Date().toISOString()};來源:雲端 type_definitions(活正本)
-- 用途:災難重建/搬家時貼進 SQL Editor 還原分類樹。冪等 upsert。

insert into type_definitions (key, name, domain, description, attrs_schema, icon, color, sort_order) values
${values}
on conflict (key) do update set
  name = excluded.name,
  domain = excluded.domain,
  description = excluded.description,
  attrs_schema = excluded.attrs_schema,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order;
`

const out = resolve(root, 'supabase/taxonomy_snapshot.sql')
writeFileSync(out, sql)
console.log(`✅ ${rows.length} 個分類 → supabase/taxonomy_snapshot.sql`)
