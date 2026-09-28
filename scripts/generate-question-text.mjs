#!/usr/bin/env node
// 会社向けテキスト転記（src/data/questionText/<chapter>.ts）を、Supabase に取り込み済みの
// 問題画像から自動生成する（docs/question-text-ocr.md）。
//
// 背景:
// denken3 は問題文・選択肢・解説を画像（非公開バケット denken-problems）でのみ持ち、テキストの
// データは持っていなかった。会社では周囲の目があり画像を開けないため、暗記・概念問題
// （studyMode: 'memory'）だけをテキスト化し、メモ帳などに貼り付けて解けるようにする
// （src/lib/questionText.ts・QuestionCard の「テキストをコピー」ボタン）。
//
// 図が無いと解けない問題（回路図・グラフ必須）は、モデル自身の判定でこのスクリプトが除外する
// ―― 会社では図をまじまじと見る問題は解けないため（自己申告どおりの制約）。
// 書き起こしに自信が持てない問題も、誤った解答を混ぜないため保存せずスキップする。
//
// 使い方:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... \
//     npm run gen-question-text -- --chapter ac1
//
//   --chapter <code>   対象の章（例: ac1）。CHAPTER_ASSET_MAPS（src/lib/assets.ts）のキーと同じ
//   --question <id>    特定の問題だけ処理する（複数指定可）。省略時は章内の memory 問題全部
//   --force            既にテキスト化済みの問題も上書きしてやり直す
//   --dry-run          ファイルへ書き込まず、結果を標準出力に表示するだけ
//   --limit <n>        1回の実行で処理する問題数の上限（既定20。API課金の暴走を防ぐ）
//   --model <id>       Vision呼び出しに使うモデルID（既定 claude-sonnet-5）
//
// 必要な環境変数:
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY … 画像のダウンロード用（非公開バケット。RLSをbypass）
//   ANTHROPIC_API_KEY                        … 書き起こし（Vision）用
//
// 注意: プロキシ必須の環境（Claude Code on the web のリモート実行環境など）では、
// Node の組み込み fetch が HTTPS_PROXY を見ないため NODE_USE_ENV_PROXY=1 を付けて起動する。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabase, selectAssets, downloadImage, authHint, proxyHint, fail } from './lib/ocr-lines.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

// 章コード -> { questionsFile（MasterQuestion定義）, name（日本語名）, questionsConst, textConst }
// src/lib/assets.ts の CHAPTER_ASSET_MAPS と同じキー集合。新しい章を増やしたらここへ1行足す。
const CHAPTER_META = {
  dc:       { name: '直流回路' },
  ac1:      { name: '単相交流' },
  trans:    { name: '過渡現象' },
  ac3:      { name: '三相交流' },
  elec:     { name: '静電気' },
  mag:      { name: '電磁気' },
  meas:     { name: '電気計測' },
  etheory:  { name: '電子理論' },
  ecircuit: { name: '電子回路' },
}

const MEDIA_TYPE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

// ---- CLI -------------------------------------------------------------

const HELP = `usage: node scripts/generate-question-text.mjs --chapter <code> [options]

  --chapter <code>   対象の章（例: ac1）。必須
  --question <id>    特定の問題だけ処理する（複数指定可）。省略時は章内の memory 問題全部
  --force            既にテキスト化済みの問題も上書きしてやり直す
  --dry-run          ファイルへ書き込まず、結果を標準出力に表示するだけ
  --limit <n>        1回の実行で処理する問題数の上限（既定20）
  --model <id>       Vision呼び出しに使うモデルID（既定 claude-sonnet-5）
  --help             この使い方を表示

環境変数: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY`

function parseArgs(argv) {
  const opts = { chapter: null, questionIds: [], force: false, dryRun: false, limit: 20, model: 'claude-sonnet-5' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0) }
    else if (a === '--chapter') opts.chapter = argv[++i]
    else if (a === '--question') opts.questionIds.push(argv[++i])
    else if (a === '--force') opts.force = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--limit') opts.limit = Math.max(1, Number(argv[++i]) || 1)
    else if (a === '--model') opts.model = argv[++i]
    else fail(`不明な引数: ${a}（--help で使い方を表示）`)
  }
  if (!opts.chapter) fail('--chapter が必須です（--help で使い方を表示）')
  if (!CHAPTER_META[opts.chapter]) {
    fail(`未知の章: ${opts.chapter}（対象: ${Object.keys(CHAPTER_META).join(', ')}）`)
  }
  return opts
}

// ---- MasterQuestion 定義の読み込み（.ts を軽量パースする） --------------
//
// TypeScript コンパイラは使わない。このリポジトリのメンテナンススクリプトは一貫して
// 「Node標準機能だけで完結させる」方針（scripts/lib/ocr-lines.mjs 参照）で、対象ファイルは
// 型注釈だけを除けば有効なJSなので、その方針に合わせる。
// 対象ファイルは import type 1行 + `export const X: T = <配列/オブジェクトリテラル>` という
// 決まった形しか取らない前提（分野別データファイルの生成規約）。

