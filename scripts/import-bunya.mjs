#!/usr/bin/env node
// 分野別（オーム社 章別）画像の一括取り込みスクリプト（docs/problem-data-integration.md §5-2）。
//
// 背景:
// 分野別の投入は「章フォルダ数十枚を一度に入れる」バッチ作業で、アプリの取り込みパネルへ
// 1枚ずつ落とす運用ではない。§5-2 はこれを移行スクリプトの仕事と定めていたが、
// スクリプト自体は「1回限り」としてリポジトリに残されず、章を追加しようとするたびに
// 手段が無い状態になっていた。電子理論・電子回路が未投入のまま残ったのはこれが原因なので、
// 取り込み経路そのものを常設する。
//
// やること（章単位・冪等）:
//   1. 手元の章フォルダを列挙し、各ファイルを src/data/{chapter}Assets.ts の正規名へ解決する
//      （`問13.png` / `問13-2.png` / 旧命名 `newIMG_0550.png` のいずれでも可）。
//   2. 解決できたものを denken-problems/{uid}/theory/{chapter}/{正規名} へ put。
//   3. denken_question_assets へ upsert（region/sort/answer_x_pct/answer_y_pct/
//      answer_right_y_pct/region_y_pct はマッピングの値をそのまま入れる）。
//   4. 捨て問・奥付・章違い・想定外の命名はスキップし、最後に理由付きで一覧する。
//
// 使い方:
//   # まず中身を確認（Supabaseへ一切触らない。認証情報も不要）
//   npm run import-bunya -- --chapter etheory --dir ./⑧電子理論 --dry-run
//
//   # 実投入
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import-bunya -- --chapter etheory --dir ./⑧電子理論 --user <uid>
//
// --user は投入先の user_id（Storage パスの先頭フォルダ＝所有者）。省略時は
// denken_question_assets に既にある user_id が1人だけならそれを使う。
//
// 注意: プロキシ必須の環境（Claude Code on the web のリモート実行環境など）では、
// Node の組み込み fetch が HTTPS_PROXY を見ないため NODE_USE_ENV_PROXY=1 を付けて起動する。
import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertSupabaseCredentials, authHint } from './lib/ocr-lines.mjs'
// 解決規則はアプリ（ImportPanel）と同じ実装を使う。型以外を import しないので
// Node の TypeScript 型剥がしでそのまま読める（tsconfig の erasableSyntaxOnly と対）。
import { resolveBunyaFile } from '../src/lib/bunyaFilename.ts'

const BUCKET = 'denken-problems'
const DATA_DIR = resolve(fileURLToPath(new URL('../src/data', import.meta.url)))
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg'])

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// ---- CLI ----------------------------------------------------------------
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const chapter = flag('--chapter')
const dir = flag('--dir')
const userArg = flag('--user')
const dryRun = args.includes('--dry-run')

if (!chapter || !dir) {
  fail([
    '--chapter と --dir を指定してください。',
    '  例: npm run import-bunya -- --chapter etheory --dir ./⑧電子理論 --dry-run',
  ].join('\n'))
}

// ---- 章のマッピングを読む -------------------------------------------------
// 章コードは src/data/{chapter}Assets.ts のファイル名規約から引く。ここに一覧を持たないので、
// 章を追加しても（*Assets.ts を置くだけで）このスクリプトの修正は要らない。
async function loadChapterMap(code) {
  const files = await readdir(DATA_DIR)
  const known = files
    .filter(f => f.endsWith('Assets.ts'))
    .map(f => f.slice(0, -'Assets.ts'.length))
    .sort()
  if (!known.includes(code)) {
    fail(`章コード "${code}" のマッピングがありません（src/data/${code}Assets.ts が無い）。\n  指定できる章: ${known.join(' / ')}`)
  }
  const mod = await import(join(DATA_DIR, `${code}Assets.ts`))
  const map = mod[`${code.toUpperCase()}_ASSETS`]
  if (!map) fail(`src/data/${code}Assets.ts が ${code.toUpperCase()}_ASSETS を export していません。`)
  return map
}

const map = await loadChapterMap(chapter)

// ---- 手元のフォルダを解決する ---------------------------------------------
let entries
try {
  entries = await readdir(resolve(dir), { withFileTypes: true })
} catch (e) {
  fail(`フォルダを読めません: ${resolve(dir)}（${e.message}）`)
}
const files = entries
  .filter(e => e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase()))
  .map(e => e.name)
  .sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }))

if (files.length === 0) fail(`画像ファイルが1枚もありません: ${resolve(dir)}`)

const planned = []
const skipped = []
const seen = new Map() // 正規名 -> 元ファイル名（同じ画像へ二重に解決していないか見る）
for (const name of files) {
  const hit = resolveBunyaFile(chapter, map, name)
  if (!hit) { skipped.push(name); continue }
  if (seen.has(hit.canonicalName)) {
    fail(`${name} と ${seen.get(hit.canonicalName)} が同じ ${hit.canonicalName} に解決されました。フォルダの中身を確認してください。`)
  }
  seen.set(hit.canonicalName, name)
  planned.push({ name, ...hit })
}

