// kk2_questions の1行（カード）の型と、カード全体の採点（docs/design/kenkei2.md §5・K4）。すべて純関数。
// 画面（src/features/kenkei2）は、この型で DB の行を読み、gradeCard で採点する。
import { gradeCells, gradeJournal, type CellResult, type GradeResult, type JournalResult } from './grade.ts'
import type { Cell, JournalInput, JournalKey } from './types.ts'

export type Box = [number, number, number, number]

export interface JournalFrame { symbols: [string, string][] }
export interface JournalCardKey { debit: { s: string; a: number }[]; credit: { s: string; a: number }[] }
export interface AmountFrame { unit: string }
export interface AmountCardKey { value: number }

/** 第3・4問: 解答用紙の複製（words・rules）と採点単位（units）。座標は解答PDFのページ上の位置（pt）。 */
export interface SheetFrame {
  box: Box
  page: number
  words: [string, number, number, number, number][]
  rules: Box[]
  units: { id: string; points: number; cells: { k: 'a' | 's' | 't'; box: Box }[] }[]
  /** 採点前は隠す語（words の添字）。採点対象外の途中の数値（ヒントになるもの）。 */
  hide?: number[]
}
/** 'セルID' → 正答。セルID = `${unit.id}.${何番目のセルか}` */
export type SheetCardKey = Record<string, number | string>

export interface SettlementFrame { accounts: { n: string; tb: [number, number] }[]; tbTotal: [number, number] }
export type SettlementCol = 'tb_d' | 'tb_c' | 'adj_d' | 'adj_c' | 'pl_d' | 'pl_c' | 'bs_d' | 'bs_c'
export interface SettlementCardKey {
  accounts: { n: string; tb: [number, number]; adj: [number[], number[]]; pl: [number, number]; bs: [number, number] }[]
  netIncome: number
  scored: { row: number | 'ni'; col: SettlementCol | 'label'; v: number | string }[]
}

export type Kk2Row =
  | { id: string; exam_no: number; part: number; sub: number; points: number; stem: string; form_kind: 'journal'; frame: JournalFrame; key: JournalCardKey }
  | { id: string; exam_no: number; part: number; sub: number; points: number; stem: string; form_kind: 'amount'; frame: AmountFrame; key: AmountCardKey }
  | { id: string; exam_no: number; part: number; sub: number; points: number; stem: string; form_kind: 'sheet'; frame: SheetFrame; key: SheetCardKey }
  | { id: string; exam_no: number; part: number; sub: number; points: number; stem: string; form_kind: 'settlement'; frame: SettlementFrame; key: SettlementCardKey }

/** 精算表の採点マス1つの配点（解答PDFの凡例: 1つにつき2点）。 */
export const SETTLEMENT_CELL_POINTS = 2

/** 画面の入力。journal は仕訳の行、それ以外はセルID → 生の入力。 */
export interface CardInput {
  journal?: JournalInput
  answers: Record<string, string>
}

export type CardResult =
  | { kind: 'journal'; earned: number; max: number; rate: number; journal: JournalResult }
  | { kind: 'cells'; earned: number; max: number; rate: number; cells: CellResult[] }

/** 精算表の採点マスのID（行の添字と列。当期純利益の行は 'ni'）。 */
export const settlementCellId = (row: number | 'ni', col: string) => `${row}.${col}`

export function journalKeyOf(key: JournalCardKey): JournalKey {
  return {
    debit: key.debit.map(l => ({ symbol: l.s, amount: l.a })),
    credit: key.credit.map(l => ({ symbol: l.s, amount: l.a })),
  }
}

/** 第3・4問の採点マス。1つの採点単位に複数の欄（記号＋金額など）があれば group で全部正解のときだけ得点する。 */
export function sheetCells(frame: SheetFrame, key: SheetCardKey): Cell[] {
  // 単位の配点は先頭の欄に載せる（割り算の端数を作らない。group の全部が正解のときだけ得点）
  return frame.units.flatMap(u => u.cells.map((c, i): Cell => ({
    id: `${u.id}.${i}`,
    kind: c.k === 'a' ? 'amount' : c.k === 's' ? 'symbol' : 'text',
    expected: key[`${u.id}.${i}`],
    points: i === 0 ? u.points : 0,
    ...(u.cells.length > 1 ? { group: u.id } : {}),
  })))
}

/** 精算表の採点マス。当期純利益の見出し（第34回）を解答欄とする回は、見出し＋金額を1単位とする。 */
export function settlementCells(key: SettlementCardKey): Cell[] {
  const hasLabel = key.scored.some(s => s.row === 'ni' && s.col === 'label')
  let niFirst = true
  return key.scored.map((s): Cell => {
    const inGroup = s.row === 'ni' && hasLabel
    const points = inGroup ? (niFirst ? SETTLEMENT_CELL_POINTS : 0) : SETTLEMENT_CELL_POINTS
    if (inGroup) niFirst = false
    return {
      id: settlementCellId(s.row, s.col),
      kind: typeof s.v === 'number' ? 'amount' : 'text',
      expected: s.v,
      points,
      ...(inGroup ? { group: 'ni' } : {}),
    }
  })
}

/** そのカードの「採点マス」の一覧（仕訳を除く）。 */
export function cardCells(row: Kk2Row): Cell[] {
  switch (row.form_kind) {
    case 'amount': return [{ id: 'v', kind: 'amount', expected: row.key.value, points: row.points }]
    case 'sheet': return sheetCells(row.frame, row.key)
    case 'settlement': return settlementCells(row.key)
    case 'journal': return []
  }
}

const EMPTY_JOURNAL: JournalInput = { debit: [], credit: [] }

/** カード全体の採点。 */
export function gradeCard(row: Kk2Row, input: CardInput): CardResult {
  if (row.form_kind === 'journal') {
    const j = gradeJournal(journalKeyOf(row.key), input.journal ?? EMPTY_JOURNAL, row.points)
    return { kind: 'journal', earned: j.earned, max: j.max, rate: j.rate, journal: j }
  }
  const g: GradeResult = gradeCells(cardCells(row), input.answers)
  return { kind: 'cells', earned: g.earned, max: g.max, rate: g.rate, cells: g.cells }
}

/** 理解度を決める「正解」の得点率。仕訳・金額は満点、第3〜5問は満点が厳しいので 80%（docs/design/kenkei2.md §4.2）。 */
export function passRateOf(row: Kk2Row): number {
  return row.part >= 3 ? 0.8 : 1
}
