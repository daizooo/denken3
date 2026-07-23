#!/usr/bin/env node
// 電験王クローラー（年度別過去問・理論）— パイプライン本体。
//
// 使い方（詳細は README.md）:
//   node crawl.mjs --calibrate r5-1     # 1ページだけ取得しDOM構造をダンプ（初回校正用）
//   node crawl.mjs --dry-run --all      # 取得計画だけ表示（サーバへ問題記事は取りに行かない）
//   node crawl.mjs --paper r7-2         # 1回分を取得（画像 + PaperDefinition を out/ に出力）
//   node crawl.mjs --all                # カタログ全21回を直近回から遡順で取得
//   共通オプション: --delay <ms>（既定6000） --subject riron（現状 riron のみ）
//
// 設計対応: expansion-design §7.4(4)（取り込みワークフロー）/ §9（ビルド時チェック）。
// 出力はいったん out/ に置き、人手で正答を公式正答表と突合してから src/ へ反映する
// （クローラーは常に draft:true で出力する。安全側の既定）。

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { CONFIG, SELECTORS, ANSWER_PATTERNS, toDigit } from './config.mjs'
import {
  PAPER_CATALOG, indexUrl, imageBase, RIRON_STRUCTURE,
} from './catalog.mjs'

// Playwright は本スクリプト専用の依存。未導入なら README の手順で入れる。
// 実処理でのみ必要なので遅延ロードする（--help / 引数検証は依存なしで通す）。
async function loadChromium() {
  try {
    const pw = await import('playwright')
    return pw.chromium
  } catch {
    console.error(
      '✗ playwright が見つかりません。scripts/crawl-denken-ou/ で `npm install` を実行してください。',
    )
    process.exit(1)
  }
}

// ============================================================
// CLI 引数
// ============================================================
function parseArgs(argv) {
  const a = { mode: 'run', papers: [], subject: 'riron', delay: CONFIG.minDelayMs }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--calibrate') { a.mode = 'calibrate'; a.calibrateId = argv[++i] }
    else if (t === '--dry-run') a.mode = 'dry-run'
    else if (t === '--all') a.all = true
    else if (t === '--paper') a.papers.push(argv[++i])
    else if (t === '--subject') a.subject = argv[++i]
    else if (t === '--delay') a.delay = Number(argv[++i])
    else if (t === '--help' || t === '-h') a.mode = 'help'
  }
  return a
}

// ============================================================
// 低負荷 HTTP / robots（サーバに優しく）
// ============================================================
let lastRequestAt = 0
async function throttle(delayMs) {
  const wait = lastRequestAt + delayMs + Math.random() * CONFIG.jitterMs - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
}

/** robots.txt を取得し、UA に対する Disallow パスを返す（順守は isAllowed で判定）。 */
async function loadRobots() {
  if (!CONFIG.respectRobots) return { disallow: [] }
  try {
    const res = await fetch('https://denken-ou.com/robots.txt', {
      headers: { 'user-agent': CONFIG.userAgent },
    })
    if (!res.ok) return { disallow: [] }
    const txt = await res.text()
    const disallow = []
    let applies = false
    for (const raw of txt.split('\n')) {
      const line = raw.replace(/#.*$/, '').trim()
      if (!line) continue
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
      if (!m) continue
      const key = m[1].toLowerCase(); const val = m[2].trim()
      if (key === 'user-agent') applies = val === '*' || CONFIG.userAgent.includes(val)
      else if (key === 'disallow' && applies && val) disallow.push(val)
    }
    return { disallow }
  } catch (e) {
    console.warn(`! robots.txt を取得できませんでした（${e.message}）。安全側で継続を中止します。`)
    throw e
  }
}
function isAllowed(urlPath, robots) {
  return !robots.disallow.some(d => urlPath.startsWith(d))
}

// ============================================================
// Playwright: ページ読み込み（リトライ + スロットル）
// ============================================================
async function gotoWithRetry(page, url, robots, delayMs) {
  const { pathname } = new URL(url)
  if (!isAllowed(pathname, robots)) {
    throw new Error(`robots.txt により ${pathname} は取得不可`)
  }
  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      await throttle(delayMs)
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.navTimeoutMs })
      const status = res?.status() ?? 0
      if (status === 404) return { ok: false, status }
      if (status >= 500 || status === 429) throw new Error(`HTTP ${status}`)
      return { ok: true, status }
    } catch (e) {
      if (attempt === CONFIG.maxRetries) throw e
      const backoff = CONFIG.backoffBaseMs * 2 ** attempt
      console.warn(`  … 再試行 ${attempt + 1}/${CONFIG.maxRetries}（${e.message}）${backoff}ms 待機`)
      await sleep(backoff)
    }
  }
  return { ok: false, status: 0 }
}

