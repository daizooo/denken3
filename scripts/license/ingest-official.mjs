#!/usr/bin/env node
// 公式PDF（本試験の択一式・選択式・正答）を構造化し、検証ゲートを通った年度・式だけを lic_questions / lic_items へ保存する
// （licensehub-expansion.md §4.2・§4.4・§8・§13・§14・PR-D。手順は docs/license-official.md）。
//
// 使い方:
//   pdftotext -enc UTF-8 令和8年度択一式.pdf /tmp/work/r08-taku.txt   （作業用ファイルはリポジトリの外に置く。§4.1）
//   node --env-file-if-exists=.env scripts/license/ingest-official.mjs --year R08 \
//     --taku /tmp/work/r08-taku.txt --sentaku /tmp/work/r08-sentaku.txt --answers /tmp/work/r08-answers.txt --dry-run
//
//   --year <R08>         年度（--json のときは JSON の year）
//   --taku <path>        択一式の抽出テキスト（.txt）
//   --sentaku <path>     選択式の抽出テキスト（.txt）
//   --answers <path>     正答の抽出テキスト（.txt）か正答JSON（.json）
//   --json <path>        構造化済みの中間JSON（--dump-json の出力を手で直したもの）。--taku/--sentaku/--answers の代わり
//   --corrections <path> 問題誤りの公表による補正・学習科目の分割位置（JSON。docs/license-official.md）
//   --book <path,...>    書籍の書き起こしJSON（J1a の形式）。--dry-run / --sql で突き合わせを DB なしで確かめる
//   --dump-json <path>   構造化した中間JSONを書き出す（リポジトリの外）
//   --sql <prefix>       DB に触れず、<prefix>.check.sql（突き合わせ・読み出しのみ）と <prefix>.sql（保存）を書き出す
//   --fixture            フィクスチャ（年度 R98・R99）として扱う。それ以外の年度は失敗にする
//   --dry-run            Supabase に触れず、件数・検証結果・突き合わせ結果だけを出す（認証情報も不要）
//   --user <uuid>        書き込み先の user_id（既定: LICENSE_USER_ID → 利用者が1人ならその人）
//
// 冪等: 同じ入力を何度流しても結果は同じ（列ごとの規則は src/lib/license/official/merge.ts）。
// ゲートを通らなかった年度・式は保存せず、理由を一覧にする。1つでもあれば終了コード 1。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chunk, createSupabase, fail, parseArgs, readJson, resolveUserId, selectAll } from './lib.mjs'
import { toRows, validateTranscription } from '../../src/lib/license/ingest/schema.ts'
import { parseTakuText } from '../../src/lib/license/official/parseTaku.ts'
import { parseSentakuText } from '../../src/lib/license/official/parseSentaku.ts'
import { answersFromJson, parseAnswersText } from '../../src/lib/license/official/parseAnswers.ts'
import { buildOfficialYear } from '../../src/lib/license/official/build.ts'
import { formatMatchReport, matchWithExisting, mergeItem } from '../../src/lib/license/official/merge.ts'
import { formatCounts, formatGate } from '../../src/lib/license/official/report.ts'
import { toCheckSql, toIngestSql } from '../../src/lib/license/official/sql.ts'

const HELP = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')
  .filter(l => l.startsWith('//   ')).map(l => l.slice(3)).join('\n')

const opts = parseArgs(process.argv.slice(2), {
  '--year': 'year', '--taku': 'taku', '--sentaku': 'sentaku', '--answers': 'answers', '--json': 'json',
  '--corrections': 'corrections', '--book': 'book', '--dump-json': 'dumpJson', '--sql': 'sql',
  '--fixture': 'fixture?', '--dry-run': 'dryRun?', '--user': 'user',
}, HELP)

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const inRepo = p => resolve(p).startsWith(REPO + '/')
// 本物の年度の本文・正答をリポジトリに置かない（§4.1）。フィクスチャだけは例外。
const assertOutside = (p, what) => {
  if (inRepo(p) && !opts.fixture) fail(`${what} をリポジトリ配下に書き出せません（§4.1）: ${p}`)
}
const readText = p => {
  try { return readFileSync(p, 'utf8') } catch (e) { fail(`${p} を読めません: ${e.message}`) }
}

// ---------------------------------------------------------------------------
// 抽出 → 構造化

let data
const parseIssues = []
if (opts.json) {
  if (opts.taku || opts.sentaku || opts.answers) fail('--json と --taku/--sentaku/--answers は同時に指定できません')
  data = readJson(opts.json)
  if (!data || typeof data.year !== 'string') fail('中間JSONに year がありません')
  if (opts.year && opts.year !== data.year) fail(`--year ${opts.year} と JSON の year ${data.year} が違います`)
  data = { taku: null, sentaku: null, answers: null, ...data }
} else {
  if (!opts.year) fail('--year が必須です（--help で使い方を表示）')
  if (!opts.taku && !opts.sentaku && !opts.answers) fail('--taku / --sentaku / --answers のどれかが必要です')
  data = { year: opts.year, taku: null, sentaku: null, answers: null }
  if (opts.taku) {
    const r = parseTakuText(readText(opts.taku), opts.year)
    data.taku = r.questions
    parseIssues.push(...r.issues)
  }
  if (opts.sentaku) {
    const r = parseSentakuText(readText(opts.sentaku), opts.year)
    data.sentaku = r.questions
    parseIssues.push(...r.issues)
  }
  if (opts.answers) {
    if (opts.answers.endsWith('.json')) {
      const r = answersFromJson(readJson(opts.answers))
      if (r.reasons.length > 0) fail(`正答JSONの形が不正: ${r.reasons.join(' / ')}`)
      data.answers = r.answers
    } else {
      const r = parseAnswersText(readText(opts.answers), opts.year)
      data.answers = r.answers
      parseIssues.push(...r.issues)
    }
  }
}
if (opts.dumpJson) {
  assertOutside(opts.dumpJson, '中間JSON')
  writeFileSync(opts.dumpJson, JSON.stringify(data, null, 2) + '\n')
  console.log(`中間JSONを書き出しました: ${opts.dumpJson}（直したら --json で読み戻せる）`)
}

