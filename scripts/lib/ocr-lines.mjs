// 画像OCRの共通部品（メンテナンススクリプト専用・アプリのバンドルには入らない）。
//
// scripts/detect-bunya-layout.mjs が使う。scripts/detect-mask-pcts.mjs（PR#101）は
// 同等の処理を自前で持っているが、あちらは変更しない——マージ済みの他PRのファイルを
// 触るとコンフリクトの窓が開くため（CLAUDE.md「変更は狭く・小さく・単機能に閉じる」）。
// detect-mask-pcts.mjs を次に編集するときにここへ寄せるのが望ましい。
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createWorker } from 'tesseract.js'

export const BUCKET = 'denken-problems'

// tesseract.js の言語データ。CDN（jsdelivr）任せにせず npm 依存として固定し、
// オフラインでも・将来データが差し替わっても同じ結果が出るようにする（detect-mask-pcts と同じ既定）。
const TRAINEDDATA_VARIANT = process.env.DETECT_TRAINEDDATA ?? '4.0.0_best_int'

export function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// ---- 画像サイズ ----------------------------------------------------------
// Y/X座標を%へ直すには画像の幅と高さが要る。PNG/JPEGのヘッダを読むだけで足りるので、
// 画像デコードライブラリは入れない（依存を増やさない）。

export function imageSize(buf, label) {
  // PNG: シグネチャ8バイトの直後が IHDR（長さ4+型4）。width/height は続く8バイト。
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  // JPEG: SOFn マーカ（C0-C3/C5-C7/C9-CB/CD-CF）のペイロード先頭に height/width が入る。
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      const len = buf.readUInt16BE(i + 2)
      const isSof = (marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)
      if (isSof) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) }
      i += 2 + len
    }
  }
  return fail(`${label}: 画像サイズを読めません（PNG/JPEGのみ対応）`)
}

// ---- OCRテキストの正規化 -------------------------------------------------
// 日本語OCRは文字と文字の間に空白を入れる・全角半角が揺れる・丸数字を返すことがある。
// マッチング前にこれらを潰しておかないと、見出しの検出が取りこぼす。

const CIRCLED = '⓪①②③④⑤⑥⑦⑧⑨'

export function normalize(text) {
  return text
    .normalize('NFKC')
    .replace(/[⓪①-⑨]/g, c => String(CIRCLED.indexOf(c)))
    .replace(/\s+/g, '')
}

// 見出し行の先頭には、OCRが【や罫線を読み違えた記号が乗ることがある
// （実データで確認済み: "|【ワンポイント解説】" のように2文字連続する等）。
// 数字は剥がさない——番号付きの目次行を見出しと区別できなくなるため。
const LEADING_NOISE = /^[[［「『【|(lI]{1,2}/

export function stripLeadingNoise(norm) {
  return norm.replace(LEADING_NOISE, '')
}

// ---- OCR 実行 ------------------------------------------------------------

function langPath() {
  const require = createRequire(import.meta.url)
  // package.json 経由で解決すると、node_modules の巻き上げ位置に依らず正しい場所を指せる。
  const pkg = require.resolve('@tesseract.js-data/jpn/package.json')
  return join(dirname(pkg), TRAINEDDATA_VARIANT)
}

export function traineddataVariant() {
  return TRAINEDDATA_VARIANT
}

/**
 * 画像を並列OCRし、1枚ごとに { words, size } を返す。
 * 行ではなく語を返すのは、見開きでは tesseract の行が左右のページをまたいで連結される
 * ことがあるため（rowsFromWords のコメント参照）。行が要る呼び出し側は、ページごとに
 * 語を選り分けてから rowsFromWords で組み直す。
 */
export async function ocrAll(targets, jobs, onProgress = () => {}) {
  const path = langPath()
  const workers = await Promise.all(
    Array.from({ length: Math.max(1, Math.min(jobs, targets.length)) }, () =>
      // cachePath を tmp に逃がす（既定はカレント直下に jpn.traineddata を吐きリポジトリを汚す）。
      createWorker('jpn', 1, { langPath: path, gzip: true, cachePath: join(tmpdir(), 'denken3-tesseract') })),
  )
  const queue = targets.map((t, i) => ({ t, i }))
  const results = new Array(targets.length)
  await Promise.all(workers.map(async worker => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { data } = await worker.recognize(job.t.buffer, {}, { blocks: true })
      const rawLines = (data.blocks ?? []).flatMap(b => (b.paragraphs ?? []).flatMap(p => p.lines ?? []))
      results[job.i] = { size: imageSize(job.t.buffer, job.t.name), words: toWords(rawLines) }
      onProgress()
    }
  }))
  await Promise.all(workers.map(w => w.terminate()))
  return results
}

function toWords(rawLines) {
  return rawLines
    .flatMap(l => l.words ?? [])
    .map(w => ({ x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, conf: w.confidence, text: w.text ?? '' }))
    .filter(w => normalize(w.text).length > 0)
}

/**
 * 語の外接矩形から行を組み直す。
 *
 * tesseract 自身の行認識は、見開きスキャンでは**左右のページをまたいで1行に連結される**
 * ことがある（合成フィクスチャで確認: 左ページの「問13 …」と右ページの「解答 (3)」が同じ行に
 * なった）。左右どちらのページの見出しかを位置で判定する処理は、これがあると成立しない。
 * 語は必ずどちらかのページに収まるので、ページごとに語を選り分けてから行を組み直す。
 *
 * 同じ行の判定は縦の重なり（語の高さの60%以上が重なる）で行う。字送りではなく行送りで
 * まとめるので、語間の空白の入り方（日本語OCRは字ごとに切ることがある）に影響されない。
 */
