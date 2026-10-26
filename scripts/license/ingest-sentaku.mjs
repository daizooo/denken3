#!/usr/bin/env node
// 書籍の選択式（空欄補充）の書き起こしJSONを検証し、保存用の SQL を作る（docs/book-ingest/sentaku-spec.md）。
// DB には触れない。保存は Claude Code が利用者の承認を得て Supabase MCP の execute_sql で行う（official/sql.ts と同じ方式）。
//
// 手順:
//   1. 検証と件数:    node scripts/license/ingest-sentaku.mjs --data <json>
//   2. 突合用 SQL:    ... --check-sql <path>   → execute_sql で実行し、結果の行を JSON（[{id, answer_spec}, …]）に保存
//   3. 公式と突合:    ... --existing <result.json>   既存の問の blanks / wordbank が書籍と違えば理由つきで一覧にして終了コード 1
//   4. 保存用 SQL:    ... --sql <path> [--existing <result.json>]   → 承認を得て execute_sql で実行（食い違いがあれば SQL 自体も中止する）
//
//   --data <path>      書き起こしJSON（問の配列）。必須。リポジトリ配下に置かない（docs/book-ingest-lec-ippon-1.md §4.1）
//   --fixture          フィクスチャ（年度 R98・R99）として扱う。それ以外の年度は失敗にする
//   --partial          20問（10年×2科目）がそろっていなくても SQL を作る。既定はそろっていなければ失敗
//   --user <uuid>      SQL の user_id（省略時は Auth の利用者が1人ならその人。2人以上なら SQL が中止する）
//   --check-sql <path> 突合用 SQL（読み出しのみ）の出力先
//   --sql <path>       保存用 SQL の出力先
//   --existing <path>  突合用 SQL の結果（JSON）
import { writeFileSync } from 'node:fs'
import { fail, parseArgs, readJson } from './lib.mjs'
import {
  compareWithOfficial, formatSentakuErrors, formatSentakuSummary, missingQuestionIds, summarizeSentaku, validateSentaku,
} from '../../src/lib/license/ingest/sentakuSchema.ts'
import { toSentakuApplySql, toSentakuCheckSql } from '../../src/lib/license/ingest/sentakuSql.ts'

const HELP = `usage: node scripts/license/ingest-sentaku.mjs --data <json> [options]

  --data <path>       書き起こしJSON（問の配列）。必須
  --fixture           フィクスチャ（年度 R98・R99）として扱う
  --partial           20問そろっていなくても SQL を作る
  --user <uuid>       SQL の user_id
  --check-sql <path>  突合用 SQL（読み出しのみ）を書き出す
  --existing <path>   突合用 SQL の結果（JSON）と突合する
  --sql <path>        保存用 SQL を書き出す`

const opts = parseArgs(process.argv.slice(2), {
  '--data': 'data', '--fixture': 'fixture?', '--partial': 'partial?', '--user': 'user',
  '--check-sql': 'checkSql', '--existing': 'existing', '--sql': 'sql',
}, HELP)
if (!opts.data) fail('--data が必須です（--help で使い方を表示）')

const input = readJson(opts.data)
const { valid, errors } = validateSentaku(input, { fixture: !!opts.fixture })
const total = Array.isArray(input) ? input.length : 0

console.log(`検証: 入力 ${total} 問 → 合格 ${valid.length} / 失敗 ${errors.length}${opts.fixture ? '（フィクスチャ）' : ''}`)
if (errors.length > 0) {
  console.log('✗ 失敗した問（SQL に含めない）:')
  for (const line of formatSentakuErrors(errors)) console.log(line)
}
console.log(formatSentakuSummary(summarizeSentaku(valid)).join('\n'))

const missing = opts.fixture ? [] : missingQuestionIds(valid)
if (missing.length > 0) console.log(`網羅: 期待の20問のうち ${missing.length} 問が無い → ${missing.join(', ')}`)

let failed = errors.length > 0
const label = opts.data.split('/').pop()
const sqlOpts = { userId: opts.user, label }

if (opts.checkSql) {
  if (valid.length === 0) fail('SQL にできる問がありません')
  writeFileSync(opts.checkSql, toSentakuCheckSql(valid, sqlOpts))
  console.log(`✓ 突合用 SQL（読み出しのみ）を書き出し: ${opts.checkSql}`)
}

if (opts.existing) {
  const rows = readJson(opts.existing)
  if (!Array.isArray(rows)) fail(`${opts.existing} は行の配列（[{id, answer_spec}, …]）ではありません`)
  const byId = new Map(rows.map(r => [r.id, r.answer_spec]))
  const diffs = valid.filter(v => byId.has(v.questionId)).map(v => compareWithOfficial(v, byId.get(v.questionId))).filter(Boolean)
  if (diffs.length > 0) {
    failed = true
    console.log('✗ 既存の answer_spec と食い違う問（書き起こしの誤りか公式との差かを画像で確認する）:')
    for (const d of diffs) {
      console.log(`  ${d.questionId}`)
      for (const r of d.reasons) console.log(`    - ${r}`)
    }
  } else {
    console.log(`✓ 既存 ${byId.size} 問は公式の blanks / wordbank が一致（新規 ${valid.length - byId.size} 問）`)
  }
}

if (opts.sql) {
  if (valid.length === 0) fail('SQL にできる問がありません')
  if (failed) fail('検証の失敗・公式との食い違いがあるため、保存用 SQL を作りません')
  if (missing.length > 0 && !opts.partial) fail('20問そろっていません（途中までなら --partial を付ける）')
  writeFileSync(opts.sql, toSentakuApplySql(valid, sqlOpts))
  console.log(`✓ 保存用 SQL を書き出し: ${opts.sql}（問 ${valid.length}。実行は利用者の承認を得て execute_sql で行う）`)
}
process.exit(failed ? 1 : 0)
