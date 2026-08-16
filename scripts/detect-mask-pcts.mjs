#!/usr/bin/env node
// 年度別ペーパー画像のマスク座標（question_start_pct / answer_y_pct / explanation_end_pct）を
// OCRで自動測定するツール（docs/data-correction-workflow.md §5-B）。
//
// 背景：
// これまで座標は「Claudeが画像を目で見て % を推定する」方法で決めていた。Vision入力は
// 画像サイズにほぼ比例してトークンを食うため、年度を1回追加するたび（18枚前後）に
// 大きなコストが乗っていた。電験王のページテンプレートは全キャプチャで共通なので、
// 見出し行のY座標さえ取れれば % は機械的に決まる。その測定をこのスクリプトへ常設し、
// Claudeの役割を「実行して妥当性を確認するだけ」に縮小する。
//
// 検出する3つの境界（いずれも画像高さに対する縦位置%）:
//   question_start_pct  【難易度】行の直後   … ここより上（タイトル・共有ボタン・動画・目次）は常に隠す
//   answer_y_pct        【ワンポイント解説】見出しの直前 … CBT解答中はここから下を隠す
//   explanation_end_pct 宣伝バナーの直前     … 結果画面はここから下を隠す
//
// 使い方:
//   # 取り込み済みの回（Supabaseから直接。Google Driveへ戻らない＝§2）
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run detect-pcts -- --paper riron/r7-1
//   npm run detect-pcts -- --paper riron/r7-1 --sql      # 修正用の UPDATE 文を出力（§3）
//
//   # 未取り込みの回（手元の画像ファイル。新規収録時にTSへ書く初期値を出す）
//   npm run detect-pcts -- --paper riron/r8-1 ./r8-1/*.png --ts
//
// 出力の見方: 判定が ok 以外の行だけ現物を確認すればよい。miss（見出し未検出）と
// check（弱い手掛かりでの検出）は誤りうるので、npm run peek で署名付きURLを開いて確かめる。
// Vision推論はここで明らかにおかしい値が出たときの例外対応に限定する。
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createWorker } from 'tesseract.js'

const BUCKET = 'denken-problems'
// tesseract.js の言語データ。CDN（jsdelivr）任せにせず npm 依存として固定し、
// オフラインでも・将来データが差し替わっても同じ結果が出るようにする。
// 4.0.0_best_int は 4.0.0(fast) より約3割遅いが、【】や「ご紹介」の再現性が明確に高い。
const TRAINEDDATA_VARIANT = process.env.DETECT_PCTS_TRAINEDDATA ?? '4.0.0_best_int'

// ---- CLI ----------------------------------------------------------------

const HELP = `usage: node scripts/detect-mask-pcts.mjs [options] [image...]

  --paper <subject/paperId>  対象の回（例: riron/r7-1）。画像を指定しない場合は
                             Supabase の denken_question_assets から対象行を引く
  --question <id>            question_id 指定（複数可）。--paper と併用して科目を絞る
  --jobs <n>                 OCR並列数（既定 2）
  --sql                      denken_question_assets への UPDATE 文を出力
  --ts                       PaperDefinition に書く形（questionStartPct: ...）で出力
  --json                     機械可読なJSONで出力
  --verbose                  検出に使った行のOCRテキストと候補一覧も出力
  --help                     この使い方を表示

Supabaseから読む場合は SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要
（service role キーは RLS を bypass するのでコミットしないこと）。`

function parseArgs(argv) {
  const opts = { files: [], questionIds: [], paper: null, jobs: 2, sql: false, ts: false, json: false, verbose: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0) }
    else if (a === '--paper') opts.paper = argv[++i]
    else if (a === '--question') opts.questionIds.push(argv[++i])
    else if (a === '--jobs') opts.jobs = Math.max(1, Number(argv[++i]) || 1)
    else if (a === '--sql') opts.sql = true
    else if (a === '--ts') opts.ts = true
    else if (a === '--json') opts.json = true
    else if (a === '--verbose' || a === '-v') opts.verbose = true
    else if (a.startsWith('-')) fail(`不明なオプション: ${a}（--help で使い方を表示）`)
    else opts.files.push(a)
  }
  return opts
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// ---- 画像サイズ ----------------------------------------------------------
// Y座標を%へ直すには画像の高さが要る。PNG/JPEGのヘッダを直接読むだけで足りるので、
// 画像デコードライブラリは入れない（依存を増やさない）。

