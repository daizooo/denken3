#!/usr/bin/env node
// 分野別（オーム社 過去問・見開きスキャン）画像の「変則」を検出するトリアージツール。
// docs/design/bunya-anomaly-detection.md の実装。
//
// 背景：
// PR#101（scripts/detect-mask-pcts.mjs）で年度別ペーパーのマスク座標は機械測定になった。
// 残っている Vision コストは分野別の取り込み——docs/problem-data-integration.md §5 の
// 「章フォルダの全画像を実読してマッピングを作る」工程で、章あたり20〜80枚を丸ごと目で見ている。
// しかし収録済み9章 472枚の実績では、既定値（1画像=1問・左=問題/右=解答）から外れる画像は
// 全体の約13%しかない。**残り87%を目で見ないで済ませる**のがこのツールの目的で、
// 値そのものを確定させることは目的ではない（変則と判定された画像は従来どおり目視する）。
//
// 検出する変則（docs/problem-data-integration.md §2.3・§4.1）:
//   2問同居       1枚に2問。region top/bottom ＋ region_y_pct で分割する
//   解答またがり   問ヘッダが無い＝前の画像の解答の続き。sort>0・answer_x_pct=0
//   丸ごと問題     右ページまで問題（選択肢の表・小問(b)）。answer_x_pct=100
//   途中から解答   右ページの上部が問題の続きで、その下から解答。answer_right_y_pct
//   左下から解答   短い問題で左ページの下に解答が始まる。answer_y_pct
//   捨て問候補     問番号が MASTER に無い＝アプリに出さない画像
//
// 使い方:
//   # 取り込み済みの章（Supabaseから直接読む。Google Driveへ戻らない＝data-correction-workflow §2）
//   npm run detect-layout -- --chapter elec
//
//   # 未取り込みの章（手元の画像。取り込み前のマッピング作成用）
//   npm run detect-layout -- --chapter elec ./elec/*.png --map
//
// 出力の見方: 判定が ok の行は「既定値のままでよい標準見開き」。それ以外だけ
// npm run peek で画像を開いて確かめる。値（regionYPct 等）は目視の当たりを付けるための
// 参考値であり、そのままDBへ入れる前提では作っていない（design doc §4）。
//
// 注意: プロキシ必須の環境では Node の組み込み fetch が HTTPS_PROXY を見ないため
// NODE_USE_ENV_PROXY=1 を付けて起動する。
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import {
  createSupabase, downloadImage, fail, ocrAll, rowsFromWords, selectAssets, traineddataVariant,
} from './lib/ocr-lines.mjs'

// ---- CLI ----------------------------------------------------------------

const HELP = `usage: node scripts/detect-bunya-layout.mjs --chapter <code> [options] [image...]

  --chapter <code>   章コード（dc / ac1 / elec ...）。画像を指定しない場合は
                     Supabase の denken_question_assets から章の全画像を引く
  --jobs <n>         OCR並列数（既定 2）
  --map              取り込み前のマッピング雛形（ASSET_MAP の行）を出力
  --json             機械可読なJSONで出力
  --verbose          検出に使った行のOCRテキストも出力
  --help             この使い方を表示

Supabaseから読む場合は SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要
（service role キーは RLS を bypass するのでコミットしないこと）。`

function parseArgs(argv) {
  const opts = { files: [], chapter: null, jobs: 2, map: false, json: false, verbose: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0) }
    else if (a === '--chapter') opts.chapter = argv[++i]
    else if (a === '--jobs') opts.jobs = Math.max(1, Number(argv[++i]) || 1)
    else if (a === '--map') opts.map = true
    else if (a === '--json') opts.json = true
    else if (a === '--verbose' || a === '-v') opts.verbose = true
    else if (a.startsWith('-')) fail(`不明なオプション: ${a}（--help で使い方を表示）`)
    else opts.files.push(a)
  }
  return opts
}

