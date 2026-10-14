// 正答PDF（「合格基準及び正答について」）の抽出テキスト → 正答（licensehub-expansion.md §13・PR-D）。純関数。
//
// 表の向きはどちらでも読む（行ごとに独立して判定する。合格基準の文章の行は読み飛ばす）:
//   択一式  「問1  C B D A E C B」（科目の並びに7つ）  または 「労働基準法及び労働安全衛生法  A C E B D A B C D E」（問1〜10）
//   選択式  「労働基準法及び労働安全衛生法  ③ ⑫ ⑤ ⑱ ⑨」（空欄A〜E）  または 「A  ③ ⑪ …」（科目の並びに8つ）
// 読めない表記（「B又はD」「全員正解」など）は null にして、ゲートで「正答なし」と理由を出す（補正は corrections）。
//
// 試験センターの正答PDF（R6〜R8。pdftotext -layout）は、1つの表に選択式（空欄Ａ〜Ｅ）と択一式（問1〜10）が並び、
// 科目名が複数行に折り返す。見出し行「Ａ Ｂ Ｃ Ｄ Ｅ 1 2 … 10」があれば、列の位置で読む（parseAnswerGrid）。
import type { ItemLabel } from '../../../domain/license.ts'
import { ITEM_LABELS, normalizeLabel } from '../../../domain/license.ts'
import { SENTAKU_ORDER, subjectAtLineStart, TAKU_ORDER, TAKU_QUESTIONS_PER_SUBJECT } from './subjects.ts'
import { circledToNumber, splitLines, toHalfWidth } from './text.ts'
import type { OfficialAnswers, OfficialIssue } from './types.ts'

const tokens = (s: string) => s.split(/[\s\u3000|｜]+/).filter(t => t !== '')

const letterOf = (t: string): ItemLabel | null => {
  const h = toHalfWidth(t)
  return /^[A-E]$/.test(h) ? (h as ItemLabel) : null
}

const numberOf = (t: string): number | null => {
  if (t.length === 1 && circledToNumber(t) !== null) return circledToNumber(t)
  const h = toHalfWidth(t)
  return /^\d{1,2}$/.test(h) ? Number(h) : null
}

// 空白を除いて n 文字ぶん（科目名）を読み進めた残り
function afterName(line: string, n: number): string {
  let seen = 0
  let i = 0
  while (i < line.length && seen < n) {
    if (!/[\s\u3000]/.test(line[i])) seen++
    i++
  }
  return line.slice(i)
}

export function emptyAnswers(): OfficialAnswers {
  return { taku: {}, sentaku: {} }
}

// ---------------------------------------------------------------------------
// 列の位置で読む表（選択式＋択一式の1つの表）
//
// - 丸数字が5つの行 → 選択式の次の科目（SENTAKU_ORDER の順）
// - 英字（A〜E）・「/」が並ぶ行 → 択一式。各字を見出しの列（問1〜10）に当て、いまの科目で埋まっている列に当たったら次の科目へ
//   （R6 の一般常識のように、問1〜5 と問6〜10 が別の行に分かれていても1科目として読む）
// - 英字1〜2字だけの行（上下に積まれた「C／D」、R8 は「/」の上下に D／E）→ 近い行の、空いている（または「/」の）列の正答の候補。
//   候補が2つ以上の列は null と理由（公表どおりなら corrections の multi で指定する）
function gridHeader(lines: string[]): { at: number; cols: number[] } | null {
  for (let at = 0; at < lines.length; at++) {
    const cols: number[] = []
    for (let q = 1; q <= TAKU_QUESTIONS_PER_SUBJECT; q++) {
      const re = new RegExp(`(?<=[\\s　])${q}(?![0-9])`, 'g')
      const m = [...lines[at].matchAll(re)].find(x => cols.length === 0 || x.index! > cols[cols.length - 1])
      if (!m) break
      cols.push(m.index! + (String(q).length - 1) / 2)
    }
    if (cols.length === TAKU_QUESTIONS_PER_SUBJECT && /[ＡA][\s　]+[ＢB][\s　]+[ＣC][\s　]+[ＤD][\s　]+[ＥE]/.test(lines[at])) return { at, cols }
  }
  return null
}