// ============================================================
// インデックス解析: 指定科目の「問N → 記事URL」を抽出
//   ▼ 校正ポイント（SELECTORS.index*）。--calibrate で実DOMを確認して調整する。
// ============================================================
async function extractProblemLinks(page, subjectLabel) {
  return await page.evaluate((label) => {
    // 内容領域内を文書順に走査し、見出しで現在の科目を切り替えながら
    // 「問N」に見えるリンクを現在科目に紐付ける。クラス名に依存しない方式。
    const root =
      document.querySelector('main') ||
      document.querySelector('.entry-content') ||
      document.querySelector('article') ||
      document.body
    const SUBJECTS = ['理論', '電力', '機械', '法規']
    const out = []
    let current = null
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
    let node = walker.currentNode
    while (node) {
      const tag = node.tagName
      if (/^H[1-6]$/.test(tag)) {
        const t = (node.textContent || '').trim()
        const hit = SUBJECTS.find(s => t.includes(s))
        if (hit) current = hit
      } else if (tag === 'A') {
        const text = (node.textContent || '').trim()
        const m = text.match(/問\s*([0-9０-９]+)/)
        const href = node.getAttribute('href') || ''
        if (m && current === label && /denken-ou\.com/.test(href)) {
          const num = Number(m[1].replace(/[０-９]/g, d => '０１２３４５６７８９'.indexOf(d)))
          if (num >= 1 && num <= 18) out.push({ number: num, url: href, text })
        }
      }
      node = walker.nextNode()
    }
    // 同じ問番号の重複は先着を採用
    const seen = new Set()
    return out.filter(o => (seen.has(o.number) ? false : (seen.add(o.number), true)))
  }, subjectLabel)
}

// ============================================================
// 記事解析: 問題領域/解説領域の境界 y と、正答・トピックを得る
//   ▼ 校正ポイント（SELECTORS.article* / explanationHeadingText）。
// ============================================================
async function analyzeArticle(page, headingTexts) {
  return await page.evaluate((headings) => {
    const root =
      document.querySelector('.entry-content') ||
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.body
    const rect = root.getBoundingClientRect()
    const scrollY = window.scrollY
    // 解説の開始見出しを探す（「解説」等を含む最初の見出し）
    let boundaryTop = null
    for (const el of root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b')) {
      const t = (el.textContent || '').trim()
      if (headings.some(h => t === h || t.startsWith(h))) {
        boundaryTop = el.getBoundingClientRect().top + scrollY
        break
      }
    }
    const title = (document.querySelector('h1')?.textContent || document.title || '').trim()
    const fullText = (root.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      contentX: rect.left + window.scrollX,
      contentWidth: rect.width,
      contentTop: rect.top + scrollY,
      contentBottom: rect.bottom + scrollY,
      boundaryTop, // 解説見出しの y（無ければ null）
      title,
      fullText,
    }
  }, headingTexts)
}

/** 記事テキストから正答を読む。A問題は単答、B問題は (a)(b)。 */
function extractAnswers(fullText, section) {
  if (section === 'B') {
    const parts = {}
    for (const re of ANSWER_PATTERNS.labeled) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(fullText)) !== null) {
        const label = m[1].toLowerCase()
        if (!(label in parts)) parts[label] = toDigit(m[2])
      }
    }
    return { a: parts.a ?? null, b: parts.b ?? null }
  }
  for (const re of ANSWER_PATTERNS.single) {
    const m = fullText.match(re)
    if (m) return { value: toDigit(m[1]) }
  }
  return { value: null }
}

