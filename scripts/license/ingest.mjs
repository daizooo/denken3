#!/usr/bin/env node
// 書き起こしJSON（書籍の一問一答）を検証し、lic_questions / lic_items へ保存する
// （licensehub-expansion.md §4.2・§14・PR-J1a。手順は docs/license-ingest.md）。
//
// 使い方:
//   node --env-file-if-exists=.env scripts/license/ingest.mjs --data <json> [--subject rouki] [--dry-run]
//
//   --data <path>      書き起こしJSON（肢の配列）。必須。リポジトリ配下に置かない（§4.1）
//   --subject <id>     肢に study_subject が無いときの学習科目（rouki / anei / …）
//   --fixture          フィクスチャ（年度 R98・R99）として取り込む。それ以外の年度は失敗にする
//   --dry-run          Supabase に触らず、検証結果と件数だけ出す（認証情報も不要）
//   --user <uuid>      書き込み先の user_id（既定: LICENSE_USER_ID → 利用者が1人ならその人）
//
// 冪等: 同じJSONを何度流しても結果は同じ（lic_items は upsert、lic_questions は既存なら触らない）。
// 検証に失敗した肢は理由つきで一覧にして保存しない。失敗が1件でもあれば終了コード 1。
import { chunk, createSupabase, fail, parseArgs, readJson, resolveUserId } from './lib.mjs'
import { formatErrors, formatSummary, summarize, toRows, validateTranscription } from '../../src/lib/license/ingest/schema.ts'

const HELP = `usage: node --env-file-if-exists=.env scripts/license/ingest.mjs --data <json> [options]

  --data <path>      書き起こしJSON（肢の配列）。必須
  --subject <id>     肢に study_subject が無いときの学習科目（rouki / anei / …）
  --fixture          フィクスチャ（年度 R98・R99）として取り込む
  --dry-run          Supabase に触らず、検証結果と件数だけ出す
  --user <uuid>      書き込み先の user_id`

const opts = parseArgs(process.argv.slice(2), {
  '--data': 'data', '--subject': 'subject', '--fixture': 'fixture?', '--dry-run': 'dryRun?', '--user': 'user',
}, HELP)
if (!opts.data) fail('--data が必須です（--help で使い方を表示）')

const input = readJson(opts.data)
const { valid, errors } = validateTranscription(input, { studySubject: opts.subject, fixture: !!opts.fixture })
const total = Array.isArray(input) ? input.length : 0

console.log(`検証: 入力 ${total} 肢 → 合格 ${valid.length} / 失敗 ${errors.length}${opts.fixture ? '（フィクスチャ）' : ''}`)
if (errors.length > 0) {
  console.log('✗ 失敗した肢（保存しない）:')
  for (const line of formatErrors(errors)) console.log(line)
}
console.log(`${opts.dryRun ? '保存予定' : '保存対象'}: ${formatSummary(summarize(valid)).join('\n')}`)

if (opts.dryRun) {
  const { questions, items } = toRows(valid, '00000000-0000-0000-0000-000000000000')
  console.log(`（dry-run）Supabase には触れていません。lic_questions ${questions.length} 行 / lic_items ${items.length} 行を upsert する予定です。`)
  process.exit(errors.length > 0 ? 1 : 0)
}
if (valid.length === 0) fail('保存できる肢がありません')

const supabase = await createSupabase()
const userId = await resolveUserId(supabase, opts.user)
const { questions, items } = toRows(valid, userId)

let insertedQuestions = 0
for (const rows of chunk(questions, 500)) {
  // 問が既にあれば触らない（公式PDF（PR-D）の stem・answer_spec を書籍で上書きしない）。
  const { data, error } = await supabase.from('lic_questions')
    .upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true }).select('id')
  if (error) fail(`lic_questions の保存に失敗: ${error.message}`)
  insertedQuestions += data.length
}
for (const rows of chunk(items, 500)) {
  const { error } = await supabase.from('lic_items').upsert(rows, { onConflict: 'user_id,id' })
  if (error) fail(`lic_items の保存に失敗: ${error.message}`)
}

// 保存後に DB から数え直して、取り込んだ肢がすべて入ったことを確認する。
let stored = 0
for (const ids of chunk(items.map(i => i.id), 200)) {
  const { count, error } = await supabase.from('lic_items')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId).in('id', ids)
  if (error) fail(`保存結果の確認に失敗: ${error.message}`)
  stored += count ?? 0
}
console.log(`✓ 保存: lic_questions 新規 ${insertedQuestions} / ${questions.length} 行（既存は据え置き）、lic_items ${items.length} 行 upsert（DB で確認 ${stored} 行）`)
if (stored !== items.length) fail(`DB の件数（${stored}）が保存した件数（${items.length}）と一致しません`)
console.log('次: 索引を再生成する → node --env-file-if-exists=.env scripts/license/build-master.mjs')
process.exit(errors.length > 0 ? 1 : 0)