// ---- 見出しの検出 --------------------------------------------------------
// 分野別の見開きは、左ページの左上に「問N 表題 （出典）」の見出しがあり、右ページに
// 「解答」「解説」の見出しが来る（docs/problem-data-integration.md §2）。
// 日本語OCRは 問→間/冏、解→鮮、答→荅 のように読み違えるので、崩れても拾える形にする。
//
// !!! 退行（2026-08-16・実データ7章357枚で検証、docs/design/bunya-anomaly-detection.md §5） !!!
// 上記の前提は実データと違う。実際の見出しバッジは「問N」ではなく「章タイトル＋N」で、
// 「問」の字を含まない（例: dc/newIMG_0283.png = "直流回路1抵抗直列回路"、
// trans/newIMG_0458.png = "過渡現象1アア直列回路"）。右ページの解答見出しも
// 「章タイトル＋N＋の解答」で始まり「解」で始まらない（elec/newIMG_0145.png =
// "静電気1の解答答え(3"）。そのため下記の QUESTION_HEADER・ANSWER_HEADING は実データの
// 357枚中352枚で不一致になり、全て analyze() の分岐(1)（ヘッダ0個 → continuation）に落ちる
// （check率98.6%、目標22%の4.5倍）。章タイトル文字列に緩める対症療法はしていない
// （タイトルバッジ自体が反転配色でOCRに一語も乗らない画像がある＝elec/newIMG_0145.png。
// 正規表現の問題ではなく画像側の前処理が要る）。次の一手は同ドキュメント §7 参照。
// このコメントは、直すときに「なぜ問Nを前提にしていたか」を辿れるよう残す。

// 問ヘッダ。行頭が「問」＋数字であることだけを必須にする（表題はOCRの当てにならない）。
// 本文中の「問13と同様に」を拾う可能性は残るが、ページ内の位置とセットで判定するので
// 誤検出は check として人間へ回る（値を勝手に確定しないので実害が小さい側に倒す）。
const QUESTION_HEADER = /^[問間冏悶]([0-9]{1,3})(?![0-9])/
// 出典コード（H26-B17 / R1-A15 / R5下-B18）。英数字はOCRの信頼度が高く、問ヘッダの裏取りに使える。
const SOURCE_CODE = /([HR])([0-9]{1,2})([上下]?)[-‐−ー―]?([AB])([0-9]{1,2})/
// 解答・解説の見出し。行頭に来るものだけを見る（本文中の「解説する」を拾わない）。
const ANSWER_HEADING = /^(解[答荅签]|解[説説誓]|答[ええ]|【解)/

/** 行が問ヘッダなら問番号を返す */
function headerNumber(line) {
  const m = QUESTION_HEADER.exec(line.stripped)
  return m ? Number(m[1]) : null
}

function sourceCode(line) {
  const m = SOURCE_CODE.exec(line.stripped)
  return m ? `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}` : null
}

// ---- 見開きの幾何 --------------------------------------------------------
// 綴じ目（左右ページの境目）は、語の外接矩形がまったく無い縦の帯として出る。
// 文字の見え方に依らないので、表題のOCRが崩れても効く。既定の answer_x_pct=50 が
// この画像で妥当かどうかを、画像ごとに確かめられる。

const BINS = 200                 // 横方向のヒストグラムの分解能（1ビン=0.5%）
const GUTTER_SEARCH = [35, 65]   // 綴じ目を探す範囲（%）。見開きスキャンなら必ずこの中にある
const MIN_GUTTER_PCT = 1.2       // これより狭い空白は綴じ目とみなさない（行間の偶然の隙間を除く）

function round(pct) {
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100
}

/** 語の外接矩形から、中央付近で最も広い「インクの無い縦帯」を探す */
function findGutter(words, size) {
  const ink = new Array(BINS).fill(0)
  for (const w of words) {
    const a = Math.max(0, Math.floor(w.x0 / size.width * BINS))
    const b = Math.min(BINS - 1, Math.ceil(w.x1 / size.width * BINS))
    for (let i = a; i <= b; i++) ink[i] += w.y1 - w.y0
  }
  const lo = Math.floor(BINS * GUTTER_SEARCH[0] / 100)
  const hi = Math.ceil(BINS * GUTTER_SEARCH[1] / 100)
  let best = null
  let run = null
  for (let i = lo; i <= hi; i++) {
    if (ink[i] === 0) run = { start: run?.start ?? i, end: i }
    else { best = wider(best, run); run = null }
  }
  best = wider(best, run)
  if (!best) return null
  const widthPct = (best.end - best.start + 1) / BINS * 100
  if (widthPct < MIN_GUTTER_PCT) return null
  // 両側に文字があって初めて「見開きの綴じ目」。白紙ページや単ページの画像で、
  // 何も無い側を綴じ目と呼ばないための条件。
  const inkLeft = ink.slice(0, best.start).some(v => v > 0)
  const inkRight = ink.slice(best.end + 1).some(v => v > 0)
  if (!inkLeft || !inkRight) return null
  return { pct: round((best.start + best.end + 1) / 2 / BINS * 100), widthPct: round(widthPct) }
}

