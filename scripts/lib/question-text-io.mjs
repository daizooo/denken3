// questionText チャプターファイル（src/data/questionText/<chapter>.ts）の読み書き・検証。
// scripts/fetch-question-images.mjs と scripts/save-question-text.mjs の共通部品。
//
// TypeScriptコンパイラは使わず、型注釈を除けば有効なJSであることを利用して軽量に読む
// （scripts/lib/ocr-lines.mjs と同じ「Node標準機能だけで完結させる」方針）。対象ファイルは
// import type 1行 + `export const X: T = <配列/オブジェクトリテラル>` という決まった形しか
// 取らない前提（分野別データファイル・questionText チャプターファイルの生成規約）。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')

// 章コード -> { name（日本語名） }。src/lib/assets.ts の CHAPTER_ASSET_MAPS と同じキー集合。
// 新しい章を増やしたらここへ1行足す。
export const CHAPTER_META = {
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

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// `export const <constName>: <型> = <リテラル>` の <リテラル> 部分（型注釈の後の最初の
// `=` から先、ファイル末尾まで）を取り出す。対象ファイルはこの1文だけで終わる前提。
function extractLiteral(src, constName) {
  const declIdx = src.indexOf(constName)
  if (declIdx < 0) return null
  const eqIdx = src.indexOf('=', declIdx)
  if (eqIdx < 0) return null
  return src.slice(eqIdx + 1).trim()
}

export function loadQuestions(chapterCode) {
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

export function textFilePath(chapterCode) {
  return join(REPO_ROOT, 'src/data/questionText', `${chapterCode}.ts`)
}

export function loadExistingText(chapterCode) {
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
// （このファイルの唯一の書き手は save-question-text.mjs で、章単位でしか同時実行されない・CLAUDE.md）。
function questionNumberOf(id) {
  const m = id.match(/_(\d+)$/)
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

export function writeChapterFile(chapterCode, merged) {
  const meta = CHAPTER_META[chapterCode]
  const constName = `${chapterCode.toUpperCase()}_TEXT`
  const ids = Object.keys(merged).sort((a, b) => questionNumberOf(a) - questionNumberOf(b))
  const body = ids.map(id => formatEntry(id, merged[id])).join('\n')
  const content = `// ${meta.name}（${chapterCode}）章の会社向けテキスト転記。
// scripts/fetch-question-images.mjs で画像を取得し、書き起こし結果を
// scripts/save-question-text.mjs --chapter ${chapterCode} で保存する（docs/question-text-ocr.md）。
// 手で編集する場合も、既存エントリの並び替え・削除は避け、末尾に追記する（CLAUDE.md）。
import type { QuestionText } from '../../lib/questionText'

export const ${constName}: Record<string, QuestionText> = {
${body}
}
`
  writeFileSync(textFilePath(chapterCode), content)
}

export function validate(obj) {
  if (typeof obj.prompt !== 'string' || obj.prompt.length === 0) return '問題文が空'
  if (!Array.isArray(obj.choices) || obj.choices.length < 2 || !obj.choices.every(c => typeof c === 'string' && c.length > 0)) {
    return '選択肢が不正'
  }
  if (!Number.isInteger(obj.answer) || obj.answer < 1 || obj.answer > obj.choices.length) return '正解番号が選択肢の範囲外'
  if (typeof obj.explanation !== 'string' || obj.explanation.length === 0) return '解説が空'
  return null
}
