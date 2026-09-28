#!/usr/bin/env node
// 会社向けテキスト転記の元になる問題画像を、Supabase からローカルへ取得するだけのツール。
//
// 書き起こし（Vision）はこのスクリプトでは行わない。課金が発生するAnthropic APIキーを使わず、
// このスクリプトを動かしている Claude Code セッション自身が画像を読んで書き起こし、
// npm run save-question-text で保存する（docs/question-text-ocr.md）。
//
// 使い方:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npm run fetch-question-images -- --chapter ac1
//
//   --chapter <code>   対象の章（例: ac1）。必須
//   --question <id>    特定の問題だけ取得する（複数指定可）。省略時は章内の memory 問題全部
//   --force            既にテキスト化済みの問題も対象にする
//   --limit <n>        1回で取得する問題数の上限（既定20）
//   --out <dir>        画像の保存先（既定: OSの一時ディレクトリ配下）。非公開画像なので
//                       リポジトリ配下には保存しない・コミット対象に絶対含めない
//   --help             この使い方を表示
//
// 必要な環境変数:
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY … 画像のダウンロード用（非公開バケット。RLSをbypass）
//
// 注意: プロキシ必須の環境（Claude Code on the web のリモート実行環境など）では、
// Node の組み込み fetch が HTTPS_PROXY を見ないため NODE_USE_ENV_PROXY=1 を付けて起動する。
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { tmpdir } from 'node:os'
import { createSupabase, selectAssets, downloadImage, authHint, proxyHint, fail } from './lib/ocr-lines.mjs'
import { CHAPTER_META, loadQuestions, loadExistingText } from './lib/question-text-io.mjs'

const HELP = `usage: node scripts/fetch-question-images.mjs --chapter <code> [options]

  --chapter <code>   対象の章（例: ac1）。必須
  --question <id>    特定の問題だけ取得する（複数指定可）。省略時は章内の memory 問題全部
  --force            既にテキスト化済みの問題も対象にする
  --limit <n>        1回で取得する問題数の上限（既定20）
  --out <dir>        画像の保存先（既定: OSの一時ディレクトリ配下）
  --help             この使い方を表示

環境変数: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`

// 書き起こしの方針（Claude Code セッションが画像を読むときに従う規約。docs/question-text-ocr.md）。
const TRANSCRIBE_GUIDE = `
書き起こしの方針:
- 数式・単位・ギリシャ文字は文字表記にする（例: Ω, μF, 10^-3, √3, cosθ, R1）。
- 選択肢は画像にある順序のまま、印刷されている数だけ書き出す。
- answer は正答の選択肢番号（1始まりの整数）。explanation は解説文を要約せず書き起こす。
- 図（回路図・グラフ・波形図）がないと解けない問題、書き起こしに自信が持てない問題は、
  --data に含めない（保存対象から外す＝ボタンが出ない＝自宅で画像を見て解く運用に残る）。

--data に渡すJSONの形（保存する問題だけを含める）:
  { "<question_id>": { "prompt": "...", "choices": ["...", "...", "...", "...", "..."],
                        "answer": 3, "explanation": "..." }, ... }
`