const expected = Object.keys(map).length
console.log(`章: ${chapter} ／ フォルダ: ${resolve(dir)}`)
console.log(`画像 ${files.length} 枚 → 取り込み対象 ${planned.length} 件 / スキップ ${skipped.length} 件（マッピング全体は ${expected} 件）`)
if (skipped.length > 0) {
  console.log(`\nスキップ（捨て問・奥付・対象外の命名）:\n  ${skipped.join('\n  ')}`)
}
const missing = Object.keys(map).filter(n => !seen.has(n))
if (missing.length > 0) {
  console.log(`\n⚠ マッピングにあるのにフォルダで見つからなかった画像 ${missing.length} 件:\n  ${missing.join('\n  ')}`)
}
for (const p of planned) {
  if (p.canonicalName !== p.name) console.log(`  ${p.name} → ${p.canonicalName}`)
}

if (dryRun) {
  console.log('\n--dry-run のため Supabase へは書き込みませんでした。')
  process.exit(missing.length > 0 ? 1 : 0)
}

// ---- 投入 ----------------------------------------------------------------
const { url, key } = assertSupabaseCredentials()
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// 接続先が本当にこのアプリのプロジェクトかを、1枚も上げる前に確かめる。
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は別プロジェクトのものが入っていることがあり
// （実際に取り違えた環境変数を踏んだ）、そのまま走ると他プロジェクトへ書きに行ってしまう。
const projectRef = (process.env.SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\./) ?? [])[1] ?? '(不明)'
async function preflight() {
  const problems = []
  const { error: be } = await supabase.storage.getBucket(BUCKET)
  if (be) problems.push(`バケット ${BUCKET} が見つからない（${be.message}）`)
  const { data, error: te } = await supabase.from('denken_question_assets').select('user_id').limit(1000)
  if (te) problems.push(`テーブル denken_question_assets が見つからない（${te.message}）`)
  if (problems.length > 0) {
    fail([
      `接続先プロジェクト ${projectRef} はこのアプリのプロジェクトではないようです:`,
      ...problems.map(x => `  - ${x}`),
      '  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が別プロジェクトのものになっていないか確認してください。',
    ].join('\n'))
  }
  return data ?? []
}
const existing = await preflight()
console.log(`接続先プロジェクト: ${projectRef}`)

// 投入先の user_id。明示指定が無ければ、既存データの user_id が1人だけのときのみ自動で使う
// （複数いる場合に取り違えて他人の領域へ書かないよう、必ず止める）。
function resolveUserId() {
  if (userArg) return userArg
  const ids = [...new Set(existing.map(r => r.user_id))]
  if (ids.length === 1) return ids[0]
  fail(`--user で投入先の user_id を指定してください（既存データから一意に決められません: ${ids.length} 件）。`)
}
const userId = resolveUserId()
console.log(`投入先 user_id: ${userId}`)

// 取り込み時に DB へ書く answer_x_pct（src/lib/assets.ts の defaultAnswerXPct と同じ既定）。
const answerXPctOf = (r) => r.answerXPct ?? (r.sort > 0 ? 0 : 50)

let uploaded = 0, rows = 0, failed = 0
for (const p of planned) {
  const path = `${userId}/theory/${chapter}/${p.canonicalName}`
  const body = await readFile(join(resolve(dir), p.name))
  const up = await supabase.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType: extname(p.name).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
  })
  if (up.error) {
    console.error(`✗ ${p.name}: ${up.error.message}${authHint(up.error.message)}`); failed++
    continue
  }
  uploaded++

  const insertRows = p.refs.map(r => ({
    user_id: userId,
    question_id: r.questionId,
    storage_path: path,
    region: r.region,
    sort: r.sort,
    answer_x_pct: answerXPctOf(r),
    answer_y_pct: r.answerYPct ?? 100,
    answer_right_y_pct: r.answerRightYPct ?? 0,
    region_y_pct: r.regionYPct ?? 50,
  }))
  const ins = await supabase
    .from('denken_question_assets')
    .upsert(insertRows, { onConflict: 'user_id,question_id,storage_path,sort' })
  if (ins.error) {
    console.error(`✗ ${p.name} 登録失敗: ${ins.error.message}`); failed++
  } else {
    rows += insertRows.length
  }
  if (uploaded % 10 === 0) console.log(`  ... ${uploaded}/${planned.length}`)
}

console.log(`\n完了: 画像 ${uploaded} 枚 / 問題 ${rows} 件登録${failed ? ` / 失敗 ${failed}` : ''}`)
process.exit(failed > 0 ? 1 : 0)
