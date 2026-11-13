// 2級建設業経理士の自動採点（docs/design/kenkei2.md §4.2）。すべて純関数。
import { isBlank, parseAmount, parseSymbol, parseText } from './normalize.ts'
import type { Cell, JournalInput, JournalKey, JournalLine } from './types.ts'

export interface CellResult {
  id: string
  ok: boolean
  expected: number | string
  /** 正規化後の入力（未入力・解釈不能は null）。 */
  given: number | string | null
  points: number
  earned: number
}

export interface GradeResult {
  earned: number
  max: number
  /** 0〜1。配点0なら 0。 */
  rate: number
  cells: CellResult[]
}

function rateOf(earned: number, max: number): number {
  return max > 0 ? earned / max : 0
}

/**
 * 採点マス（金額・記号）を採点する。answers は id → 画面の生の入力。
 * group が同じマスは全部正解のときだけ、各マスの配点を得点にする。
 */
export function gradeCells(cells: Cell[], answers: Record<string, string | undefined>): GradeResult {
  const given = new Map<string, number | string | null>()
  const ok = new Map<string, boolean>()
  for (const c of cells) {
    const raw = answers[c.id]
    const v = c.kind === 'amount' ? parseAmount(raw) : c.kind === 'symbol' ? parseSymbol(raw) : parseText(raw)
    const expected = c.kind === 'text' ? parseText(String(c.expected)) : c.expected
    given.set(c.id, v)
    ok.set(c.id, v !== null && v === expected)
  }
  const groupOk = new Map<string, boolean>()
  for (const c of cells) {
    if (c.group !== undefined) groupOk.set(c.group, (groupOk.get(c.group) ?? true) && ok.get(c.id) === true)
  }
  const results = cells.map((c): CellResult => {
    const pass = c.group !== undefined ? groupOk.get(c.group) === true : ok.get(c.id) === true
    return {
      id: c.id, ok: ok.get(c.id) === true, expected: c.expected, given: given.get(c.id) ?? null,
      points: c.points, earned: pass ? c.points : 0,
    }
  })
  const earned = results.reduce((s, r) => s + r.earned, 0)
  const max = results.reduce((s, r) => s + r.points, 0)
  return { earned, max, rate: rateOf(earned, max), cells: results }
}

// ---- 仕訳 ----

export interface JournalSideLine {
  symbol: string
  expected: number
  /** その科目に入力した金額の合計（入力が無ければ 0）。 */
  given: number
  ok: boolean
}

export interface JournalResult {
  earned: number
  max: number
  rate: number
  ok: boolean
  debit: JournalSideLine[]
  credit: JournalSideLine[]
  /** 正答に無い科目、または記号が解釈できないのに金額がある行があるか（誤りの手がかり表示用）。 */
  extra: boolean
}

/** 同じ科目の行を合算する（科目ごとの合計で比べる）。 */
function totals(lines: JournalLine[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of lines) m.set(l.symbol, (m.get(l.symbol) ?? 0) + l.amount)
  return m
}

/**
 * 入力行を (記号, 金額) にする。両方空の行は無視。金額が無い行は 0 円として扱い、合算に影響しない。
 * 金額があるのに記号が解釈できない行は bad=true（採点不能＝不正解）。
 */
function readSide(lines: JournalInput['debit']): { lines: JournalLine[]; bad: boolean } {
  const out: JournalLine[] = []
  let bad = false
  for (const l of lines) {
    if (isBlank(l.symbol) && isBlank(l.amount)) continue
    const amount = parseAmount(l.amount)
    const symbol = parseSymbol(l.symbol)
    if (amount === null || amount === 0) {
      // 記号だけで金額が無い行は 0 円の行。記号が不正でも金額が無いので無視する
      if (!isBlank(l.amount) && amount === null) bad = true
      continue
    }
    if (symbol === null) { bad = true; continue }
    out.push({ symbol, amount })
  }
  return { lines: out, bad }
}

function compareSide(key: JournalLine[], given: JournalLine[]): { rows: JournalSideLine[]; same: boolean } {
  const k = totals(key)
  const g = totals(given)
  const rows = [...k].map(([symbol, expected]): JournalSideLine => {
    const v = g.get(symbol) ?? 0
    return { symbol, expected, given: v, ok: v === expected }
  })
  const extra = [...g.keys()].some(s => !k.has(s))
  return { rows, same: rows.every(r => r.ok) && !extra }
}

/**
 * 仕訳1組を採点する。借方・貸方それぞれの行の順序は問わない。
 * 同じ科目を複数行に分けて入力しても、科目ごとの合計で比べる。全部正解のときだけ配点どおり。
 */
export function gradeJournal(key: JournalKey, input: JournalInput, points: number): JournalResult {
  const d = readSide(input.debit)
  const c = readSide(input.credit)
  const dc = compareSide(key.debit, d.lines)
  const cc = compareSide(key.credit, c.lines)
  const ok = dc.same && cc.same && !d.bad && !c.bad
  const earned = ok ? points : 0
  const knownD = new Set(key.debit.map(l => l.symbol))
  const knownC = new Set(key.credit.map(l => l.symbol))
  const extra = d.bad || c.bad
    || d.lines.some(l => !knownD.has(l.symbol)) || c.lines.some(l => !knownC.has(l.symbol))
  return { earned, max: points, rate: rateOf(earned, points), ok, debit: dc.rows, credit: cc.rows, extra }
}