function parseArgs(argv) {
  const opts = { chapter: null, questionIds: [], force: false, limit: 20, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0) }
    else if (a === '--chapter') opts.chapter = argv[++i]
    else if (a === '--question') opts.questionIds.push(argv[++i])
    else if (a === '--force') opts.force = true
    else if (a === '--limit') opts.limit = Math.max(1, Number(argv[++i]) || 1)
    else if (a === '--out') opts.out = argv[++i]
    else fail(`不明な引数: ${a}（--help で使い方を表示）`)
  }
  if (!opts.chapter) fail('--chapter が必須です（--help で使い方を表示）')
  if (!CHAPTER_META[opts.chapter]) {
    fail(`未知の章: ${opts.chapter}（対象: ${Object.keys(CHAPTER_META).join(', ')}）`)
  }
  return opts
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const supabase = await createSupabase()
  const meta = CHAPTER_META[opts.chapter]

  const questions = loadQuestions(opts.chapter)
  const existing = loadExistingText(opts.chapter)

  let targets = questions.filter(q => q.studyMode === 'memory')
  if (opts.questionIds.length > 0) {
    const wanted = new Set(opts.questionIds)
    targets = targets.filter(q => wanted.has(q.id))
  }
  if (!opts.force) targets = targets.filter(q => !(q.id in existing))
  if (targets.length > opts.limit) {
    console.log(`対象 ${targets.length}問 のうち先頭 ${opts.limit}問 だけ取得します（--limit で変更可）`)
    targets = targets.slice(0, opts.limit)
  }
  if (targets.length === 0) {
    console.log('対象の問題がありません（すでに全問テキスト化済み、または --question の指定が一致しませんでした）')
    return
  }
  console.log(`対象: ${targets.length}問（${meta.name}）`)

  // 章内の全画像行を1回で取得し、question_id ごとに group する（1問ずつ問い合わせない）。
  const rows = await selectAssets(supabase, {
    pathLike: `%/theory/${opts.chapter}/%`,
    columns: 'question_id, storage_path, region, sort',
  })
  const rowsByQuestion = new Map()
  for (const r of rows) {
    if (!rowsByQuestion.has(r.question_id)) rowsByQuestion.set(r.question_id, [])
    rowsByQuestion.get(r.question_id).push(r)
  }

  const outDir = opts.out ?? join(tmpdir(), 'denken3-question-text', opts.chapter)
  mkdirSync(outDir, { recursive: true })

  const manifest = { chapter: opts.chapter, chapterName: meta.name, generatedAt: new Date().toISOString(), questions: [] }
  const skipped = []

  for (const q of targets) {
    const assetRows = (rowsByQuestion.get(q.id) ?? []).slice().sort((a, b) => a.sort - b.sort)
    if (assetRows.length === 0) {
      console.log(`⬜ ${q.id}: 画像が未取り込み（denken_question_assets に無し）`)
      skipped.push({ id: q.id, reason: '画像未取り込み' })
      continue
    }

    let images
    try {
      images = await Promise.all(assetRows.map(r => downloadImage(supabase, r.storage_path)))
    } catch (e) {
      console.log(`✗ ${q.id}: 画像取得失敗 - ${e.message}${authHint(e.message)}${proxyHint(e.message)}`)
      skipped.push({ id: q.id, reason: '画像取得失敗' })
      continue
    }

    const region = assetRows[0].region
    const regionHint = region === 'top'
      ? 'この画像には2問収録されています。書き起こすのは「上半分」の問題です。下半分は別の問題なので無視してください。'
      : region === 'bottom'
        ? 'この画像には2問収録されています。書き起こすのは「下半分」の問題です。上半分は別の問題なので無視してください。'
        : ''

    const imagePaths = images.map((img, i) => {
      const ext = extname(img.name) || '.png'
      const path = join(outDir, `${q.id}__${i}${ext}`)
      writeFileSync(path, img.buffer)
      return path
    })

    manifest.questions.push({ id: q.id, number: q.number, title: q.title, regionHint, images: imagePaths })
    console.log(`✓ ${q.id}: 画像${imagePaths.length}枚を取得`)
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log(`\n画像を ${outDir} に保存しました（manifest.json あり）。`)
  console.log(`次のステップ: manifest.json の各問題について画像を読み、書き起こしJSONを組み立てて`)
  console.log(`  npm run save-question-text -- --chapter ${opts.chapter} --data <path>`)
  console.log('で保存してください。')
  console.log(TRANSCRIBE_GUIDE)

  if (skipped.length > 0) {
    console.log(`対象外・失敗: ${skipped.length}問`)
    for (const s of skipped) console.log(`  - ${s.id}: ${s.reason}`)
  }
}

main()
