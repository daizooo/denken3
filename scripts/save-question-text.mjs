#!/usr/bin/env node
// scripts/fetch-question-images.mjs で取得した画像をもとに、Claude Code セッション自身が
// 書き起こした結果を src/data/questionText/<chapter>.ts へ保存する（docs/question-text-ocr.md）。
//
// 使い方:
//   node scripts/save-question-text.mjs --chapter ac1 --data /path/to/ac1-text.json
//
//   --chapter <code>   対象の章（例: ac1）。必須
//   --data <path>      書き起こし結果のJSONファイル。保存する問題だけを含める:
//                       { "<question_id>": { "prompt": "...", "choices": ["...", ...],
//                         "answer": 3, "explanation": "..." }, ... }
//   --dry-run          ファイルへ書き込まず、検証結果だけ表示する
//   --help             この使い方を表示
//
// 図が無いと解けない問題・書き起こしに自信が持てない問題は、そもそも --data に含めない
// （書き起こしの可否は Claude Code セッション側の判断に任せる）。
import { readFileSync } from 'node:fs'
import { CHAPTER_META, loadExistingText, writeChapterFile, textFilePath, validate } from './lib/question-text-io.mjs'

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const HELP = `usage: node scripts/save-question-text.mjs --chapter <code> --data <path> [options]

  --chapter <code>   対象の章（例: ac1）。必須
  --data <path>      書き起こし結果のJSONファイル。必須
  --dry-run          ファイルへ書き込まず、検証結果だけ表示する
  --help             この使い方を表示`

function parseArgs(argv) {
  const opts = { chapter: null, data: null, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0) }
    else if (a === '--chapter') opts.chapter = argv[++i]
    else if (a === '--data') opts.data = argv[++i]
    else if (a === '--dry-run') opts.dryRun = true
    else fail(`不明な引数: ${a}（--help で使い方を表示）`)
  }
  if (!opts.chapter) fail('--chapter が必須です（--help で使い方を表示）')
  if (!CHAPTER_META[opts.chapter]) {
    fail(`未知の章: ${opts.chapter}（対象: ${Object.keys(CHAPTER_META).join(', ')}）`)
  }
  if (!opts.data) fail('--data が必須です（--help で使い方を表示）')
  return opts
}

function main() {
  const opts = parseArgs(process.argv.slice(2))

  let data
  try {
    data = JSON.parse(readFileSync(opts.data, 'utf8'))
  } catch (e) {
    fail(`${opts.data} の読み込み・JSON解析に失敗: ${e.message}`)
  }

  const existing = loadExistingText(opts.chapter)
  const results = { ...existing }
  const rejected = []
  let added = 0

  for (const [id, entry] of Object.entries(data)) {
    const problem = validate(entry)
    if (problem) {
      rejected.push({ id, reason: problem })
      continue
    }
    results[id] = { prompt: entry.prompt, choices: entry.choices, answer: entry.answer, explanation: entry.explanation }
    added++
    console.log(`✓ ${id}: 保存対象`)
  }

  if (rejected.length > 0) {
    console.log(`\n検証エラーで除外: ${rejected.length}問`)
    for (const r of rejected) console.log(`  - ${r.id}: ${r.reason}`)
  }

  if (added === 0) {
    console.log('\n保存対象がありませんでした。')
    return
  }

  if (opts.dryRun) {
    console.log(`\n--dry-run のため ${textFilePath(opts.chapter)} には書き込みません（${added}問が対象）。`)
    return
  }

  writeChapterFile(opts.chapter, results)
  console.log(`\n${textFilePath(opts.chapter)} を更新しました（新規/更新 ${added}問）`)
}

main()
