#!/usr/bin/env node
// マスター索引（本文なし）を DB の lic_items から生成する（licensehub-expansion.md §4.5・PR-J1a）。
// 出力: src/data/sharoushi/subjects/<学習科目>.ts（Chapter[]、章 = 論点グループ）と、
//       registry（subjects/index.ts）末尾への import・1行の追記（初回のみ）。手書きしない。
//
// 使い方:
//   node --env-file-if-exists=.env scripts/license/build-master.mjs [--subject rouki] [--dry-run]
//
//   --subject <id>      対象の学習科目（既定: DB に肢がある全科目）
//   --dry-run           ファイルを書かず、生成する内容の要約を出す
//   --include-fixture   フィクスチャ（年度 R98・R99）の肢も含める（通し確認用。生成物はコミットしない）
//   --data <path>       DB の代わりに書き起こしJSONを検証して使う（DB 保存前の dry-run 確認用）
//   --fixture           --data をフィクスチャとして検証する
//   --out <dir>         出力先（既定: src/data/sharoushi/subjects）
//   --user <uuid>       読み出す user_id（既定: LICENSE_USER_ID → 利用者が1人ならその人）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSupabase, fail, parseArgs, readJson, resolveUserId, selectAll } from './lib.mjs'
import { FIXTURE_YEARS, isFixtureId, toRows, validateTranscription } from '../../src/lib/license/ingest/schema.ts'
import { addToRegistry, buildSubjectChapters, renderSubjectFile } from '../../src/lib/license/ingest/master.ts'
import { SHAROUSHI_SUBJECTS } from '../../src/data/sharoushi/index.ts'
import { parseItemId } from '../../src/domain/license.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEFAULT_OUT = join(REPO_ROOT, 'src/data/sharoushi/subjects')

const HELP = `usage: node --env-file-if-exists=.env scripts/license/build-master.mjs [options]

  --subject <id>      対象の学習科目（既定: 肢がある全科目）
  --dry-run           ファイルを書かず、生成する内容の要約を出す
  --include-fixture   フィクスチャ（年度 ${FIXTURE_YEARS.join('・')}）の肢も含める（生成物はコミットしない）
  --data <path>       DB の代わりに書き起こしJSONを検証して使う
  --fixture           --data をフィクスチャとして検証する
  --out <dir>         出力先（既定: src/data/sharoushi/subjects）
  --user <uuid>       読み出す user_id`

const opts = parseArgs(process.argv.slice(2), {
  '--subject': 'subject', '--dry-run': 'dryRun?', '--include-fixture': 'includeFixture?',
  '--data': 'data', '--fixture': 'fixture?', '--out': 'out', '--user': 'user',
}, HELP)
if (opts.subject && !SHAROUSHI_SUBJECTS.some(s => s.id === opts.subject)) {
  fail(`未知の学習科目: ${opts.subject}（対象: ${SHAROUSHI_SUBJECTS.map(s => s.id).join(', ')}）`)
}

async function loadItems() {
  if (opts.data) {
    const { valid, errors } = validateTranscription(readJson(opts.data), { fixture: !!opts.fixture })
    if (errors.length > 0) console.log(`⚠ 検証に失敗した ${errors.length} 肢は索引に含めない（ingest.mjs --dry-run で理由を確認）`)
    console.log(`入力: ${opts.data}（DB の代わり。検証を通った ${valid.length} 肢）`)
    return toRows(valid, '').items
  }
  const supabase = await createSupabase()
  const userId = await resolveUserId(supabase, opts.user)
  const rows = await selectAll(() => {
    let q = supabase.from('lic_items').select('id, study_subject, topic_id, importance')
      .eq('user_id', userId).order('id')
    if (opts.subject) q = q.eq('study_subject', opts.subject)
    return q
  })
  const taku = rows.filter(r => parseItemId(r.id)?.format === 'taku')
  console.log(`入力: DB の lic_items 択一式 ${taku.length} 肢`)
  return taku
}

const all = await loadItems()
const fixtureCount = all.filter(r => isFixtureId(r.id)).length
const items = all.filter(r => (opts.includeFixture || opts.data ? true : !isFixtureId(r.id)))
  .filter(r => !opts.subject || r.study_subject === opts.subject)
if (fixtureCount > 0 && !opts.includeFixture && !opts.data) {
  console.log(`  フィクスチャ ${fixtureCount} 肢は除外（含めるなら --include-fixture）`)
}

const outDir = opts.out ?? DEFAULT_OUT
const registryPath = join(outDir, 'index.ts')
let registry = readFileSync(existsSync(registryPath) ? registryPath : join(DEFAULT_OUT, 'index.ts'), 'utf8')
const targets = SHAROUSHI_SUBJECTS.filter(s => items.some(r => r.study_subject === s.id))
if (targets.length === 0) {
  console.log('索引にする肢がありません（何も書きません）')
  process.exit(0)
}

for (const subject of targets) {
  const chapters = buildSubjectChapters(items.filter(r => r.study_subject === subject.id), subject)
  const file = join(outDir, `${subject.id}.ts`)
  const content = renderSubjectFile(subject, chapters)
  const n = chapters.reduce((a, c) => a + c.totalCount, 0)
  console.log(`${subject.name}（${subject.id}）: 肢 ${n} / 章（論点）${chapters.length} → ${file}`)
  for (const c of chapters) console.log(`    ${c.code} ${c.name}: ${c.totalCount}`)
  registry = addToRegistry(registry, subject.id)
  if (!opts.dryRun) {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(file, content)
  }
}

if (opts.dryRun) {
  console.log('（dry-run）ファイルは書いていません。registry の追記後の内容:')
  console.log(registry)
} else {
  writeFileSync(registryPath, registry)
  console.log(`✓ registry を更新: ${registryPath}`)
  if (opts.includeFixture && fixtureCount > 0) console.log('⚠ フィクスチャを含む索引です。コミットしないこと（git checkout -- src/data/sharoushi/subjects で戻す）')
}
