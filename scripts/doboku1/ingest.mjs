#!/usr/bin/env node
// 1級土木 第一次検定の公式PDF（抽出テキスト）を構造化し、検証ゲートを通った年度だけ dbk_questions の upsert SQL を書き出す
// （docs/design/doboku1-ichiji.md §5・§6 T2）。DB への実行は Supabase MCP の execute_sql で行う（CLAUDE.md）。
//
// 使い方（作業用ファイルはすべてリポジトリの外に置く）:
//   python3 scripts/doboku1/extract.py R8_A.pdf $W/r08_a.txt
//   python3 scripts/doboku1/extract.py R8_B.pdf $W/r08_b.txt
//   python3 scripts/doboku1/extract.py R8_kaitou.pdf $W/r08_key.txt --plain
//   node scripts/doboku1/ingest.mjs --year R08 --a $W/r08_a.txt --b $W/r08_b.txt --answers $W/r08_key.txt \
//     --overrides $W/r08_overrides.json --explains $W/r08_explains.json --user <uuid> --sql $W/r08
//
//   --year <R08>          年度（src/data/doboku1/categories.ts の YEAR_INDEX にあること）
//   --a / --b <path>      試験問題A/Bの抽出テキスト
//   --answers <path>      正答肢の抽出テキスト（--plain）
//   --overrides <path>    書き起こしの補正（式・図の問。キー 'A01'）
//   --explains <path>     図解解説（キー 'A01'。型は src/lib/doboku1/types.ts の Explain）
//   --dump-json <path>    構造化結果を書き出す（確認用）
//   --sql <prefix>        <prefix>.sql（保存）と <prefix>.check.sql（確認）を書き出す。--user が必要
//   --user <uuid>         保存先の user_id
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fail, parseArgs, readJson } from '../license/lib.mjs'
import { parseAnswerKey, parseQuestions } from '../../src/lib/doboku1/parse.ts'
import { buildYear } from '../../src/lib/doboku1/build.ts'
import { toCheckSql, toUpsertSql } from '../../src/lib/doboku1/sql.ts'
import { yearIndexOf } from '../../src/data/doboku1/categories.ts'

const HELP = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')
  .filter(l => l.startsWith('//   ')).map(l => l.slice(3)).join('\n')
const opts = parseArgs(process.argv.slice(2), {
  '--year': 'year', '--a': 'a', '--b': 'b', '--answers': 'answers', '--overrides': 'overrides',
  '--explains': 'explains', '--dump-json': 'dumpJson', '--sql': 'sql', '--user': 'user',
}, HELP)

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outside = (p, what) => { if (resolve(p).startsWith(REPO + '/')) fail(`${what} をリポジトリ配下に書き出せません（本文をコミットしない）: ${p}`) }
const read = p => { try { return readFileSync(p, 'utf8') } catch (e) { fail(`${p} を読めません: ${e.message}`) } }

for (const k of ['year', 'a', 'b', 'answers']) if (!opts[k]) fail(`--${k} が必要です`)
const idx = yearIndexOf(opts.year)
if (!idx) fail(`年度 ${opts.year} が YEAR_INDEX にありません`)

const parsed = { A: parseQuestions(read(opts.a), 'A'), B: parseQuestions(read(opts.b), 'B') }
const key = parseAnswerKey(read(opts.answers))
const { rows, errors, warnings } = buildYear(idx, parsed, key,
  opts.overrides ? readJson(opts.overrides) : {}, opts.explains ? readJson(opts.explains) : {})

const by = (f) => Object.entries(rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {})).map(([k, v]) => `${k}:${v}`).join(' ')
console.log(`${opts.year}: A ${parsed.A.length}問 / B ${parsed.B.length}問 / 正答 A ${key.A.size}・B ${key.B.size}`)
console.log(`  形式  ${by(r => r.kind)}`)
console.log(`  分野  ${by(r => r.category)}`)
console.log(`  解説  ${rows.filter(r => r.explain).length}問`)
for (const w of warnings) console.log(`  ⚠ ${w}`)
if (opts.dumpJson) { outside(opts.dumpJson, '--dump-json'); writeFileSync(opts.dumpJson, JSON.stringify(rows, null, 1)) }
if (errors.length) { for (const e of errors) console.error(`  ✗ ${e}`); fail(`検証ゲート不合格（${errors.length}件）。保存SQLは書き出しません`) }
console.log('  ✓ 検証ゲート合格')
if (opts.sql) {
  if (!opts.user) fail('--sql には --user が必要です')
  outside(opts.sql, '--sql')
  writeFileSync(`${opts.sql}.sql`, toUpsertSql(rows, opts.user))
  writeFileSync(`${opts.sql}.check.sql`, toCheckSql(opts.year, opts.user))
  console.log(`  → ${opts.sql}.sql / ${opts.sql}.check.sql`)
}
