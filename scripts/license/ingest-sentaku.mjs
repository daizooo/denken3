#!/usr/bin/env node
// 書籍の選択式（空欄補充）の書き起こしJSONを検証し、lic_questions / lic_items へ保存する
// （docs/book-ingest/sentaku-spec.md）。択一式の ingest.mjs とは別（schema.ts は触らない）。
//
// 使い方:
//   node --env-file-if-exists=.env scripts/license/ingest-sentaku.mjs --data <json> [--dry-run | --compare] [--partial]
//
//   --data <path>   書き起こしJSON（問の配列）。必須。リポジトリ配下に置かない（docs/book-ingest-lec-ippon-1.md §4.1）
//   --dry-run       Supabase に触らず、検証結果と件数だけ出す（認証情報も不要）
//   --compare       DB を読むだけ（書き込まない）。既存の公式の answer_spec と blanks / wordbank を突合する
//   --partial       20問（10年×2科目）がそろっていなくても保存する。既定はそろっていなければ失敗
//   --fixture       フィクスチャ（年度 R98・R99）として取り込む。それ以外の年度は失敗にする
//   --user <uuid>   書き込み先の user_id（既定: LICENSE_USER_ID → 利用者が1人ならその人）
//
// 保存の方針（spec §3.3）:
//   lic_questions  既存（公式）は更新しない。新規だけ source='ippon'・stem=null・answer_spec=書籍
//   lic_items      既存は statement・explanation・study_subject だけ更新（origin_statement・law_status は据え置き）。新規は全項目
// 公式との突合で食い違いがあれば、何も保存せず終了コード 1（書き起こしの誤りか公式との差かを先に確認する）。
// 冪等: 同じJSONを何度流しても結果は同じ。DELETE / DROP / TRUNCATE は使わない。
import { chunk, createSupabase, fail, parseArgs, readJson, resolveUserId } from './lib.mjs'
import {
  compareWithOfficial, formatSentakuErrors, formatSentakuSummary, missingQuestionIds, summarizeSentaku, toSentakuRows, validateSentaku,
} from '../../src/lib/license/ingest/sentakuSchema.ts'

const HELP = `usage: node --env-file-if-exists=.env scripts/license/ingest-sentaku.mjs --data <json> [options]

  --data <path>   書き起こしJSON（問の配列）。必須
  --dry-run       Supabase に触らず、検証結果と件数だけ出す
  --compare       DB を読むだけ。既存の公式の answer_spec と突合する（書き込まない）
  --partial       20問そろっていなくても保存する
  --fixture       フィクスチャ（年度 R98・R99）として取り込む
  --user <uuid>   書き込み先の user_id`

const opts = parseArgs(process.argv.slice(2), {
  '--data': 'data', '--dry-run': 'dryRun?', '--compare': 'compare?', '--partial': 'partial?', '--fixture': 'fixture?', '--user': 'user',
}, HELP)
if (!opts.data) fail('--data が必須です（--help で使い方を表示）')
if (opts.dryRun && opts.compare) fail('--dry-run と --compare は同時に指定できません')

const input = readJson(opts.data)
const { valid, errors } = validateSentaku(input, { fixture: !!opts.fixture })
const total = Array.isArray(input) ? input.length : 0

console.log(`検証: 入力 ${total} 問 → 合格 ${valid.length} / 失敗 ${errors.length}${opts.fixture ? '（フィクスチャ）' : ''}`)
if (errors.length > 0) {
  console.log('✗ 失敗した問（保存しない）:')
  for (const line of formatSentakuErrors(errors)) console.log(line)
}
console.log(`${opts.dryRun ? '保存予定' : '保存対象'}: ${formatSentakuSummary(summarizeSentaku(valid)).join('\n')}`)

const missing = opts.fixture ? [] : missingQuestionIds(valid)
if (missing.length > 0) console.log(`網羅: 期待の20問のうち ${missing.length} 問が無い → ${missing.join(', ')}`)

if (opts.dryRun) {
  console.log('（dry-run）Supabase には触れていません。')
  process.exit(errors.length > 0 ? 1 : 0)
}
if (valid.length === 0) fail('保存できる問がありません')

