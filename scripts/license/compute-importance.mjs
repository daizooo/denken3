#!/usr/bin/env node
// 重要度（A/B/C）を出題回数から算出する（licensehub-expansion.md §14・src/lib/license/ingest/importance.ts）。
// 学習科目ごとに論点別の肢の数を数え、importance を付ける UPDATE 文を出力する（DB には書かない）。
// 書き込みは Claude Code が利用者の承認を得て Supabase MCP の execute_sql で行う（本番書き込みの手順は book-ingest 仕様書）。
//
// 使い方:
//   node scripts/license/compute-importance.mjs --items <json> --user <uuid> [--subject rouki] [--sql <path>]
//   node --env-file-if-exists=.env scripts/license/compute-importance.mjs --user <uuid>   # service key があれば DB から読む
//
//   --items <path>   DB の代わりに肢の行の配列（id, study_subject, topic_id, law_status）を使う
//   --subject <id>   対象の学習科目（既定: 肢がある全科目）
//   --user <uuid>    UPDATE の対象 user_id（必須）
//   --sql <path>     UPDATE 文をファイルに書く（既定: 標準出力に要約のみ）
import { writeFileSync } from 'node:fs'
import { createSupabase, fail, parseArgs, readJson, selectAll } from './lib.mjs'
import { computeTopicImportance } from '../../src/lib/license/ingest/importance.ts'
import { parseItemId } from '../../src/domain/license.ts'

const HELP = `usage: node scripts/license/compute-importance.mjs --user <uuid> [--items <json>] [--subject <id>] [--sql <path>]`

const opts = parseArgs(process.argv.slice(2), {
  '--items': 'items', '--subject': 'subject', '--user': 'user', '--sql': 'sql',
}, HELP)
if (!opts.user) fail('--user <uuid> が必要です')

async function loadRows() {
  if (opts.items) {
    const rows = readJson(opts.items)
    if (!Array.isArray(rows)) fail(`${opts.items} は肢の行の配列ではありません`)
    return rows
  }
  const supabase = await createSupabase()
  return selectAll(() => supabase.from('lic_items').select('id, study_subject, topic_id, law_status')
    .eq('user_id', opts.user).order('id'))
}

const q = s => `'${s.replace(/'/g, "''")}'`
const rows = (await loadRows()).filter(r => parseItemId(r.id)?.format === 'taku')
  .filter(r => !opts.subject || r.study_subject === opts.subject)
const subjects = [...new Set(rows.map(r => r.study_subject))].sort()
const sql = []
for (const subject of subjects) {
  const result = computeTopicImportance(rows.filter(r => r.study_subject === subject))
  const total = result.reduce((a, t) => a + t.count, 0)
  console.log(`${subject}: 論点 ${result.length} / 肢 ${total}（論点なし・除外は数えない）`)
  for (const t of result) console.log(`  ${t.importance} ${String(t.count).padStart(3)}  累積 ${(t.cumulativeShare * 100).toFixed(0).padStart(3)}%  ${t.topic}`)
  for (const imp of ['A', 'B', 'C']) {
    const topics = result.filter(t => t.importance === imp).map(t => q(t.topic))
    if (topics.length === 0) continue
    sql.push(`update lic_items set importance = ${q(imp)} where user_id = ${q(opts.user)} and study_subject = ${q(subject)} and topic_id in (${topics.join(', ')});`)
  }
  const A = result.filter(t => t.importance === 'A').reduce((a, t) => a + t.count, 0)
  const B = result.filter(t => t.importance === 'B').reduce((a, t) => a + t.count, 0)
  console.log(`  → 肢の数 A ${A} / B ${B} / C ${total - A - B}`)
}
if (opts.sql) {
  writeFileSync(opts.sql, sql.join('\n') + '\n')
  console.log(`✓ UPDATE 文 ${sql.length} 本を書き出し: ${opts.sql}`)
}