function wider(a, b) {
  if (!b) return a
  if (!a) return b
  return b.end - b.start > a.end - a.start ? b : a
}

/**
 * y=cut で画像を切ったとき、その高さに文字がかかっていないかを確かめる。
 * 2問同居の分割位置が本文を割っていないかの検算に使う。
 */
function crossesText(lines, cutY, tolerance) {
  return lines.some(l => l.y0 < cutY - tolerance && l.y1 > cutY + tolerance)
}

/** target の直前で切る位置（%）。見出しと直前の行のあいだの余白の中央に置く。 */
function cutAbove(target, lines, size) {
  const min = size.width * 0.004
  const max = size.width * 0.03
  const prev = lines.filter(l => l.y1 <= target.y0).at(-1)
  const gap = prev ? (target.y0 - prev.y1) / 2 : max
  return round((target.y0 - Math.min(Math.max(gap, min), max)) / size.height * 100)
}

// ---- 1枚ぶんの解析 -------------------------------------------------------

// 右ページの上端付近にある「解答」は標準レイアウト（右ページ全体が解答）。
// これより下で始まるなら、上部は問題の続き（選択肢・小問(b)）とみなす。
const RIGHT_ANSWER_TOP_PCT = 12
// 2問目のヘッダがこの位置より上にあると、既定の50%分割では見出しが切れる（elec 0181 で実在）。
const TWO_IN_ONE_SEARCH = [15, 85]
// これ未満しか語が取れていない画像はOCRが成立していない（見開き1枚なら数百語は出る）。
const MIN_WORDS = 30

