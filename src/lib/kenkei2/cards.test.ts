import { describe, expect, it } from 'vitest'
import { cardCells, gradeCard, passRateOf, settlementCellId, type Kk2Row } from './cards.ts'

// すべて架空のデータ
const journalRow: Kk2Row = {
  id: 'K2_99_1_1', exam_no: 99, part: 1, sub: 1, points: 4, stem: 'x', form_kind: 'journal',
  frame: { symbols: [['A', '現金'], ['B', '資本金']] },
  key: { debit: [{ s: 'A', a: 100 }], credit: [{ s: 'B', a: 100 }] },
}
const line = (symbol: string, amount: string) => ({ symbol, amount })

describe('gradeCard 仕訳', () => {
  it('正答で満点・誤りで 0 点', () => {
    const ok = gradeCard(journalRow, { answers: {}, journal: { debit: [line('A', '100')], credit: [line('B', '100')] } })
    expect(ok).toMatchObject({ kind: 'journal', earned: 4, max: 4, rate: 1 })
    const ng = gradeCard(journalRow, { answers: {}, journal: { debit: [line('A', '100')], credit: [line('B', '90')] } })
    expect(ng.earned).toBe(0)
  })
  it('未入力は 0 点', () => {
    expect(gradeCard(journalRow, { answers: {} }).earned).toBe(0)
  })
})

describe('gradeCard 金額', () => {
  const row: Kk2Row = { id: 'K2_99_2_1', exam_no: 99, part: 2, sub: 1, points: 3, stem: 'x', form_kind: 'amount', frame: { unit: '円' }, key: { value: 821000 } }
  it('カンマ・全角を許容する', () => {
    expect(gradeCard(row, { answers: { v: '￥821,000' } }).earned).toBe(3)
    expect(gradeCard(row, { answers: { v: '821000' } }).rate).toBe(1)
    expect(gradeCard(row, { answers: { v: '82100' } }).earned).toBe(0)
  })
})

describe('gradeCard 第3・4問（採点単位）', () => {
  const row: Kk2Row = {
    id: 'K2_99_3_1', exam_no: 99, part: 3, sub: 1, points: 8, stem: 'x', form_kind: 'sheet',
    frame: {
      box: [0, 0, 700, 400], page: 1, words: [], rules: [],
      units: [
        { id: '3-1', points: 2, cells: [{ k: 'a', box: [0, 0, 10, 10] }] },
        { id: '3-2', points: 2, cells: [{ k: 's', box: [0, 0, 10, 10] }, { k: 'a', box: [0, 0, 10, 10] }] },   // 記号＋金額（両方正解で得点）
        { id: '3-3', points: 4, cells: [{ k: 'a', box: [0, 0, 10, 10] }] },
      ],
    },
    key: { '3-1.0': 1000, '3-2.0': 'G', '3-2.1': 1700000, '3-3.0': 5 },
  }
  it('セルは単位ごとに集計し、複数欄の単位は両方正解のときだけ得点', () => {
    expect(cardCells(row)).toHaveLength(4)
    const all = gradeCard(row, { answers: { '3-1.0': '1,000', '3-2.0': 'g', '3-2.1': '1,700,000', '3-3.0': '5' } })
    expect(all).toMatchObject({ earned: 8, max: 8, rate: 1 })
    const half = gradeCard(row, { answers: { '3-1.0': '1000', '3-2.0': 'G', '3-2.1': '1', '3-3.0': '5' } })
    expect(half.earned).toBe(6)   // 3-2 は金額が違うので 0
  })
})

describe('gradeCard 精算表', () => {
  const row: Kk2Row = {
    id: 'K2_99_5_1', exam_no: 99, part: 5, sub: 1, points: 30, stem: 'x', form_kind: 'settlement',
    frame: { accounts: [{ n: '現金', tb: [100, 0] }], tbTotal: [100, 100] },
    key: {
      accounts: [{ n: '現金', tb: [100, 0], adj: [[], [20]], pl: [0, 0], bs: [80, 0] }],
      netIncome: 70,
      scored: [{ row: 0, col: 'bs_d', v: 80 }, { row: 'ni', col: 'bs_c', v: 70 }],
    },
  }
  it('採点マスごとに2点', () => {
    const g = gradeCard(row, { answers: { [settlementCellId(0, 'bs_d')]: '80', [settlementCellId('ni', 'bs_c')]: '71' } })
    expect(g).toMatchObject({ kind: 'cells', earned: 2, max: 4 })
  })
  it('当期純利益の見出し（第34回）を解答欄にする回は、見出し＋金額で1単位', () => {
    const k34: Kk2Row = {
      ...row,
      key: { ...row.key, scored: [
        { row: 0, col: 'bs_d', v: 80 },
        { row: 'ni', col: 'label', v: '純利益' }, { row: 'ni', col: 'pl_d', v: 70 }, { row: 'ni', col: 'bs_c', v: 70 },
      ] },
    }
    expect(cardCells(k34).reduce((s, c) => s + c.points, 0)).toBe(4)   // 2 + 2（見出し・金額2つで 2点）
    const ok = gradeCard(k34, { answers: { '0.bs_d': '80', 'ni.label': '純利益', 'ni.pl_d': '70', 'ni.bs_c': '70' } })
    expect(ok.earned).toBe(4)
    const ng = gradeCard(k34, { answers: { '0.bs_d': '80', 'ni.label': '純損失', 'ni.pl_d': '70', 'ni.bs_c': '70' } })
    expect(ng.earned).toBe(2)
  })
})

describe('passRateOf', () => {
  it('仕訳・金額は満点、第3〜5問は 80%', () => {
    expect(passRateOf(journalRow)).toBe(1)
    expect(passRateOf({ ...journalRow, part: 3 })).toBe(0.8)
    expect(passRateOf({ ...journalRow, part: 5 })).toBe(0.8)
  })
})
