// scripts/license/*.mjs の共通部品（licensehub-expansion.md PR-J1a）。
// 検証・変換・索引の生成は src/lib/license/ingest/*.ts の純関数を Node の型除去で直接読む
// （アプリとスクリプトで規則を二重に持たない）。Supabase と認証情報は DB に触るときだけ読み込むので、
// --dry-run は認証情報なしで動く。
import { readFileSync } from 'node:fs'

export function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// 単純な引数解析。spec: { '--data': 'data', '--dry-run': true（値なし） }
export function parseArgs(argv, spec, help) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { console.log(help); process.exit(0) }
    const key = spec[a]
    if (key === undefined) fail(`不明な引数: ${a}（--help で使い方を表示）`)
    if (key.endsWith('?')) opts[key.slice(0, -1)] = true
    else {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) fail(`${a} に値がありません`)
      opts[key] = v
    }
  }
  return opts
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    fail(`${path} の読み込み・JSON解析に失敗: ${e.message}`)
  }
}

// 認証情報が「キーそのもの」ではなく「キーの書式を説明したプレースホルダ」になっていることが
// 実際にあった。この状態で走らせると undici が Authorization ヘッダを組み立てられず
//   TypeError: Cannot convert argument to a ByteString …
// という原因の分からない例外になるので、HTTPヘッダに載せられない値は先に弾く。
const HEADER_SAFE = /^[!-~]+$/ // 空白・制御文字・非ASCIIを含まない可視ASCIIのみ
const PLACEHOLDER = /^<|>$|your[-_]|xxxx|ここに|＜|＞/i

function assertSupabaseCredentials() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const where = '.env（.gitignore 済み）か実行環境の環境変数'
  if (!url || !key) {
    fail(`SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を ${where} で指定してください（雛形は .env.example）。`)
  }
  try {
    if (new URL(url).protocol !== 'https:') throw new Error('https ではない')
  } catch {
    fail(`SUPABASE_URL が URL として読めません。https://<project-ref>.supabase.co の形で ${where} に設定してください。`)
  }
  if (!HEADER_SAFE.test(key) || PLACEHOLDER.test(key)) {
    // 値そのものは出さない（秘密情報なので）。何が問題かだけを示す。
    const reasons = []
    if (!HEADER_SAFE.test(key)) reasons.push('空白・全角文字・記号など、HTTPヘッダに載せられない文字が含まれている')
    if (PLACEHOLDER.test(key)) reasons.push('プレースホルダ（説明文・雛形）のまま置き換えられていない')
    fail([
      'SUPABASE_SERVICE_ROLE_KEY がキーの値になっていません。',
      `  検出した問題: ${reasons.join(' / ')}（長さ ${key.length}）`,
      '  Supabase ダッシュボード → Project Settings → API Keys の secret key（sb_secret_… ）を',
      `  引用符・括弧・説明文を付けずにそのまま ${where} へ貼り直してください。`,
    ].join('\n'))
  }
  return { url, key }
}

// service key は .env（.gitignore 済み）から読む。
export async function createSupabase() {
  const { url, key } = assertSupabaseCredentials()
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 書き込み先の利用者。service key は RLS を bypass し auth.uid() が無いので、user_id を明示する。
// --user → 環境変数 LICENSE_USER_ID → Auth の利用者が1人だけならその人、の順。
export async function resolveUserId(supabase, explicit) {
  const given = explicit ?? process.env.LICENSE_USER_ID
  if (given) {
    if (!UUID_RE.test(given)) fail(`user_id が UUID の形式ではありません: ${given}`)
    return given
  }
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 2 })
  if (error) fail(`利用者の一覧を取得できません: ${error.message}（--user <uuid> で指定してください）`)
  if (data.users.length !== 1) {
    fail(`利用者が1人ではありません（${data.users.length}人以上）。--user <uuid> または LICENSE_USER_ID で指定してください。`)
  }
  return data.users[0].id
}

export function chunk(xs, size) {
  const out = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

// 1,000 行ずつ全件を読む（PostgREST の既定上限を超えても欠けないように）。
export async function selectAll(build) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) fail(`読み出しに失敗: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
