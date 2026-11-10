#!/usr/bin/env node
// 図解解説（src/data/doboku1/explains/*.ts）を検証し、通ったものだけ dbk_questions.explain の UPDATE SQL を書き出す
// （docs/design/doboku1-ichiji.md §6.5）。本文・正答には触れない。DB への実行は Supabase MCP の execute_sql（CLAUDE.md）。
//
// 使い方（作業用ファイルはリポジトリの外に置く）:
//   1. 対象行を DB から JSON で書き出す（execute_sql の結果を保存）:
//        SELECT id, kind, direction, correct, choices FROM denken3.dbk_questions WHERE user_id = '<uuid>' AND year = 'R08';
//   2. node scripts/doboku1/explain-sql.mjs --year R08 --rows $W/r08_rows.json \
//        --explains src/data/doboku1/explains/r08_kiso.ts,src/data/doboku1/explains/r08_dokou.ts --user <uuid> --sql $W/r08_explain
//
//   --year <R08>          年度（キー 'A01' を 'D1_R08_A_01' に読み替える）
//   --rows <path>         DB 行の JSON 配列（id・kind・direction・correct・choices）
//   --explains <a,b,...>  解説モジュール（Explains を export する .ts）。カンマ区切り
//   --user <uuid>         保存先の user_id
//   --sql <path>          UPDATE SQL の書き出し先（.sql）
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fail, parseArgs, readJson } from '../license/lib.mjs'
import { explainProblems } from '../../src/lib/doboku1/explain.ts'
import { toExplainUpdateSql } from '../../src/lib/doboku1/sql.ts'

const HELP = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')
  .filter(l => l.startsWith('//   ')).map(l => l.slice(3)).join('\n')
const opts = parseArgs(process.argv.slice(2), {
  '--year': 'year', '--rows': 'rows', '--explains': 'explains', '--user': 'user', '--sql': 'sql',
}, HELP)
for (const k of ['year', 'rows', 'explains', 'user', 'sql']) if (!opts[k]) fail(`--${k} が必要です`)

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
if (resolve(opts.sql).startsWith(REPO + '/')) fail(`--sql をリポジトリ配下に書き出せません: ${opts.sql}`)

const rows = new Map(readJson(opts.rows).map(r => [r.id, r]))
const merged = {}
for (const p of opts.explains.split(',')) {
  const mod = await import(pathToFileURL(resolve(p)).href)
  const sets = Object.values(mod).filter(v => v && typeof v === 'object')
  if (sets.length === 0) fail(`${p}: Explains の export がない`)
  for (const set of sets) for (const [k, v] of Object.entries(set)) {
    if (merged[k]) fail(`${k}: 解説が重複（${p}）`)
    merged[k] = v
  }
}

const errors = []
const items = []
for (const [k, { explain, verified = false }] of Object.entries(merged)) {
  const m = k.match(/^([AB])(\d{2})$/)
  if (!m) { errors.push(`${k}: キーの形が違う（'A01' の形）`); continue }
  const id = `D1_${opts.year}_${m[1]}_${m[2]}`
  const row = rows.get(id)
  if (!row) { errors.push(`${k}: ${id} が --rows にない`); continue }
  for (const e of explainProblems(explain, row)) errors.push(`${k}: ${e}`)
  items.push({ id, explain, verified })
}
console.log(`${opts.year}: 解説 ${items.length}問（${Object.keys(merged).join(' ')}）`)
if (errors.length) { for (const e of errors) console.error(`  ✗ ${e}`); fail(`検証ゲート不合格（${errors.length}件）。SQLは書き出しません`) }
console.log('  ✓ 検証ゲート合格')
writeFileSync(opts.sql, toExplainUpdateSql(items, opts.user))
console.log(`  → ${opts.sql}`)