export function rowsFromWords(words, size) {
  const rows = []
  for (const w of [...words].sort((a, b) => a.y0 - b.y0)) {
    const last = rows.at(-1)
    const overlap = last ? Math.min(last.y1, w.y1) - Math.max(last.y0, w.y0) : 0
    if (last && overlap > (w.y1 - w.y0) * 0.6) {
      last.words.push(w)
      last.y0 = Math.min(last.y0, w.y0); last.y1 = Math.max(last.y1, w.y1)
      last.x0 = Math.min(last.x0, w.x0); last.x1 = Math.max(last.x1, w.x1)
    } else {
      rows.push({ x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1, words: [w] })
    }
  }
  return rows.map(r => {
    const text = [...r.words].sort((a, b) => a.x0 - b.x0).map(w => w.text).join(' ').trim()
    const norm = normalize(text)
    return {
      x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1,
      text, norm, stripped: stripLeadingNoise(norm),
      conf: r.words.reduce((s, w) => s + w.conf, 0) / r.words.length,
      topPct: r.y0 / size.height * 100,
      leftPct: r.x0 / size.width * 100,
    }
  }).filter(r => r.norm.length > 0)
}

// ---- Supabase ------------------------------------------------------------

// Node の組み込み fetch は HTTPS_PROXY を既定では見ない。プロキシ必須の環境
// （Claude Code on the web のリモート実行環境など）では通信が届かず fetch failed になるので、
// 気付けるようにヒントを出す。手元のPCで動かすぶんには関係しない。
export function proxyHint(message) {
  const looksNetwork = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|allowlist/i.test(message ?? '')
  if (!looksNetwork || !process.env.HTTPS_PROXY) return ''
  return '\n  ヒント: HTTPS_PROXY が設定された環境では Node の fetch がプロキシを使わない。' +
    '\n  NODE_USE_ENV_PROXY=1 を付けて再実行する。'
}

// 認証情報が「キーそのもの」ではなく「キーの書式を説明したプレースホルダ」になっていることが
// 実際にあった（`<Secret key（sb_secret_XXXX…）>` のような文字列が環境変数に入っていた）。
// この状態で走らせると、undici が Authorization ヘッダを組み立てられず
//   TypeError: Cannot convert argument to a ByteString because the character at index 11 …
// という原因の分からない例外になる。しかも OCR を回し切ったあとに出るので気付くのが遅い。
// HTTPヘッダに載せられない値は先に弾き、何をどこで直せばよいかを出す。
const HEADER_SAFE = /^[!-~]+$/ // 空白・制御文字・非ASCIIを含まない可視ASCIIのみ
const PLACEHOLDER = /^<|>$|your[-_]|xxxx|ここに|＜|＞/i

export function assertSupabaseCredentials() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const where = '.env（.gitignore 済み）か実行環境の環境変数'
  if (!url || !key) {
    fail(`SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を ${where} で指定してください（雛形は .env.example）。`)
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error('https ではない')
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
      `  Supabase ダッシュボード → Project Settings → API Keys の secret key（sb_secret_… ）を`,
      `  引用符・括弧・説明文を付けずにそのまま ${where} へ貼り直してください。`,
    ].join('\n'))
  }
  // 書式が既知のどちらでもない場合は止めない（将来キー形式が増えても動くように）。
  // 実際のリクエストで Supabase 自身がエラーを返すので、そのときの手掛かりとして出しておく。
  const known = /^sb_(secret|publishable)_/.test(key) || /^eyJ[\w-]*\.[\w-]*\./.test(key)
  if (!known) {
    console.error('⚠ SUPABASE_SERVICE_ROLE_KEY が既知の形式（sb_secret_… / JWT）ではありません。認証に失敗したらここを疑ってください。')
  }
  if (key.startsWith('sb_publishable_')) {
    console.error('⚠ publishable キーのようです。非公開バケットの読み出しには secret キー（RLS を bypass）が要ります。')
  }
  return { url, key }
}

/** 認証まわりのエラーに、原因の当たりを付けるヒントを足す */
export function authHint(message) {
  if (!/invalid api key|jwt|unauthorized|permission denied|row-level security|not authorized/i.test(message ?? '')) return ''
  return '\n  ヒント: SUPABASE_SERVICE_ROLE_KEY が secret キー（sb_secret_… ）か確認する。' +
    '\n  publishable / anon キーでは非公開バケットも denken_question_assets も読めない。'
}

export async function createSupabase() {
  const { url, key } = assertSupabaseCredentials()
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** denken_question_assets を storage_path の LIKE で引く */
export async function selectAssets(supabase, { pathLike, columns }) {
  const { data, error } = await supabase
    .from('denken_question_assets')
    .select(columns)
    .like('storage_path', pathLike)
    .order('storage_path', { ascending: true })
  if (error) fail(`denken_question_assets の取得に失敗: ${error.message}${authHint(error.message)}${proxyHint(error.message)}`)
  return data ?? []
}

/** 非公開バケットから画像本体を落とす（署名URLを介さない＝service role 前提） */
export async function downloadImage(supabase, storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) fail(`${storagePath} のダウンロードに失敗: ${error.message}${authHint(error.message)}${proxyHint(error.message)}`)
  return { name: basename(storagePath), buffer: Buffer.from(await data.arrayBuffer()) }
}