function analyze({ words, size }, master) {
  const gutter = findGutter(words, size)
  const splitX = gutter ? gutter.pct / 100 * size.width : size.width / 2
  // tesseract の行はページをまたいで連結されることがあるため、語をページごとに選り分けてから
  // 行を組み直す（scripts/lib/ocr-lines.mjs の rowsFromWords。合成フィクスチャで実際に起きた）。
  const onLeft = w => (w.x0 + w.x1) / 2 < splitX
  const leftLines = rowsFromWords(words.filter(onLeft), size)
  const rightLines = rowsFromWords(words.filter(w => !onLeft(w)), size)

  // 問ヘッダは左ページにしか無い。左端寄りで始まる行に限って拾い、本文の折返しを除く。
  const headers = leftLines
    .filter(l => l.x0 / splitX < 0.35)
    .map(l => ({ line: l, number: headerNumber(l) }))
    .filter(h => h.number != null)
    .map(h => ({ ...h, source: sourceCode(h.line) ?? nearbySource(leftLines, h.line) }))

  const answersRight = rightLines.filter(l => ANSWER_HEADING.test(l.stripped))
  const answersLeft = leftLines.filter(l => ANSWER_HEADING.test(l.stripped))

  const notes = []
  if (!gutter) notes.push('綴じ目を検出できず（単ページ／中央に図がまたがる可能性）')
  else if (Math.abs(gutter.pct - 50) >= 2) notes.push(`綴じ目が中央から ${(gutter.pct - 50).toFixed(1)} ポイントずれている`)

  const result = { gutter, headers, size, notes, values: {} }

  // (0) そもそも文字がほとんど取れていない＝OCRの前提が崩れている（向き・解像度・白紙）。
  // ここで打ち切らないと「問ヘッダが無い＝またがり」と読み違え、白紙をアプリへ登録しかねない。
  if (words.length < MIN_WORDS) {
    return finish(result, 'unreadable', {}, [`文字をほとんど検出できず（語 ${words.length} 個）。向き・解像度・白紙を確認`])
  }

  // (1) 問ヘッダが無い＝前の画像から続く解答ページ（解答またがり）。
  if (headers.length === 0) {
    return finish(result, 'continuation', { answerXPct: 0, sort: 1 },
      ['問ヘッダ未検出＝前画像の解答の続き（またがり）候補'])
  }

  // (2) 問ヘッダが2つ以上＝2問同居。分割位置は2問目の見出しの直前の余白に置く。
  if (headers.length >= 2) {
    const second = headers[1].line
    const inRange = second.topPct > TWO_IN_ONE_SEARCH[0] && second.topPct < TWO_IN_ONE_SEARCH[1]
    const regionYPct = cutAbove(second, leftLines, size)
    const extra = [`2問同居候補（問${headers.map(h => h.number).join('・問')}）`]
    if (!inRange) extra.push(`2問目の見出しが端に寄っている（${second.topPct.toFixed(1)}%）＝誤検出の可能性`)
    // 右ページ（解答側）も同じ高さで割れる必要がある。文字を横切るなら分割位置が合っていない。
    if (crossesText(rightLines, regionYPct / 100 * size.height, size.height * 0.002)) {
      extra.push('分割位置が右ページの本文を横切る＝region_y_pct は目視で決めること')
    }
    return finish(result, 'two-in-one', { regionYPct }, extra)
  }

  // (3) 問ヘッダが1つ＝1画像1問。解答見出しの位置で標準／変則を分ける。
  const rightTop = answersRight[0]
  const leftAnswer = answersLeft.find(l => l.y0 > headers[0].line.y1)
  if (!rightTop && !leftAnswer) {
    return finish(result, 'whole-question', { answerXPct: 100 },
      ['解答見出しを検出できず＝見開き丸ごと問題（右ページが選択肢・小問）の候補'])
  }
  if (rightTop && rightTop.topPct > RIGHT_ANSWER_TOP_PCT) {
    return finish(result, 'answer-mid-right', { answerRightYPct: cutAbove(rightTop, rightLines, size) },
      [`右ページの解答が上端から ${rightTop.topPct.toFixed(1)}% の位置＝上部は問題の続き`])
  }
  if (leftAnswer) {
    return finish(result, 'answer-lower-left', { answerYPct: cutAbove(leftAnswer, leftLines, size) },
      ['左ページの下に解答が始まる候補'])
  }
  return finish(result, 'standard', { answerXPct: 50 }, [])

  function nearbySource(all, headerLine) {
    // 出典コードは見出しと同じ行か、その直下の行に入る（表題が2行に折り返す版面がある）。
    const near = all.filter(l => l.y0 >= headerLine.y0 && l.y0 < headerLine.y1 + (headerLine.y1 - headerLine.y0) * 2)
    for (const l of near) { const c = sourceCode(l); if (c) return c }
    return null
  }

  function finish(r, kind, values, extraNotes) {
    r.kind = kind
    r.values = values
    r.notes = [...r.notes, ...extraNotes]
    // 捨て問（MASTER 未登録）の判定は問番号が取れたときだけ意味がある。
    r.questionNumbers = r.headers.map(h => h.number)
    r.unknownNumbers = master ? r.questionNumbers.filter(n => !master.has(n)) : []
    if (r.unknownNumbers.length > 0) {
      r.notes.push(`捨て問候補: 問${r.unknownNumbers.join('・問')} は MASTER 未登録`)
    }
    // 標準と判定でき、幾何にも異常が無いものだけを ok にする。
    // 変則候補は値を出しても ok にしない——「値が出た＝確定」と読まれると、
    // このツールが目視の代わりに値を決めていることになる（design doc §4 の非目標）。
    r.status = kind === 'unreadable' ? 'miss'
      : kind === 'standard' && r.notes.length === 0 ? 'ok'
        : r.headers.length === 0 && !r.gutter ? 'miss'
          : 'check'
    return r
  }
}