function imageHeight(buf, label) {
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
  fail(`${label}: 画像サイズを読めません（PNG/JPEGのみ対応）`)
}

// ---- OCRテキストの正規化 -------------------------------------------------
// 日本語OCRは文字と文字の間に空白を入れる・全角半角が揺れる・丸数字を返すことがある。
// マッチング前にこれらを潰しておかないと、見出しの検出が取りこぼす。

const CIRCLED = '⓪①②③④⑤⑥⑦⑧⑨'

function normalize(text) {
  return text
    .normalize('NFKC')
    .replace(/[⓪①-⑨]/g, c => String(CIRCLED.indexOf(c)))
    .replace(/\s+/g, '')
}

// ---- 見出しの検出 --------------------------------------------------------
// 電験王のページは見出しが【】で囲まれるが、OCRは 【 を [ | ( 「 などに読み違える。
// また「解説→解誓」「紹介→細介」のような字形の近い誤読も出る。そこで
// 「行頭が括弧様の文字＋キーワード」を strong、「本文中のどこかにキーワード」を weak とし、
// 強い手掛かりを優先しつつ、弱い一致は判定に check を立てて人間の確認へ回す。
const OPEN_BRACKET = '[\\[［「『【|(lI]'

const MARKERS = {
  // 【難易度】。ページタイトルにも「（難易度★★☆）」が入ることがあるため、
  // 行頭が括弧＋難易度の strong を優先する（タイトルは行の途中に出るので weak にしかならない）。
  difficulty: {
    label: '【難易度】',
    tiers: [
      { tier: 'strong', re: new RegExp(`^${OPEN_BRACKET}?[難錐][易昌][度渡]`) },
      { tier: 'weak', re: /[難錐][易昌][度渡]/ },
    ],
  },
  // 【ワンポイント解説】。「解説」は誤読が多い（解誓など）ので後半は当てにしない。
  // 目次にも同じ語が出るが、目次は【難易度】より上にあるため位置制約で自然に落ちる。
  onepoint: {
    label: '【ワンポイント解説】',
    tiers: [
      { tier: 'strong', re: new RegExp(`^${OPEN_BRACKET}?ワ[ンソ][ポボ][イィ][ンソ][トド]`) },
      { tier: 'weak', re: /ワ[ンソ][ポボ][イィ][ンソ][トド]/ },
    ],
  },
  // 宣伝バナー（「…令和8年度上期版」のご紹介）。本文中の「紹介」を拾う誤検出が
  // 実際に起きている（src/data/denken3/riron/papers/r5-1.ts の問4）ため、
  // 「ご紹介」まで揃った並びだけを見る。単独の「紹介」は採らない
  // ——解説本文の途中で切ると解説が読めなくなる（バナーが残るより実害が大きい）ので、
  // 曖昧なものは拾わずフッター代替へ落として要確認にする方が安全側。
  banner: {
    label: '宣伝バナー',
    tiers: [
      { tier: 'strong', re: /[」』"”]の[ごこ][紹細招][介个]|令和\d+年度[上下]期版/ },
      { tier: 'medium', re: /[のO][ごこ][紹細招][介个]/ },
    ],
  },
  // バナーがOCRできなかったとき（r5-1 の問5で実際に発生）の保険。
  // バナー自体ではなく、その下にある定型フッターなので値は必ず大きめに出る。
  // 必ず fallback と表示し、そのまま採用しないこと。
  footer: {
    label: 'フッター（バナー代替）',
    tiers: [
      { tier: 'fallback', re: /関連記事|[合あ]わせて読みたい|スポンサーリンク|[前次]の問題/ },
    ],
  },
}

/** 指定マーカに一致する行を、確度の高い順・同確度なら上にある順で返す */
function candidates(lines, marker) {
  const found = []
  for (const line of lines) {
    for (let i = 0; i < marker.tiers.length; i++) {
      if (marker.tiers[i].re.test(line.norm)) { found.push({ line, tier: marker.tiers[i].tier, rank: i }); break }
    }
  }
  return found.sort((a, b) => a.rank - b.rank || a.line.y0 - b.line.y0)
}

// ページ最上部はタイトル帯。電験王のページはタイトルの下に共有ボタン・動画・目次が入るため、
// 本物の【難易度】がここに来ることはない（収録済み4科目の実測でも 8%より上には無い）。
// タイトルには「（難易度★★☆）」が入りうるので、弱い一致がここに出たら見出しではないと判断する。
const TITLE_ZONE_PCT = 5

/** 最良候補を1つ選ぶ。predicate は位置関係の制約（「…より下」など）。 */
function pick(lines, marker, predicate = () => true) {
  const all = candidates(lines, marker).filter(c => predicate(c.line))
  // 弱い一致がタイトル帯にあるものは候補から外す。これを残すと、見出しが無いページで
  // タイトルを見出しと取り違えた「それらしい値」が出てしまい、誤りに気付けない。
  const usable = all.filter(c => c.rank === 0 || c.line.topPct > TITLE_ZONE_PCT)
  if (usable.length === 0) return null
  return { ...usable[0], alternatives: usable }
}

// ---- Y座標 → % ----------------------------------------------------------
// 切り位置は「見出しの端」ではなく「見出しと隣の行のあいだの余白の中央」に置く。
// 見出しを確実に隠しつつ、隣接する本文行を削らないため。余白が極端に広い（間に図がある）
// ときのために、余白の取り方には画像幅を基準にした上限・下限を設ける。

function pads(width) {
  return { min: width * 0.004, max: width * 0.03 }
}

function round(pct) {
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100
}

/** target の直前を切る（target 自体は表示しない） */
function cutAbove(target, lines, size) {
  const { min, max } = pads(size.width)
  const prev = lines.filter(l => l.y1 <= target.y0).at(-1)
  const gap = prev ? (target.y0 - prev.y1) / 2 : max
  return round((target.y0 - Math.min(Math.max(gap, min), max)) / size.height * 100)
}

/** target の直後を切る（target 自体は表示しない） */
function cutBelow(target, lines, size) {
  const { min, max } = pads(size.width)
  const next = lines.find(l => l.y0 >= target.y1)
  const gap = next ? (next.y0 - target.y1) / 2 : max
  return round((target.y1 + Math.min(Math.max(gap, min), max)) / size.height * 100)
}

// ---- 1枚ぶんの解析 -------------------------------------------------------

function analyze(ocrLines, size) {
  const lines = ocrLines
    .map(l => ({
      y0: l.bbox.y0, y1: l.bbox.y1, text: l.text.trim(), norm: normalize(l.text),
      conf: l.confidence, topPct: l.bbox.y0 / size.height * 100,
    }))
    .filter(l => l.norm.length > 0)
    .sort((a, b) => a.y0 - b.y0)

  const difficulty = pick(lines, MARKERS.difficulty)
  // 【ワンポイント解説】は【難易度】より下。目次の同名項目はこれで除外される。
  const onepoint = pick(lines, MARKERS.onepoint, l => !difficulty || l.y0 > difficulty.line.y1)
  // バナーは解説より下。弱い一致（単独の「紹介」）は本文の誤検出が多いので下半分に限る。
  let banner = pick(lines, MARKERS.banner, l =>
    (!onepoint || l.y0 > onepoint.line.y1) && (!difficulty || l.y0 > difficulty.line.y1))
  if (banner && banner.rank > 0 && banner.line.topPct < 50) banner = null
  // バナーが読めなかったときだけフッターで代替する（値は必ず大きめに出る＝要確認）。
  const bannerOrFooter = banner ?? pick(lines, MARKERS.footer, l => !onepoint || l.y0 > onepoint.line.y1)

  const marks = {
    questionStartPct: difficulty ? cutBelow(difficulty.line, lines, size) : null,
    answerYPct: onepoint ? cutAbove(onepoint.line, lines, size) : null,
    explanationEndPct: bannerOrFooter ? cutAbove(bannerOrFooter.line, lines, size) : null,
  }
  const hits = { difficulty, onepoint, banner: bannerOrFooter }

  // 判定: 3つとも strong で取れていれば ok、弱い手掛かり・代替は check、欠けは miss。
  const notes = []
  if (marks.questionStartPct == null) notes.push('【難易度】未検出')
  else if (difficulty.tier !== 'strong') notes.push('【難易度】は弱い一致')
  if (marks.answerYPct == null) notes.push('【ワンポイント解説】未検出')
  else if (onepoint.tier !== 'strong') notes.push('【ワンポイント解説】は弱い一致')
  if (marks.explanationEndPct == null) notes.push('バナー未検出')
  else if (bannerOrFooter.tier === 'fallback') notes.push('バナー未検出のためフッターで代替')
  else if (bannerOrFooter.tier !== 'strong') notes.push('バナーは弱い一致')
  // 順序が崩れていれば、どこかを取り違えている。
  const ordered = [marks.questionStartPct, marks.answerYPct, marks.explanationEndPct].filter(v => v != null)
  if (ordered.some((v, i) => i > 0 && v <= ordered[i - 1])) notes.push('検出値の大小が逆転')

  const missing = Object.values(marks).some(v => v == null)
  const status = missing || notes.some(n => n.includes('逆転')) ? 'miss' : notes.length > 0 ? 'check' : 'ok'
  return { ...marks, status, notes, hits, lines }
}

// ---- OCR 実行 ------------------------------------------------------------

function langPath() {
  const require = createRequire(import.meta.url)
  // package.json 経由で解決すると、node_modules の巻き上げ位置に依らず正しい場所を指せる。
  const pkg = require.resolve('@tesseract.js-data/jpn/package.json')
  return join(dirname(pkg), TRAINEDDATA_VARIANT)
}

async function ocrAll(targets, jobs, onProgress) {
  const path = langPath()
  const workers = await Promise.all(
    Array.from({ length: Math.min(jobs, targets.length) }, () =>
      // cachePath を tmp に逃がす（既定はカレント直下に jpn.traineddata を吐きリポジトリを汚す）。
      createWorker('jpn', 1, { langPath: path, gzip: true, cachePath: join(tmpdir(), 'denken3-tesseract') })),
  )
  const queue = targets.map((t, i) => ({ t, i }))
  const results = new Array(targets.length)
  await Promise.all(workers.map(async worker => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { data } = await worker.recognize(job.t.buffer, {}, { blocks: true })
      const lines = (data.blocks ?? []).flatMap(b => (b.paragraphs ?? []).flatMap(p => p.lines ?? []))
      results[job.i] = analyze(lines, imageHeight(job.t.buffer, job.t.name))
      onProgress()
    }
  }))
  await Promise.all(workers.map(w => w.terminate()))
  return results
}