// ============================================================
// 画像出力（Playwright スクリーンショット）
// ============================================================
async function shoot(page, clip, outPath) {
  // clip は文書座標。負/0 高さは撮らない。
  if (!clip || clip.height <= 2 || clip.width <= 2) return false
  await page.screenshot({ path: outPath, clip })
  return true
}

// ============================================================
// PaperDefinition (.ts) 生成
// ============================================================
function renderPaperTs(paper, questions) {
  const lines = questions.map((q) => {
    const parts = q.parts
      .map(p => `{ ${p.label ? `label: '${p.label}', ` : ''}correct: ${p.correct}, points: ${p.points} }`)
      .join(', ')
    const extra = [
      q.selectable ? 'selectable: true' : '',
      q.topic ? `topic: ${JSON.stringify(q.topic)}` : '',
      q.explanationUrl ? `explanationUrl: ${JSON.stringify(q.explanationUrl)}` : '',
    ].filter(Boolean).join(', ')
    const todo = q.parts.some(p => p.correct === 0) ? ' // TODO 正答を公式正答表で確認' : ''
    const expField = q.explanationFile ? `explanationFile: '${q.explanationFile}', ` : ''
    return `    { id: '${q.id}', section: '${q.section}', number: ${q.number}, ` +
      `imageFile: '${q.imageFile}', ${expField}` +
      `parts: [${parts}]${extra ? ', ' + extra : ''} },${todo}`
  }).join('\n')

  return `// ${paper.name} 理論（${paper.id}）— 電験王クローラー自動生成。
// 生成元: crawl-denken-ou（私的学習利用）。取得元URLは各問 explanationUrl を参照。
//
// ⚠ 反映前チェック（設計 §7.4(4)-2 / §9）:
//   1. 各問の correct を公式正答表（電気技術者試験センター）と突合して確定する。
//   2. 画像 out/${paper.id}/*.png を ImportPanel「年度別」で ${paper.id} へアップロード。
//   3. 問題数・配点合計100点を確認できたら draft を外す（validatePaper が最終検証）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const ${paper.id.toUpperCase().replace(/-/g, '_')}: PaperDefinition = {
  id: '${paper.id}',
  examId: 'denken3' satisfies ExamId,
  subjectId: '${RIRON_STRUCTURE.subjectId}',
  name: '${paper.name}',
  timeLimitMin: ${RIRON_STRUCTURE.timeLimitMin},
  draft: true, // 正答確定＋画像アップロード後に false
  questions: [
${lines}
  ],
}
`
}