function parseAnswerGrid(text: string, year: string): { answers: OfficialAnswers; issues: OfficialIssue[] } | null {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\f/g, '\n').split('\n')
  const head = gridHeader(lines)
  if (!head) return null
  const answers = emptyAnswers()
  const issues: OfficialIssue[] = []
  const nearest = (x: number) => head.cols.reduce((best, c, i) => (Math.abs(c - x) < Math.abs(head.cols[best] - x) ? i : best), 0)

  type Row = { line: number; subject: number; cells: Map<number, string> }
  const rows: Row[] = []
  const stacked: { line: number; col: number; letter: string }[] = []
  let sentakuAt = 0
  let takuAt = -1
  let filled = new Set<number>()
  for (let i = head.at + 1; i < lines.length; i++) {
    const line = lines[i]
    const circled = [...line].filter(c => circledToNumber(c) !== null)
    if (circled.length === ITEM_LABELS.length) {
      const code = SENTAKU_ORDER[sentakuAt++]
      if (code) answers.sentaku[code] = Object.fromEntries(ITEM_LABELS.map((l, k) => [l, circledToNumber(circled[k])]))
    }
    // 科目名の後ろ（表の列の範囲）にある英字・「/」1字のトークン
    const letters = [...line.matchAll(/(?<=^|[\s　])([A-EＡ-Ｅ/／])(?=[\s　]|$)/g)].filter(m => m.index! >= head.cols[0] - 2)
    if (letters.length === 0) continue
    const cells = new Map(letters.map(m => [nearest(m.index!), toHalfWidth(m[1]).replace('／', '/')]))
    if (letters.length <= 2 && circled.length === 0 && ![...cells.values()].includes('/')) {
      cells.forEach((letter, col) => stacked.push({ line: i, col, letter }))
      continue
    }
    if (takuAt < 0 || [...cells.keys()].some(c => filled.has(c))) { takuAt++; filled = new Set() }
    cells.forEach((_, c) => filled.add(c))
    rows.push({ line: i, subject: takuAt, cells })
  }

  const candidates = new Map<string, string[]>()   // 'IP-9' → ['D', 'E']
  for (const s of stacked) {
    const open = rows.filter(r => !r.cells.has(s.col) || r.cells.get(s.col) === '/')
      .sort((a, b) => Math.abs(a.line - s.line) - Math.abs(b.line - s.line))[0]
    if (!open) continue
    const key = `${open.subject}-${s.col}`
    candidates.set(key, [...(candidates.get(key) ?? []), s.letter])
  }
  for (const r of rows) {
    const code = TAKU_ORDER[r.subject]
    if (!code) { issues.push({ level: 'error', where: `${year} 正答 択一`, reason: `表の行が科目より多い: ${lines[r.line].trim()}` }); continue }
    const arr = (answers.taku[code] ??= Array.from({ length: TAKU_QUESTIONS_PER_SUBJECT }, () => null))
    r.cells.forEach((v, col) => { if (v !== '/') arr[col] = v as ItemLabel })
  }
  candidates.forEach((letters, key) => {
    const [subject, col] = key.split('-').map(Number)
    const code = TAKU_ORDER[subject]
    if (!code) return
    const arr = (answers.taku[code] ??= Array.from({ length: TAKU_QUESTIONS_PER_SUBJECT }, () => null))
    if (letters.length === 1) { arr[col] = letters[0] as ItemLabel; return }
    arr[col] = null
    issues.push({ level: 'warning', where: `${year} 正答 択一 ${code} 問${col + 1}`, reason: `正答が複数（${letters.join('・')}）。公表どおりなら corrections の multi で指定する` })
  })
  return { answers, issues }
}

