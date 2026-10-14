#!/usr/bin/env node
// 法改正フラグ（licensehub-expansion.md §9・PR-K。手順は docs/license-law-review.md）。
// 公式PDF由来で law_status='unchecked' の肢のうち、数値・期間・金額・年齢・割合・「〜日以内」などを含むものを
// review 候補にする。判定の規則は src/lib/license/lawRisk.ts（純関数・vitest）だけに置く。
//
// 使い方:
//   node scripts/license/flag-law-risk.mjs --sql /tmp/work/law-risk          （SQL エディタ用の SQL を書き出す。DB に触れない）
//   node scripts/license/flag-law-risk.mjs --dry-run --json /tmp/work/r08.json （公式PDFの中間JSONで候補を見る。DB に触れない）
//   node --env-file-if-exists=.env scripts/license/flag-law-risk.mjs --dry-run （DB の肢を読み出して候補を見る。DB は変えない）
//
//   --sql <prefix>       <prefix>.check.sql（読み出しのみ）→ <prefix>.sql（適用）、<prefix>.rollback.sql（戻す）を書き出す
//   --dry-run            候補の件数（年度・科目・規則別）と一覧を出す。DB は変えない
//   --json <path,...>    --dry-run の入力: 公式PDFの中間JSON（ingest-official.mjs --dump-json の出力）
//   --items <path>       --dry-run の入力: 肢の行の配列（id, label, statement, law_status, law_note, answer_spec）
//   --base-date <date>   法令基準日（YYYY-MM-DD。既定: 設定 law_base_date の既定値 2026-04-10）
//   --fixture            フィクスチャ（年度 R98・R99）も対象にする（ローカルの通し確認用）
//   --user <uuid>        対象の user_id（既定: LICENSE_USER_ID → 利用者が1人ならその人）
//
// --json / --items が無い --dry-run は、DB（service key）から読み出す。--sql は本文を含まない（規則だけ）ので、
// どこに書き出してもよい。生成した SQL は冪等（2回流しても結果は同じ）。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createSupabase, fail, parseArgs, readJson, resolveUserId, selectAll } from './lib.mjs'
import { isFixtureId } from '../../src/lib/license/ingest/schema.ts'
import { buildOfficialYear } from '../../src/lib/license/official/build.ts'
import { DEFAULT_LAW_BASE_DATE, pickLawRiskCandidates } from '../../src/lib/license/lawRisk.ts'
import { toLawRiskApplySql, toLawRiskCheckSql, toLawRiskRollbackSql } from '../../src/lib/license/lawRiskSql.ts'
import { parseItemId } from '../../src/domain/license.ts'

const HELP = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')
  .filter(l => l.startsWith('//   ')).map(l => l.slice(3)).join('\n')

const opts = parseArgs(process.argv.slice(2), {
  '--sql': 'sql', '--dry-run': 'dryRun?', '--json': 'json', '--items': 'items',
  '--base-date': 'baseDate', '--fixture': 'fixture?', '--user': 'user',
}, HELP)
if (!opts.sql && !opts.dryRun) fail('--sql か --dry-run を指定してください（--help で使い方を表示）')
const baseDate = opts.baseDate ?? DEFAULT_LAW_BASE_DATE
if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) fail(`--base-date は YYYY-MM-DD: ${baseDate}`)
const userId = opts.user ?? process.env.LICENSE_USER_ID

if (opts.sql) {
  const sqlOpts = { baseDate, userId, includeFixture: !!opts.fixture }
  try {
    writeFileSync(`${opts.sql}.check.sql`, toLawRiskCheckSql(sqlOpts))
    writeFileSync(`${opts.sql}.sql`, toLawRiskApplySql(sqlOpts))
    writeFileSync(`${opts.sql}.rollback.sql`, toLawRiskRollbackSql(sqlOpts))
  } catch (e) {
    fail(e.message)
  }
  console.log(`SQL を書き出しました（法令基準日 ${baseDate}）:`)
  console.log(`  1. ${opts.sql}.check.sql     読み出しのみ。候補の件数・一覧を確認する`)
  console.log(`  2. ${opts.sql}.sql           適用（unchecked → review。冪等）`)
  console.log(`  -  ${opts.sql}.rollback.sql  戻す（自動判定で review にした肢を unchecked に戻す）`)
}

