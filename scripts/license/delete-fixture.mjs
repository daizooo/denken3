#!/usr/bin/env node
// フィクスチャ（年度 R98・R99）の行だけを DB から消して元に戻す（licensehub-expansion.md §12.2 の3・PR-J1a）。
// 対象: lic_items / lic_questions のフィクスチャ年度の行と、その肢に付いた denken_reviews（exam_id='sharoushi'）。
// 本物の肢は消さない: 候補を読み出したあと、ID を1件ずつ isFixtureId（年度が R98・R99）で確かめた行だけを ID 指定で消す。
//
// 使い方:
//   node --env-file-if-exists=.env scripts/license/delete-fixture.mjs --dry-run   # 消す範囲の確認（読み出しのみ）
//   node --env-file-if-exists=.env scripts/license/delete-fixture.mjs --yes       # 実行
//
//   --dry-run       読み出しだけ行い、消す行の件数と ID を出す
//   --yes           実際に消す（--dry-run を先に実行して範囲を確認すること）
//   --user <uuid>   対象の user_id（既定: LICENSE_USER_ID → 利用者が1人ならその人）
import { chunk, createSupabase, fail, parseArgs, resolveUserId, selectAll } from './lib.mjs'
import { FIXTURE_YEARS, isFixtureId } from '../../src/lib/license/ingest/schema.ts'

const HELP = `usage: node --env-file-if-exists=.env scripts/license/delete-fixture.mjs (--dry-run | --yes) [--user <uuid>]`

const opts = parseArgs(process.argv.slice(2), { '--dry-run': 'dryRun?', '--yes': 'yes?', '--user': 'user' }, HELP)
if (!opts.dryRun && !opts.yes) fail('--dry-run（範囲の確認）か --yes（実行）を指定してください')
if (opts.dryRun && opts.yes) fail('--dry-run と --yes は同時に指定できません')

const supabase = await createSupabase()
const userId = await resolveUserId(supabase, opts.user)

// 候補は年度の接頭辞で絞り、最終判定は isFixtureId で行う（LIKE の _ は任意の1文字なので鵜呑みにしない）。
async function fixtureIds(table, column, extra = q => q) {
  const ids = new Set()
  for (const year of FIXTURE_YEARS) {
    const rows = await selectAll(() => extra(supabase.from(table).select(column).eq('user_id', userId).like(column, `${year}%`)).order(column))
    for (const r of rows) if (isFixtureId(r[column])) ids.add(r[column])
  }
  return [...ids]
}

const targets = [
  { table: 'denken_reviews', column: 'question_id', extra: q => q.eq('exam_id', 'sharoushi') },
  { table: 'lic_items', column: 'id' },
  { table: 'lic_questions', column: 'id' },
]
for (const t of targets) t.ids = await fixtureIds(t.table, t.column, t.extra)

console.log(`対象 user_id: ${userId}／フィクスチャ年度: ${FIXTURE_YEARS.join('・')}`)
for (const t of targets) {
  const sample = t.ids.slice(0, 5).join(', ')
  console.log(`  ${t.table}: ${t.ids.length} 行${t.ids.length > 0 ? `（${sample}${t.ids.length > 5 ? ', …' : ''}）` : ''}`)
}
const bad = targets.flatMap(t => t.ids.filter(id => !isFixtureId(id)))
if (bad.length > 0) fail(`フィクスチャ以外の ID が混入しています（中止）: ${bad.join(', ')}`)

if (opts.dryRun) {
  console.log('（dry-run）何も消していません。実行するには --yes を付けてください。')
  process.exit(0)
}

for (const t of targets) {
  let deleted = 0
  for (const ids of chunk(t.ids, 200)) {
    const { data, error } = await (t.extra ?? (q => q))(supabase.from(t.table).delete().eq('user_id', userId).in(t.column, ids)).select(t.column)
    if (error) fail(`${t.table} の削除に失敗: ${error.message}`)
    deleted += data.length
  }
  console.log(`✓ ${t.table}: ${deleted} 行を削除`)
}
console.log('索引にフィクスチャを含めていた場合は git checkout -- src/data/sharoushi/subjects で戻す。')