export function parseAnswersText(text: string, year: string): { answers: OfficialAnswers; issues: OfficialIssue[] } {
  const grid = parseAnswerGrid(text, year)
  if (grid) return grid
  const answers = emptyAnswers()
  const issues: OfficialIssue[] = []
  const setTaku = (code: string, qNo: number, v: ItemLabel | null, raw: string) => {
    const arr = (answers.taku[code] ??= Array.from({ length: TAKU_QUESTIONS_PER_SUBJECT }, () => null))
    if (arr[qNo - 1] !== null && arr[qNo - 1] !== v) {
      issues.push({ level: 'error', where: `${year} 正答 択一 ${code} 問${qNo}`, reason: `正答が2通り読めた: ${arr[qNo - 1]} / ${raw}` })
    }
    arr[qNo - 1] = v
    if (v === null) issues.push({ level: 'warning', where: `${year} 正答 択一 ${code} 問${qNo}`, reason: `正答の表記を読めない: ${raw}` })
  }
  const setSentaku = (code: string, label: ItemLabel, v: number | null, raw: string) => {
    const rec = (answers.sentaku[code] ??= {})
    rec[label] = v
    if (v === null) issues.push({ level: 'warning', where: `${year} 正答 選択式 ${code} ${label}`, reason: `正答の表記を読めない: ${raw}` })
  }

  for (const line of splitLines(text)) {
    const half = toHalfWidth(line).replace(/\s+/g, ' ').trim()
    // 択一: 問N + 7つ
    const q = half.match(/^問\s*(\d{1,2})\s+(.*)$/)
    if (q) {
      const ts = tokens(q[2])
      const n = Number(q[1])
      if (ts.length === TAKU_ORDER.length && ts.filter(letterOf).length >= TAKU_ORDER.length - 2 && n >= 1 && n <= TAKU_QUESTIONS_PER_SUBJECT) {
        TAKU_ORDER.forEach((code, i) => setTaku(code, n, letterOf(ts[i]), ts[i]))
        continue
      }
    }
    // 選択式: 空欄 + 8つ
    const b = half.match(/^([A-E])\s+(.*)$/)
    if (b) {
      const ts = tokens(b[2])
      if (ts.length === SENTAKU_ORDER.length && ts.filter(t => numberOf(t) !== null).length >= SENTAKU_ORDER.length - 2) {
        SENTAKU_ORDER.forEach((code, i) => setSentaku(code, b[1] as ItemLabel, numberOf(ts[i]), ts[i]))
        continue
      }
    }
    // 科目名 + 10（択一）／ 5（選択式）。科目名の途中の空白（表の折り返し）は詰めて照合する
    const nospace = line.replace(/[\s\u3000]/g, '')
    for (const format of ['taku', 'sentaku'] as const) {
      const s = subjectAtLineStart(nospace, format)
      if (!s) continue
      const ts0 = tokens(afterName(line, nospace.length - s.rest.length).replace(/^[（(][^）)]*[）)]/, ''))
      // 「ACEBDABCDE」のように詰まった行は1字ずつに分ける
      const ts = ts0.length === 1 && /^[A-EＡ-Ｅ]{10}$/.test(ts0[0]) ? [...ts0[0]] : ts0
      if (format === 'taku' && ts.length === TAKU_QUESTIONS_PER_SUBJECT && ts.filter(letterOf).length >= 8) {
        ts.forEach((t, i) => setTaku(s.code, i + 1, letterOf(t), t))
        break
      }
      if (format === 'sentaku' && ts.length === ITEM_LABELS.length && ts.filter(t => numberOf(t) !== null).length >= 3) {
        ts.forEach((t, i) => setSentaku(s.code, ITEM_LABELS[i], numberOf(t), t))
        break
      }
    }
  }
  return { answers, issues }
}

// 正答JSON（手で書いた／中間JSONの answers）の形を確かめる。taku は科目 → 'ACEBD…'（10文字）か配列。
export function answersFromJson(input: unknown): { answers: OfficialAnswers; reasons: string[] } {
  const answers = emptyAnswers()
  const reasons: string[] = []
  if (typeof input !== 'object' || input === null) return { answers, reasons: ['正答JSONがオブジェクトでない'] }
  const o = input as Record<string, unknown>
  for (const [code, v] of Object.entries((o.taku ?? {}) as Record<string, unknown>)) {
    const arr = typeof v === 'string' ? [...v.replace(/\s/g, '')] : Array.isArray(v) ? v : null
    if (!arr) { reasons.push(`taku.${code} が文字列・配列でない`); continue }
    answers.taku[code] = arr.map(x => (typeof x === 'string' ? normalizeLabel(x) : null))
  }
  for (const [code, v] of Object.entries((o.sentaku ?? {}) as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      answers.sentaku[code] = Object.fromEntries(v.map((x, i) => [ITEM_LABELS[i], typeof x === 'number' ? x : null]))
    } else if (typeof v === 'object' && v !== null) {
      answers.sentaku[code] = Object.fromEntries(Object.entries(v).map(([k, x]) => [normalizeLabel(k) ?? k, typeof x === 'number' ? x : null]))
    } else reasons.push(`sentaku.${code} が配列・オブジェクトでない`)
  }
  return { answers, reasons }
}