// ---- 入力の解決 ----------------------------------------------------------

function parsePaper(paper) {
  if (!paper) return null
  const [subjectId, paperId] = paper.split('/')
  if (!subjectId || !paperId) fail(`--paper は subject/paperId の形で指定してください（例: riron/r7-1）。受け取った値: ${paper}`)
  return { subjectId, paperId }
}

/** 手元の画像ファイルを読む（未取り込みの回の新規収録用） */
async function localTargets(files, paper) {
  return Promise.all(files.map(async file => {
    const name = basename(file)
    return {
      name,
      buffer: await readFile(resolve(file)),
      // question_id と storage_path は --paper があるときだけ組み立てられる（a06.png → r7-1_a06）。
      questionId: paper ? `${paper.paperId}_${name.replace(/\.[^.]+$/, '')}` : null,
      // 手元の画像には実際の格納先が無い（未取り込み or 旧パスの可能性がある）ため、
      // 先頭の user_id をワイルドカードにした LIKE パターンだけを組み立てる。
      storagePath: null,
      storagePathLike: paper ? `%/papers/${paper.subjectId}/${paper.paperId}/${name}` : null,
      current: null,
    }
  }))
}

/** Supabase に取り込み済みの画像を署名なしで直接ダウンロードする（Driveへ戻らない＝§2） */
async function remoteTargets(paper, questionIds) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数で指定してください。')

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  let query = supabase
    .from('denken_question_assets')
    .select('question_id, storage_path, question_start_pct, answer_y_pct, explanation_end_pct')
  // question_id は科目をまたいで重複する（理論と機械の 'r6-2_b16' は別問題）ため、
  // 年度別は必ず科目を含む storage_path で絞る（docs/data-correction-workflow.md §3）。
  if (paper) query = query.like('storage_path', `%/papers/${paper.subjectId}/${paper.paperId}/%`)
  if (questionIds.length > 0) query = query.in('question_id', questionIds)

  const { data: rows, error } = await query.order('storage_path', { ascending: true })
  if (error) fail(`denken_question_assets の取得に失敗: ${error.message}`)
  if (!rows || rows.length === 0) fail('対象の行が見つかりません（--paper / --question の指定と取り込み状況を確認してください）。')

  return Promise.all(rows.map(async row => {
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(row.storage_path)
    if (dlErr) fail(`${row.storage_path} のダウンロードに失敗: ${dlErr.message}`)
    return {
      name: basename(row.storage_path),
      buffer: Buffer.from(await blob.arrayBuffer()),
      questionId: row.question_id,
      // 取り込み済みなので実パスが分かる。LIKE にそのまま渡してもワイルドカードを含まず一致する。
      storagePath: row.storage_path,
      storagePathLike: row.storage_path,
      current: {
        questionStartPct: row.question_start_pct,
        answerYPct: row.answer_y_pct,
        explanationEndPct: row.explanation_end_pct,
      },
    }
  }))
}

