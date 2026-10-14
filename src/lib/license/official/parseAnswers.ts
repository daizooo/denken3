// 正答PDF（「合格基準及び正答について」）の抽出テキスト → 正答（licensehub-expansion.md §13・PR-D）。純関数。
//
// 表の向きはどちらでも読む（行ごとに独立して判定する。合格基準の文章の行は読み飛ばす）:
//   択一式  「問1  C B D A E C B」（科目の並びに7つ）  または 「労働基準法及び労働安全衛生法  A C E B D A B C D E」（問1〜10）
//   選択式  「労働基準法及び労働安全衛生法  ③ ⑫ ⑤ ⑱ ⑨」（空欄A〜E）  または 「A  ③ ⑪ …」（科目の並びに8つ）
// 読めない表記（「B又はD」「全員正解」など）は null にして、ゲートで「正答なし」と理由を出す（補正は corrections）。
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

export function parseAnswersText(text: string, year: string): { answers: OfficialAnswers; issues: OfficialIssue[] } {
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