// `export const <constName>: <型> = <リテラル>` の <リテラル> 部分（型注釈の後の最初の
// `=` から先、ファイル末尾まで）を取り出す。対象ファイルはこの1文だけで終わる前提
// （分野別データファイル・questionText チャプターファイルの生成規約）。
function extractLiteral(src, constName) {
  const declIdx = src.indexOf(constName)
  if (declIdx < 0) return null
  const eqIdx = src.indexOf('=', declIdx)
  if (eqIdx < 0) return null
  return src.slice(eqIdx + 1).trim()
}

function loadQuestions(chapterCode) {
  const filePath = join(REPO_ROOT, 'src/data/denken3/riron/ohmsha-bunya', `${chapterCode}.ts`)
  if (!existsSync(filePath)) fail(`MasterQuestion定義が見つかりません: ${filePath}`)
  const src = readFileSync(filePath, 'utf8')
  const constName = `${chapterCode.toUpperCase()}_QUESTIONS`
  const literal = extractLiteral(src, constName)
  if (!literal) fail(`${filePath} から ${constName} を抽出できませんでした（想定外のファイル形式）`)
  try {
    // eslint-disable-next-line no-new-func -- 自リポジトリが生成した定数リテラルのみを評価する
    return new Function(`return (${literal})`)()
  } catch (e) {
    fail(`${filePath} の解析に失敗: ${e.message}`)
  }
}

// ---- questionText チャプターファイルの読み書き ---------------------------

function textFilePath(chapterCode) {
  return join(REPO_ROOT, 'src/data/questionText', `${chapterCode}.ts`)
}

function loadExistingText(chapterCode) {
  const filePath = textFilePath(chapterCode)
  if (!existsSync(filePath)) return {}
  const src = readFileSync(filePath, 'utf8')
  const constName = `${chapterCode.toUpperCase()}_TEXT`
  const literal = extractLiteral(src, constName)
  if (!literal) return {}
  try {
    // eslint-disable-next-line no-new-func -- 自スクリプトが生成した定数リテラルのみを評価する
    return new Function(`return (${literal})`)()
  } catch (e) {
    fail(`${filePath} の既存データを解析できませんでした: ${e.message}`)
  }
}