// ============================================================
// 1回分の取得
// ============================================================
async function crawlPaper(browser, robots, entry, args) {
  const url = indexUrl(entry.id)
  console.log(`\n■ ${entry.name}（${entry.id}） ${url}`)
  const page = await browser.newPage({
    userAgent: CONFIG.userAgent,
    viewport: { width: CONFIG.imageWidthPx, height: 2000 },
    deviceScaleFactor: CONFIG.deviceScaleFactor,
  })
  const paperOut = path.join(CONFIG.outDir, entry.id)
  await fsp.mkdir(paperOut, { recursive: true })

  try {
    const idx = await gotoWithRetry(page, url, robots, args.delay)
    if (!idx.ok) {
      console.log(`  … インデックス未掲載（HTTP ${idx.status}）。スキップ（後日再取得）。`)
      return { id: entry.id, skipped: true }
    }
    const links = await extractProblemLinks(page, RIRON_STRUCTURE.subjectLabelOnSite)
    console.log(`  理論の問リンク: ${links.length} 件`)
    if (args.mode === 'dry-run') {
      links.forEach(l => console.log(`    問${l.number} → ${l.url}`))
      return { id: entry.id, dryRun: true, count: links.length }
    }

    const [bLo] = RIRON_STRUCTURE.bRange
    const questions = []
    for (const link of links.sort((a, b) => a.number - b.number)) {
      const base = imageBase(link.number)
      const section = link.number >= bLo ? 'B' : 'A'
      const imgFile = `${base}.png`
      const expFile = `${base}_exp.png`
      const imgPath = path.join(paperOut, imgFile)
      const expPath = path.join(paperOut, expFile)

      const res = await gotoWithRetry(page, link.url, robots, args.delay)
      if (!res.ok) { console.log(`  ✗ 問${link.number} 取得失敗（HTTP ${res.status}）`); continue }
      const meta = await analyzeArticle(page, SELECTORS.explanationHeadingText)

      // 画像: 問題領域（内容top→解説見出し）と解説領域（解説見出し→内容bottom）
      const x = Math.max(0, Math.floor(meta.contentX))
      const w = Math.floor(meta.contentWidth)
      const top = Math.max(0, Math.floor(meta.contentTop))
      const bottom = Math.floor(meta.contentBottom)
      const bnd = meta.boundaryTop != null ? Math.floor(meta.boundaryTop) : bottom
      await shoot(page, { x, y: top, width: w, height: bnd - top }, imgPath)
      const hasExp = await shoot(page, { x, y: bnd, width: w, height: bottom - bnd }, expPath)

      // 正答・トピック
      const ans = extractAnswers(meta.fullText, section)
      const topic = meta.title.replace(/^.*問\s*[0-9０-９]+\s*/, '').trim() || undefined
      const q = {
        id: `${entry.id}_${base}`,
        section, number: link.number, imageFile: imgFile,
        // 解説境界が取れず解説画像を出せなかった場合は未設定にする（存在しないファイルを参照しない）。
        explanationFile: hasExp ? expFile : undefined,
        selectable: section === 'B' && link.number >= RIRON_STRUCTURE.selectableFrom,
        explanationUrl: link.url,
        topic,
        parts: section === 'A'
          ? [{ correct: ans.value ?? 0, points: RIRON_STRUCTURE.aPoints }]
          : [
              { label: '(a)', correct: ans.a ?? 0, points: RIRON_STRUCTURE.bPartPoints },
              { label: '(b)', correct: ans.b ?? 0, points: RIRON_STRUCTURE.bPartPoints },
            ],
      }
      questions.push(q)
      const shown = section === 'A' ? `正答=${ans.value ?? '?'}` : `(a)=${ans.a ?? '?'} (b)=${ans.b ?? '?'}`
      console.log(`  ✓ 問${link.number} [${section}] ${shown}${meta.boundaryTop == null ? ' ※解説境界未検出' : ''}`)
    }

    // PaperDefinition 出力
    const tsPath = path.join(CONFIG.outDir, `${entry.id}.ts`)
    await fsp.writeFile(tsPath, renderPaperTs(entry, questions), 'utf8')
    const missing = questions.filter(q => q.parts.some(p => p.correct === 0)).length
    console.log(`  → 画像 out/${entry.id}/ , 定義 out/${entry.id}.ts（未確定正答 ${missing} 問）`)
    return { id: entry.id, count: questions.length, missing }
  } finally {
    await page.close()
  }
}