const supabase = await createSupabase()
const userId = await resolveUserId(supabase, opts.user)

// 既存の問・空欄（公式の取り込み済みを含む）。
const questionIds = valid.map(v => v.questionId)
const itemIds = valid.flatMap(v => v.items.map(i => i.itemId))
const existingQuestions = new Map()
for (const ids of chunk(questionIds, 200)) {
  const { data, error } = await supabase.from('lic_questions').select('id, answer_spec, source').eq('user_id', userId).in('id', ids)
  if (error) fail(`既存の問の読み出しに失敗: ${error.message}`)
  for (const r of data) existingQuestions.set(r.id, r)
}
const existingItems = new Set()
for (const ids of chunk(itemIds, 200)) {
  const { data, error } = await supabase.from('lic_items').select('id').eq('user_id', userId).in('id', ids)
  if (error) fail(`既存の空欄の読み出しに失敗: ${error.message}`)
  for (const r of data) existingItems.add(r.id)
}
console.log(`既存: 問 ${existingQuestions.size} / ${valid.length}、空欄 ${existingItems.size} / ${itemIds.length}`)

// 公式との突合（既存の問だけ。公式の stem・answer_spec は更新しない）。
const diffs = valid
  .filter(v => existingQuestions.has(v.questionId))
  .map(v => compareWithOfficial(v, existingQuestions.get(v.questionId).answer_spec))
  .filter(Boolean)
if (diffs.length > 0) {
  console.log('✗ 既存の answer_spec と食い違う問（書き起こしの誤りか公式との差かを画像で確認する）:')
  for (const d of diffs) {
    console.log(`  ${d.questionId}`)
    for (const r of d.reasons) console.log(`    - ${r}`)
  }
} else {
  console.log(`✓ 既存 ${existingQuestions.size} 問は公式の answer_spec と blanks / wordbank が一致`)
}

if (opts.compare) {
  console.log('（compare）読み出しのみ。書き込んでいません。')
  process.exit(errors.length > 0 || diffs.length > 0 ? 1 : 0)
}
if (diffs.length > 0) fail('公式との食い違いがあるため保存しません')
if (missing.length > 0 && !opts.partial) fail('20問そろっていません（途中までなら --partial を付ける）')

const rows = toSentakuRows(valid, userId, new Set(existingQuestions.keys()), existingItems)

// 問: 新規だけ。既存は触らない（ignoreDuplicates は念のため）。
for (const part of chunk(rows.newQuestions, 500)) {
  const { error } = await supabase.from('lic_questions').upsert(part, { onConflict: 'user_id,id', ignoreDuplicates: true })
  if (error) fail(`lic_questions の保存に失敗: ${error.message}`)
}
// 空欄: 新規は挿入、既存は書籍で更新する3列＋解説の付随列だけ。
for (const part of chunk(rows.newItems, 500)) {
  const { error } = await supabase.from('lic_items').upsert(part, { onConflict: 'user_id,id' })
  if (error) fail(`lic_items の保存に失敗: ${error.message}`)
}
for (const { id, ...patch } of rows.itemUpdates) {
  const { error } = await supabase.from('lic_items').update(patch).eq('user_id', userId).eq('id', id)
  if (error) fail(`lic_items の更新に失敗（${id}）: ${error.message}`)
}

// 保存後に DB から数え直す。
let stored = 0
for (const ids of chunk(itemIds, 200)) {
  const { count, error } = await supabase.from('lic_items').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('id', ids)
  if (error) fail(`保存結果の確認に失敗: ${error.message}`)
  stored += count ?? 0
}
console.log(`✓ 保存: lic_questions 新規 ${rows.newQuestions.length} 行、lic_items 新規 ${rows.newItems.length} 行 / 更新 ${rows.itemUpdates.length} 行（DB で確認 ${stored} 行）`)
if (stored !== itemIds.length) fail(`DB の件数（${stored}）が取り込んだ件数（${itemIds.length}）と一致しません`)
process.exit(errors.length > 0 ? 1 : 0)