// ---------------------------------------------------------------------------
// 検証ゲート

const corrections = opts.corrections ? readJson(opts.corrections) : undefined
const units = buildOfficialYear(data, { fixture: !!opts.fixture, corrections, parseIssues })
for (const line of formatGate(units)) console.log(line)
for (const line of formatCounts(units)) console.log(line)

const questions = units.flatMap(u => u.questions)
const items = units.flatMap(u => u.items)
const counts = units.flatMap(u => u.counts)
const gateFailed = units.some(u => u.provided && !u.passed)
const exitCode = gateFailed ? 1 : 0
const label = `${data.year} ${units.filter(u => u.passed).map(u => (u.format === 'taku' ? '択一' : '選択式')).join('・') || '(保存なし)'}`

// ---------------------------------------------------------------------------
// 書籍の肢との突き合わせ（DB なし: --book のJSON）

function bookItems() {
  if (!opts.book) return null
  const out = []
  for (const path of opts.book.split(',')) {
    const { valid, errors } = validateTranscription(readJson(path), { fixture: !!opts.fixture })
    if (errors.length > 0) console.log(`⚠ 書籍JSON ${path}: 検証に失敗した肢 ${errors.length} 件は突き合わせに使わない`)
    out.push(...toRows(valid, '00000000-0000-0000-0000-000000000000').items)
  }
  return out
}

if (opts.dryRun || opts.sql) {
  const book = bookItems()
  if (book) for (const line of formatMatchReport(matchWithExisting(items, book, counts))) console.log(line)
  else console.log('突き合わせ: --book を付けると書籍の肢と DB なしで突き合わせる（本番は保存時に DB の肢と突き合わせる）')
}

if (opts.sql) {
  assertOutside(opts.sql, 'SQL')
  if (items.length === 0) fail('ゲートを通った年度・式が無いため SQL を作りません')
  const sqlOpts = { userId: opts.user ?? process.env.LICENSE_USER_ID, label }
  writeFileSync(`${opts.sql}.check.sql`, toCheckSql(items, sqlOpts))
  writeFileSync(`${opts.sql}.sql`, toIngestSql(questions, items, sqlOpts))
  console.log(`SQL を書き出しました: ${opts.sql}.check.sql（突き合わせ・読み出しのみ）→ ${opts.sql}.sql（保存）の順に SQL エディタで実行する`)
  process.exit(exitCode)
}

if (opts.dryRun) {
  console.log(`（dry-run）Supabase には触れていません。lic_questions ${questions.length} 行 / lic_items ${items.length} 行を upsert する予定です。`)
  process.exit(exitCode)
}
if (items.length === 0) fail('保存できる年度・式がありません')

// ---------------------------------------------------------------------------
// DB保存

const supabase = await createSupabase()
const userId = await resolveUserId(supabase, opts.user)
const questionIds = [...new Set(items.map(i => i.question_id))]
const existing = []
for (const ids of chunk(questionIds, 100)) {
  existing.push(...await selectAll(() => supabase.from('lic_items').select('*').eq('user_id', userId).in('question_id', ids).order('id')))
}
for (const line of formatMatchReport(matchWithExisting(items, existing, counts))) console.log(line)

const existingById = new Map(existing.map(e => [e.id, e]))
const itemRows = items.map(o => ({ user_id: userId, ...mergeItem(existingById.get(o.id), o) }))
for (const rows of chunk(questions.map(q => ({ user_id: userId, ...q })), 500)) {
  const { error } = await supabase.from('lic_questions').upsert(rows, { onConflict: 'user_id,id' })
  if (error) fail(`lic_questions の保存に失敗: ${error.message}`)
}
for (const rows of chunk(itemRows, 500)) {
  const { error } = await supabase.from('lic_items').upsert(rows, { onConflict: 'user_id,id' })
  if (error) fail(`lic_items の保存に失敗: ${error.message}`)
}
let stored = 0
for (const ids of chunk(itemRows.map(i => i.id), 200)) {
  const { count, error } = await supabase.from('lic_items')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId).in('id', ids)
  if (error) fail(`保存結果の確認に失敗: ${error.message}`)
  stored += count ?? 0
}
console.log(`✓ 保存: ${label} — lic_questions ${questions.length} 行 / lic_items ${itemRows.length} 行 upsert（DB で確認 ${stored} 行）`)
if (stored !== itemRows.length) fail(`DB の件数（${stored}）が保存した件数（${itemRows.length}）と一致しません`)
process.exit(exitCode)