// ---- 出力 ----------------------------------------------------------------

const STATUS_MARK = { ok: '✅ ok', check: '⚠️ check', miss: '❌ miss' }
const KEYS = ['questionStartPct', 'answerYPct', 'explanationEndPct']

function fmt(value) {
  return value == null ? '  --  ' : value.toFixed(2).padStart(6)
}

/** DBの現在値と検出値の差。0.5ポイント以上ずれている列があれば ≠ を立てる。 */
function diffOf(result, current) {
  if (!current) return null
  const deltas = KEYS.map(k => (result[k] == null || current[k] == null ? null : result[k] - current[k]))
  const shifted = deltas.some(d => d != null && Math.abs(d) >= 0.5)
  return { text: deltas.map(d => (d == null ? '?' : (d >= 0 ? '+' : '') + d.toFixed(1))).join('/'), shifted }
}

function printTable(targets, results, verbose) {
  const width = Math.max(...targets.map(t => t.name.length), 8)
  console.log(`\n${'file'.padEnd(width)}  start%  answer%    end%  判定       DB差分`)
  console.log('-'.repeat(width + 52))
  for (const [i, t] of targets.entries()) {
    const r = results[i]
    const diff = diffOf(r, t.current)
    console.log(
      `${t.name.padEnd(width)}  ${fmt(r.questionStartPct)}  ${fmt(r.answerYPct)}  ${fmt(r.explanationEndPct)}` +
      `  ${STATUS_MARK[r.status].padEnd(9)}  ${diff ? `${diff.shifted ? '≠ ' : '  '}${diff.text}` : ''}`,
    )
    for (const note of r.notes) console.log(`${' '.repeat(width)}   ↳ ${note}`)
    if (verbose) {
      for (const [key, hit] of Object.entries(r.hits)) {
        if (!hit) continue
        console.log(`${' '.repeat(width)}   · ${key}[${hit.tier}] y=${hit.line.y0}-${hit.line.y1} conf=${hit.line.conf.toFixed(0)} ${JSON.stringify(hit.line.text)}`)
        for (const alt of hit.alternatives.slice(1, 4)) {
          console.log(`${' '.repeat(width)}     （他候補 [${alt.tier}] y=${alt.line.y0} ${JSON.stringify(alt.line.text)}）`)
        }
      }
    }
  }
  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  console.log(`\n合計 ${results.length}枚: ok=${counts.ok ?? 0} check=${counts.check ?? 0} miss=${counts.miss ?? 0}`)
  if ((counts.check ?? 0) + (counts.miss ?? 0) > 0) {
    console.log('※ check / miss の行だけ npm run peek で画像を開いて確かめること（ok は抜き取り確認で足りる）。')
  }
}