// ---------------------------------------------------------------------------
// --dry-run: 候補の件数と一覧

async function loadRows() {
  if (opts.json && opts.items) fail('--json と --items は同時に指定できません')
  if (opts.json) {
    const rows = []
    for (const path of opts.json.split(',')) {
      const data = { taku: null, sentaku: null, answers: null, ...readJson(path) }
      const units = buildOfficialYear(data, { fixture: !!opts.fixture })
      const specOf = new Map(units.flatMap(u => u.questions).map(q => [q.id, q.answer_spec]))
      for (const u of units) {
        if (u.provided && !u.passed) console.log(`⚠ ${path} ${u.format}: 検証ゲートを通らないため対象外（ingest-official.mjs --dry-run で理由を確認）`)
      }
      rows.push(...units.filter(u => u.passed).flatMap(u => u.items).map(i => ({ ...i, answer_spec: specOf.get(i.question_id) })))
    }
    console.log(`入力: 公式PDFの中間JSON ${rows.length} 肢（DB の代わり）`)
    return rows
  }
  if (opts.items) {
    const rows = readJson(opts.items)
    if (!Array.isArray(rows)) fail(`${opts.items} は肢の行の配列ではありません`)
    console.log(`入力: ${opts.items} ${rows.length} 肢`)
    return rows
  }
  const supabase = await createSupabase()
  const uid = await resolveUserId(supabase, opts.user)
  const questions = await selectAll(() => supabase.from('lic_questions')
    .select('id, source, answer_spec').eq('user_id', uid).eq('source', 'honshiken').order('id'))
  const specOf = new Map(questions.map(q => [q.id, q.answer_spec]))
  const items = await selectAll(() => supabase.from('lic_items')
    .select('id, question_id, label, statement, law_status, law_note').eq('user_id', uid).order('id'))
  const rows = items.filter(i => specOf.has(i.question_id)).map(i => ({ ...i, answer_spec: specOf.get(i.question_id) }))
  console.log(`入力: DB の公式PDF由来の肢 ${rows.length} 件（DB は変えない）`)
  return rows
}

function countBy(xs, key) {
  const m = new Map()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

if (opts.dryRun) {
  const rows = (await loadRows()).filter(r => opts.fixture || !isFixtureId(r.id))
  const byStatus = countBy(rows, r => r.law_status)
  const candidates = pickLawRiskCandidates(rows, baseDate)
  const unchecked = rows.filter(r => r.law_status === 'unchecked')
  const coordOf = id => {
    const c = parseItemId(id)
    return c ? `${c.year} ${c.format === 'taku' ? '択一' : '選択'} ${c.scoredSubject}` : '(不明)'
  }
  console.log(`法令基準日: ${baseDate}`)
  console.log(`law_status の内訳: ${byStatus.map(([k, n]) => `${k} ${n}`).join(' / ') || '(なし)'}`)
  console.log(`review 候補: ${candidates.length} / unchecked ${unchecked.length}`)
  console.log('年度・式・科目別（候補 / unchecked）:')
  const candByCoord = new Map(countBy(candidates, c => coordOf(c.id)))
  for (const [coord, n] of countBy(unchecked, r => coordOf(r.id))) console.log(`  ${coord}: ${candByCoord.get(coord) ?? 0} / ${n}`)
  console.log('規則別（1肢が複数の規則に当たる）:')
  for (const [reason, n] of countBy(candidates.flatMap(c => c.reasons), r => r)) console.log(`  ${reason}: ${n}`)
  console.log('候補の一覧:')
  const stmt = new Map(rows.map(r => [r.id, r.statement]))
  for (const c of candidates) console.log(`  ${c.id}  [${c.reasons.join('・')}]  ${String(stmt.get(c.id) ?? '').slice(0, 40)}`)
  console.log('（dry-run）DB は変えていません。適用は --sql で SQL を作り、SQL エディタで実行する。')
}