// ---- MASTER（捨て問の判定用）--------------------------------------------
// src/data/denken3/riron/ohmsha-bunya/{chapter}.ts の id 一覧を読む。
// TS を評価せず正規表現で拾うだけ（トランスパイルを挟まないので依存が増えない）。

async function loadMaster(chapter) {
  if (!chapter) return null
  try {
    const src = await readFile(resolve(`src/data/denken3/riron/ohmsha-bunya/${chapter}.ts`), 'utf8')
    const numbers = [...src.matchAll(new RegExp(`id:\\s*'${chapter}_(\\d+)'`, 'g'))].map(m => Number(m[1]))
    return numbers.length > 0 ? new Set(numbers) : null
  } catch {
    return null // 理論以外の章（MASTER未登録）ではこの判定を諦める
  }
}

// ---- 入力の解決 ----------------------------------------------------------

async function localTargets(files) {
  return Promise.all(files.map(async file => ({
    name: basename(file),
    buffer: await readFile(resolve(file)).catch(e => fail(`${file} を読めません: ${e.message}`)),
    storagePath: null,
    current: null,
  })))
}

const ASSET_COLUMNS = 'question_id, storage_path, region, sort, answer_x_pct, answer_y_pct, answer_right_y_pct, region_y_pct'

/** 取り込み済みの章を Supabase から読む。1枚が2行（2問同居）になることがあるので画像単位へ畳む。 */
async function remoteTargets(chapter) {
  const supabase = await createSupabase()
  const rows = await selectAssets(supabase, { pathLike: `%/theory/${chapter}/%`, columns: ASSET_COLUMNS })
  if (rows.length === 0) fail(`${chapter} 章の行が見つかりません（--chapter の指定と取り込み状況を確認してください）。`)

  const byPath = new Map()
  for (const row of rows) {
    if (!byPath.has(row.storage_path)) byPath.set(row.storage_path, [])
    byPath.get(row.storage_path).push(row)
  }
  return Promise.all([...byPath].map(async ([storagePath, current]) => ({
    ...await downloadImage(supabase, storagePath),
    storagePath,
    current,
  })))
}

// ---- DB現在値との突き合わせ ----------------------------------------------
// 「検出した構造」と「DBに登録されている構造」が食い違う画像は、取り込み時の判断が
// 間違っているか、このツールの誤検出かのどちらか。どちらにせよ目視すべき対象なので名指しする。

function compare(result, current) {
  if (!current) return null
  const diffs = []
  const rows = current
  const dbTwoInOne = rows.length >= 2 && rows.some(r => r.region)
  const dbContinuation = rows.every(r => r.sort > 0)
  if (result.kind === 'two-in-one' && !dbTwoInOne) diffs.push('DBは1問だが2問同居を検出')
  if (result.kind !== 'two-in-one' && dbTwoInOne) diffs.push('DBは2問同居だが検出は1問')
  if (result.kind === 'continuation' && !dbContinuation) diffs.push('DBは問題ページだが解答の続きを検出')
  if (result.kind !== 'continuation' && dbContinuation) diffs.push('DBは解答の続きだが問ヘッダを検出')
  if (result.kind === 'whole-question' && rows.some(r => Number(r.answer_x_pct) === 50)) {
    diffs.push('DBは左問題/右解答だが解答見出しを検出できず')
  }
  // 数値は「検出できたものだけ」を比べる（未検出を0とみなして誤差にしない）。
  for (const [key, column] of [['regionYPct', 'region_y_pct'], ['answerYPct', 'answer_y_pct'], ['answerRightYPct', 'answer_right_y_pct']]) {
    const detected = result.values[key]
    if (detected == null) continue
    const db = Number(rows[0][column])
    if (Number.isFinite(db) && Math.abs(detected - db) >= 3) diffs.push(`${column}: DB ${db} / 検出 ${detected}`)
  }
  return diffs
}

// ---- 出力 ----------------------------------------------------------------

const KIND_LABEL = {
  standard: '標準',
  'two-in-one': '2問同居',
  continuation: 'またがり',
  'whole-question': '丸ごと問題',
  'answer-mid-right': '途中から解答',
  'answer-lower-left': '左下から解答',
  unreadable: '読取不能',
}
const STATUS_MARK = { ok: '✅ ok', check: '⚠️ check', miss: '❌ miss' }

