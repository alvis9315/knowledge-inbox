#!/usr/bin/env node
/**
 * 把 supabase/migrations/ 依編號串接成一份可整貼 SQL Editor 的彙總檔。
 * 用途:全新環境一次建庫(現有環境請只貼「新編號」的個別檔案,不要重貼整份)。
 *
 * 用法:node scripts/build-all-migrations.mjs
 * 每次新增 migration 後跑一次,彙總檔與 migrations 同 commit 進版。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'supabase', 'migrations')
const out = join(root, 'supabase', 'ALL_MIGRATIONS_paste_into_sql_editor.sql')

const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()
if (files.length === 0) {
  console.error('找不到任何 migration 檔')
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
const range = `${files[0].slice(0, 4)}–${files[files.length - 1].slice(0, 4)}`
let sql = `-- Knowledge Inbox — 合併 migrations ${range}(由 scripts/build-all-migrations.mjs 產生於 ${today})
-- 用途:全新 Supabase 專案一次建庫。現有專案只貼新編號的個別檔案,不要重貼整份。

`
for (const f of files) {
  sql += `-- ═══════════ supabase/migrations/${f} ═══════════\n`
  sql += readFileSync(join(dir, f), 'utf-8').trimEnd() + '\n\n'
}
writeFileSync(out, sql)
console.log(`已產生 ${out}(${files.length} 個檔案:${files.join(', ')})`)