function jsString(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function formatEntry(id, t) {
  const key = IDENTIFIER.test(id) ? id : jsString(id)
  const choices = `[${t.choices.map(jsString).join(', ')}]`
  return `  ${key}: { prompt: ${jsString(t.prompt)}, choices: ${choices}, answer: ${t.answer}, explanation: ${jsString(t.explanation)} },`
}

// 問題番号順（id末尾の数字）に並べる。自動生成ファイルなので並び替えを気にする必要はない
// （このファイルの唯一の書き手は本スクリプトで、章単位でしか同時実行されない・CLAUDE.md）。
function questionNumberOf(id) {
  const m = id.match(/_(\d+)$/)
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

function writeChapterFile(chapterCode, merged) {
  const meta = CHAPTER_META[chapterCode]
  const constName = `${chapterCode.toUpperCase()}_TEXT`
  const ids = Object.keys(merged).sort((a, b) => questionNumberOf(a) - questionNumberOf(b))
  const body = ids.map(id => formatEntry(id, merged[id])).join('\n')
  const content = `// ${meta.name}（${chapterCode}）章の会社向けテキスト転記。
// scripts/generate-question-text.mjs --chapter ${chapterCode} が画像から自動生成する。
// 手で編集する場合も、既存エントリの並び替え・削除は避け、末尾に追記する（CLAUDE.md）。
import type { QuestionText } from '../../lib/questionText'

export const ${constName}: Record<string, QuestionText> = {
${body}
}
`
  writeFileSync(textFilePath(chapterCode), content)
}

// ---- Vision 抽出 ----------------------------------------------------------

// 書き起こしプロンプト。JSON以外を一切出させないことで、パース失敗＝品質不明のデータを
// 混入させないようにする（不確実なら uncertain を立てさせ、こちら側で捨てる）。
function buildPrompt({ chapterName, number, title, regionHint }) {
  return `あなたは電験三種（電気主任技術者試験）の過去問画像を、テキストデータへ書き起こすアシスタントです。

対象: ${chapterName} 問${number}「${title}」
添付の画像は、この問題が印刷された見開き（またはページ）のスキャンです。通常は左側に問題文・
選択肢、右側に正解と解説があります。複数枚ある場合は、左から右・上から下の順に並んでいます。
${regionHint}

次を、画像に書かれている内容だけを根拠に、日本語で正確に書き起こしてください。憶測や一般知識で
補わないでください。

- 数式・単位・ギリシャ文字は文字表記にする（例: Ω, μF, 10^-3, √3, cosθ, R1）。
- 図（回路図・グラフ・波形図）がないと問題文だけでは解けない場合は "requiresDiagram": true にする
  （このときも choices・answer・explanation は分かる範囲で埋めてよい）。
- 選択肢は画像にある順序のまま、5つとも書き出す。
- answer は右側に印刷されている正答の選択肢番号（1〜5の整数）。
- explanation は右側の解説文を、要約せず書き起こす。
- 文字が潰れている・複数の読み方があり得るなど、書き起こしに自信が持てない箇所が1つでもあれば
  "uncertain": true にする（無理に埋めない）。

次のJSON形式のみを出力してください。前後に説明文・コードブロックの \`\`\` を付けないでください:
{"prompt": "問題文", "choices": ["選択肢1","選択肢2","選択肢3","選択肢4","選択肢5"], "answer": 3, "explanation": "解説文", "requiresDiagram": false, "uncertain": false}`
}

function parseModelJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  return JSON.parse(trimmed)
}

function validate(obj) {
  if (typeof obj.prompt !== 'string' || obj.prompt.length === 0) return '問題文が空'
  if (!Array.isArray(obj.choices) || obj.choices.length < 2 || !obj.choices.every(c => typeof c === 'string' && c.length > 0)) {
    return '選択肢が不正'
  }
  if (!Number.isInteger(obj.answer) || obj.answer < 1 || obj.answer > obj.choices.length) return '正解番号が選択肢の範囲外'
  if (typeof obj.explanation !== 'string' || obj.explanation.length === 0) return '解説が空'
  return null
}

// ---- メイン ----------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!process.env.ANTHROPIC_API_KEY) fail('ANTHROPIC_API_KEY が未設定です（.env か実行環境の環境変数で指定してください）')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
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
    console.log(`対象 ${targets.length}問 のうち先頭 ${opts.limit}問 だけ処理します（--limit で変更可）`)
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

  const results = { ...existing }
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
      ? 'この画像には2問収録されています。あなたが書き起こすのは「上半分」の問題です。下半分は別の問題なので無視してください。'
      : region === 'bottom'
        ? 'この画像には2問収録されています。あなたが書き起こすのは「下半分」の問題です。上半分は別の問題なので無視してください。'
        : ''

    const prompt = buildPrompt({ chapterName: meta.name, number: q.number, title: q.title, regionHint })
    const content = [
      ...images.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: MEDIA_TYPE[extname(img.name).toLowerCase()] ?? 'image/png',
          data: img.buffer.toString('base64'),
        },
      })),
      { type: 'text', text: prompt },
    ]

    let parsed
    try {
      const message = await anthropic.messages.create({
        model: opts.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content }],
      })
      const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
      parsed = parseModelJson(text)
    } catch (e) {
      console.log(`✗ ${q.id}: Vision呼び出し/JSON解析に失敗 - ${e.message}`)
      skipped.push({ id: q.id, reason: 'Vision呼び出し失敗' })
      continue
    }

    if (parsed.requiresDiagram) {
      console.log(`🖼 ${q.id}: 図が必要なため対象外`)
      skipped.push({ id: q.id, reason: '図が必要' })
      continue
    }
    if (parsed.uncertain) {
      console.log(`❓ ${q.id}: 書き起こしに自信が持てないため対象外（目視確認して --question で再実行を推奨）`)
      skipped.push({ id: q.id, reason: '自信不足' })
      continue
    }
    const problem = validate(parsed)
    if (problem) {
      console.log(`✗ ${q.id}: 出力形式が不正（${problem}）`)
      skipped.push({ id: q.id, reason: `形式不正: ${problem}` })
      continue
    }

    results[q.id] = {
      prompt: parsed.prompt,
      choices: parsed.choices,
      answer: parsed.answer,
      explanation: parsed.explanation,
    }
    console.log(`✓ ${q.id}: 書き起こし完了`)
  }

  const addedCount = Object.keys(results).length - Object.keys(existing).length
  if (opts.dryRun) {
    console.log('\n--dry-run のためファイルには書き込みません。')
    console.log(JSON.stringify(results, null, 2))
  } else if (addedCount > 0 || opts.force) {
    writeChapterFile(opts.chapter, results)
    console.log(`\n${textFilePath(opts.chapter)} を更新しました（新規/更新 ${addedCount}問）`)
  } else {
    console.log('\n新規に書き込む内容がありませんでした。')
  }

  if (skipped.length > 0) {
    console.log(`\n対象外・失敗: ${skipped.length}問`)
    for (const s of skipped) console.log(`  - ${s.id}: ${s.reason}`)
  }
}

main()