// 全角文字と絵文字は端末上2桁を取るが padEnd は文字数で数えるため、日本語を含む列は
// そのままでは桁が揃わない。表示幅で詰める。
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦✅❌⚠\u{1F300}-\u{1FAFF}]/u
const ZERO_WIDTH = /[️‍]/

function displayWidth(text) {
  let width = 0
  for (const ch of text) width += ZERO_WIDTH.test(ch) ? 0 : WIDE.test(ch) ? 2 : 1
  return width
}

function pad(text, width) {
  return text + ' '.repeat(Math.max(0, width - displayWidth(text)))
}

function valueText(values) {
  const entries = Object.entries(values).filter(([, v]) => v != null)
  return entries.length === 0 ? '' : entries.map(([k, v]) => `${k}=${v}`).join(' ')
}

function printTable(targets, results, verbose) {
  const width = Math.max(...targets.map(t => t.name.length), 8)
  console.log(`\n${pad('file', width)}  ${pad('判定', 12)}  ${pad('問', 9)}  綴じ目  ${pad('状態', 9)}  提案値`)
  console.log('-'.repeat(width + 50))
  for (const [i, t] of targets.entries()) {
    const r = results[i]
    const qs = r.questionNumbers?.length ? r.questionNumbers.map(n => `問${n}`).join('+') : '—'
    const gutter = r.gutter ? `${r.gutter.pct.toFixed(1)}%` : '—'
    console.log(
      `${pad(t.name, width)}  ${pad(KIND_LABEL[r.kind], 12)}  ${pad(qs, 9)}  ${gutter.padStart(6)}  ` +
      `${pad(STATUS_MARK[r.status], 9)}  ${valueText(r.values)}`,
    )
    for (const note of r.notes) console.log(`${' '.repeat(width)}   ↳ ${note}`)
    for (const d of r.dbDiffs ?? []) console.log(`${' '.repeat(width)}   ≠ ${d}`)
    if (verbose) {
      for (const h of r.headers) {
        console.log(`${' '.repeat(width)}   · header y=${h.line.y0}-${h.line.y1} src=${h.source ?? '—'} ${JSON.stringify(h.line.text)}`)
      }
    }
  }
  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  const kinds = results.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {})
  console.log(`\n合計 ${results.length}枚: ok=${counts.ok ?? 0} check=${counts.check ?? 0} miss=${counts.miss ?? 0}`)
  console.log(`内訳: ${Object.entries(kinds).map(([k, n]) => `${KIND_LABEL[k]}=${n}`).join(' ')}`)
  const toReview = (counts.check ?? 0) + (counts.miss ?? 0)
  if (toReview > 0) {
    console.log(`※ 目視は ${toReview}/${results.length} 枚だけでよい（ok は既定値どおりの標準見開き）。`)
    console.log('  npm run peek -- <question_id> で署名付きURLを開いて確かめる。')
  }
  const mismatched = results.filter(r => (r.dbDiffs ?? []).length > 0).length
  if (mismatched > 0) console.log(`※ DB登録内容と食い違う画像が ${mismatched} 枚ある（≠ の行）。`)
}

/**
 * 取り込み前のマッピング雛形（src/data/{chapter}Assets.ts の行）を出力する。
 * またがりは直前の問へ sort を1つ進めて割り当てる（実データではこの並びで正しかったが、
 * 連番が飛ぶスキャンもあるので必ず目視で確かめること）。
 */