// ============================================================
// 校正モード: 1回分のインデックス + 先頭記事の構造をダンプ
// ============================================================
async function calibrate(browser, robots, id, args) {
  const entry = PAPER_CATALOG.find(p => p.id === id)
  if (!entry) { console.error(`未知の paperId: ${id}`); return }
  const dir = path.join(CONFIG.outDir, '_calibrate', id)
  await fsp.mkdir(dir, { recursive: true })
  const page = await browser.newPage({
    userAgent: CONFIG.userAgent,
    viewport: { width: CONFIG.imageWidthPx, height: 2000 },
    deviceScaleFactor: CONFIG.deviceScaleFactor,
  })
  try {
    console.log(`\n□ 校正: ${entry.name}（${id}）`)
    const idx = await gotoWithRetry(page, indexUrl(id), robots, args.delay)
    if (!idx.ok) { console.log(`  インデックス HTTP ${idx.status}`); return }
    await fsp.writeFile(path.join(dir, 'index.html'), await page.content(), 'utf8')
    await page.screenshot({ path: path.join(dir, 'index.png'), fullPage: true })
    const links = await extractProblemLinks(page, RIRON_STRUCTURE.subjectLabelOnSite)
    await fsp.writeFile(path.join(dir, 'links.json'), JSON.stringify(links, null, 2), 'utf8')
    console.log(`  index.html / index.png / links.json を出力（理論リンク ${links.length} 件）`)

    if (links.length > 0) {
      const first = links.sort((a, b) => a.number - b.number)[0]
      const res = await gotoWithRetry(page, first.url, robots, args.delay)
      if (res.ok) {
        await fsp.writeFile(path.join(dir, 'article.html'), await page.content(), 'utf8')
        await page.screenshot({ path: path.join(dir, 'article.png'), fullPage: true })
        const meta = await analyzeArticle(page, SELECTORS.explanationHeadingText)
        await fsp.writeFile(path.join(dir, 'article-meta.json'), JSON.stringify(meta, null, 2), 'utf8')
        console.log(`  問${first.number} の article.html / article.png / article-meta.json を出力`)
        console.log(`  → SELECTORS / ANSWER_PATTERNS / explanationHeadingText を実DOMと突合して確定してください。`)
      }
    }
  } finally {
    await page.close()
  }
}

// ============================================================
// エントリポイント
// ============================================================
const HELP = `電験王クローラー（年度別・理論）
  node crawl.mjs --calibrate <paperId>   初回校正（1ページだけ取得しDOMをダンプ）
  node crawl.mjs --dry-run --all         取得計画のみ表示
  node crawl.mjs --paper <id> [--paper..] 指定回を取得
  node crawl.mjs --all                   全21回を直近回から遡順で取得
  オプション: --delay <ms>(既定6000) --subject riron
出力: out/<id>/*.png（問題・解説画像） と out/<id>.ts（PaperDefinition, draft:true）`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.mode === 'help') { console.log(HELP); return }

  // 対象の確定（ネットワーク/ブラウザに触れる前に検証する）。
  const targets = args.mode === 'calibrate'
    ? []
    : (args.all ? PAPER_CATALOG : PAPER_CATALOG.filter(p => args.papers.includes(p.id)))
  if (args.mode !== 'calibrate' && targets.length === 0) {
    console.log('対象がありません。--paper か --all を指定してください。\n')
    console.log(HELP)
    return
  }
  if (args.mode === 'calibrate' && !args.calibrateId) {
    console.log('--calibrate には paperId が必要です（例: --calibrate r5-1）。\n')
    console.log(HELP)
    return
  }

  if (!fs.existsSync(CONFIG.outDir)) await fsp.mkdir(CONFIG.outDir, { recursive: true })

  console.log(`robots.txt を確認中…`)
  const robots = await loadRobots()
  if (robots.disallow.length) console.log(`  Disallow: ${robots.disallow.join(', ')}`)

  const chromium = await loadChromium()
  const browser = await chromium.launch({ headless: true })
  try {
    if (args.mode === 'calibrate') { await calibrate(browser, robots, args.calibrateId, args); return }

    const summary = []
    for (const entry of targets) summary.push(await crawlPaper(browser, robots, entry, args))

    console.log('\n==== サマリ ====')
    for (const s of summary) {
      if (s.skipped) console.log(`  ${s.id}: スキップ（未掲載）`)
      else if (s.dryRun) console.log(`  ${s.id}: ${s.count} 問（dry-run）`)
      else console.log(`  ${s.id}: ${s.count} 問取得 / 未確定正答 ${s.missing} 問`)
    }
    console.log('\n次の手順は README.md「取り込み反映」節を参照。')
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('✗ 異常終了:', e); process.exit(1) })