function printSql(targets, results) {
  console.log('\n-- denken_question_assets へ反映する UPDATE 文（docs/data-correction-workflow.md §3）')
  console.log('-- Supabase MCP の execute_sql でそのまま実行できる。check / miss の行は要確認。')
  for (const [i, t] of targets.entries()) {
    const r = results[i]
    const sets = KEYS
      .filter(k => r[k] != null)
      .map(k => `${{ questionStartPct: 'question_start_pct', answerYPct: 'answer_y_pct', explanationEndPct: 'explanation_end_pct' }[k]} = ${r[k]}`)
    if (!t.questionId || !t.storagePathLike) {
      console.log(`-- ${t.name}: question_id/storage_path が不明（--paper subject/paperId を指定すると出力できる）`)
      continue
    }
    if (sets.length === 0) { console.log(`-- ${t.name}: 検出できた座標が無いためスキップ`); continue }
    if (r.status !== 'ok') console.log(`-- ⚠️ ${t.name}: ${r.notes.join(' / ')}`)
    console.log(`UPDATE denken_question_assets\n   SET ${sets.join(', ')}\n WHERE question_id = '${t.questionId}'\n   AND storage_path LIKE '${t.storagePathLike}';`)
  }
}

function printTs(targets, results) {
  console.log('\n// PaperDefinition の初期値（未取り込みの回を新規収録するときだけTSに書く）')
  console.log('// 取り込み済みの回は表示にTSの値を使わないので、--sql の方でDBを直すこと。')
  for (const [i, t] of targets.entries()) {
    const r = results[i]
    const fields = KEYS
      .map(k => (r[k] == null ? `${k}: /* 未検出 */` : `${k}: ${r[k]}`))
      .join(', ')
    console.log(`${t.name}: ${fields},${r.status === 'ok' ? '' : `  // ${r.status}: ${r.notes.join(' / ')}`}`)
  }
}

// ---- main ----------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2))
const paper = parsePaper(opts.paper)

if (opts.files.length === 0 && !paper && opts.questionIds.length === 0) {
  fail('対象がありません。画像ファイルか --paper / --question を指定してください（--help で使い方を表示）。')
}

const targets = opts.files.length > 0
  ? await localTargets(opts.files, paper)
  : await remoteTargets(paper, opts.questionIds)

if (!opts.json) console.error(`OCR中… ${targets.length}枚（jpn/${TRAINEDDATA_VARIANT}, 並列${opts.jobs}）`)
let done = 0
const results = await ocrAll(targets, opts.jobs, () => {
  if (!opts.json) process.stderr.write(`\r  ${++done}/${targets.length}枚 完了`)
})
if (!opts.json) process.stderr.write('\n')

if (opts.json) {
  console.log(JSON.stringify(targets.map((t, i) => {
    const r = results[i]
    return {
      file: t.name,
      questionId: t.questionId,
      storagePath: t.storagePath,
      storagePathLike: t.storagePathLike,
      questionStartPct: r.questionStartPct,
      answerYPct: r.answerYPct,
      explanationEndPct: r.explanationEndPct,
      status: r.status,
      notes: r.notes,
      current: t.current,
    }
  }), null, 2))
} else {
  printTable(targets, results, opts.verbose)
  if (opts.sql) printSql(targets, results)
  if (opts.ts) printTs(targets, results)
}

// check / miss が残っている場合は非0で終わる（見落としに気付けるように）。
process.exit(results.every(r => r.status === 'ok') ? 0 : 1)