function printMap(targets, results, chapter) {
  console.log(`\n// ${chapter} 章のマッピング雛形（要目視・そのままコミットしないこと）`)
  console.log(`export const ${chapter.toUpperCase()}_ASSETS: AssetMap = {`)
  let previous = null
  let sort = 0
  for (const [i, t] of targets.entries()) {
    const r = results[i]
    if (r.kind === 'continuation') {
      if (!previous) { console.log(`  // ${t.name}: 続き先の問が不明（先頭が解答ページ？要確認）`); continue }
      sort += 1
      console.log(`  '${t.name}': [{ questionId: '${previous}', region: null, sort: ${sort} }], // またがり・要確認`)
      continue
    }
    sort = 0
    if (r.questionNumbers.length === 0) {
      console.log(`  // ${t.name}: 問ヘッダを取れず（${KIND_LABEL[r.kind]}）。目視で question_id を決めること`)
      continue
    }
    // 捨て問（MASTER 未登録）は登録しない＝行を出さない。コメントとして残し、
    // 「見落として抜けた」のか「捨て問だから抜いた」のかを後から辿れるようにする。
    if (r.unknownNumbers.length > 0 && r.unknownNumbers.length === r.questionNumbers.length) {
      console.log(`  // ${t.name}: 捨て問候補（問${r.questionNumbers.join('・問')}＝MASTER未登録）。登録しない`)
      continue
    }
    const refs = r.questionNumbers.map((n, idx) => {
      const region = r.questionNumbers.length > 1 ? (idx === 0 ? "'top'" : "'bottom'") : 'null'
      const extra = [
        r.values.answerXPct != null && r.values.answerXPct !== 50 ? `, answerXPct: ${r.values.answerXPct}` : '',
        r.values.answerYPct != null ? `, answerYPct: ${r.values.answerYPct}` : '',
        r.values.answerRightYPct != null ? `, answerRightYPct: ${r.values.answerRightYPct}` : '',
        // regionYPct は上下どちらの行にも要る（各行が自分の切り出し位置として読むため。
        // 既存データ src/data/elecAssets.ts の newIMG_0181 と同じ持ち方）。
        r.values.regionYPct != null ? `, regionYPct: ${r.values.regionYPct}` : '',
      ].join('')
      return `{ questionId: '${chapter}_${n}', region: ${region}, sort: 0${extra} }`
    })
    // 続き（またがり）は直前の問に付く。2問同居のあとに続きが来る場合は下側の問の解答なので、
    // 最後の問番号を覚えておく。
    previous = `${chapter}_${r.questionNumbers.at(-1)}`
    const comment = r.status === 'ok' ? '' : `  // ${KIND_LABEL[r.kind]}: ${r.notes.join(' / ')}`
    console.log(`  '${t.name}': [${refs.join(', ')}],${comment}`)
  }
  console.log('}')
}

// ---- main ----------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2))
if (!opts.chapter && opts.files.length === 0) {
  fail('対象がありません。--chapter <code> か画像ファイルを指定してください（--help で使い方を表示）。')
}
if (opts.map && !opts.chapter) fail('--map は --chapter が要ります（question_id を組み立てられないため）。')

const targets = opts.files.length > 0 ? await localTargets(opts.files) : await remoteTargets(opts.chapter)
const master = await loadMaster(opts.chapter)

if (!opts.json) console.error(`OCR中… ${targets.length}枚（jpn/${traineddataVariant()}, 並列${opts.jobs}）`)
let done = 0
const pages = await ocrAll(targets, opts.jobs, () => {
  if (!opts.json) process.stderr.write(`\r  ${++done}/${targets.length}枚 完了`)
})
if (!opts.json) process.stderr.write('\n')

const results = pages.map((page, i) => {
  const r = analyze(page, master)
  r.dbDiffs = compare(r, targets[i].current)
  return r
})

if (opts.json) {
  console.log(JSON.stringify(targets.map((t, i) => {
    const r = results[i]
    return {
      file: t.name,
      storagePath: t.storagePath,
      kind: r.kind,
      status: r.status,
      questionNumbers: r.questionNumbers,
      sourceCodes: r.headers.map(h => h.source),
      gutterPct: r.gutter?.pct ?? null,
      values: r.values,
      notes: r.notes,
      dbDiffs: r.dbDiffs,
    }
  }), null, 2))
} else {
  printTable(targets, results, opts.verbose)
  if (opts.map) printMap(targets, results, opts.chapter)
}

// miss（そもそも構造を読めなかった）とDB不一致だけを異常として扱う。
// check は「変則を見つけた＝このツールが仕事をした」状態なので正常終了にする。
const abnormal = results.some(r => r.status === 'miss' || (r.dbDiffs ?? []).length > 0)
process.exit(abnormal ? 1 : 0)
