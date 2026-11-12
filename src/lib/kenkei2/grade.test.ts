import { describe, expect, it } from 'vitest'
import { gradeCells, gradeJournal } from './grade.ts'
import type { Cell, JournalInput, JournalKey } from './types.ts'

// 架空の仕訳: 借方 N 資本準備金 600,000 / 貸方 M 資本金 500,000・R その他資本剰余金 100,000
const key: JournalKey = {
  debit: [{ symbol: 'N', amount: 600000 }],
  credit: [{ symbol: 'M', amount: 500000 }, { symbol: 'R', amount: 100000 }],
}
const line = (symbol: string, amount: string) => ({ symbol, amount })
const input = (debit: [string, string][], credit: [string, string][]): JournalInput => ({
  debit: debit.map(([s, a]) => line(s, a)), credit: credit.map(([s, a]) => line(s, a)),
})

describe('gradeJournal', () => {
  it('正答なら配点どおり。行の順序は問わない', () => {
    const r = gradeJournal(key, input([['N', '600,000']], [['R', '100000'], ['M', '500000']]), 4)
    expect(r.ok).toBe(true)
    expect(r.earned).toBe(4)
    expect(r.rate).toBe(1)
    expect(r.extra).toBe(false)
  })
  it('全角・小文字の入力も受け付ける', () => {
    const r = gradeJournal(key, input([['ｎ', '６００，０００']], [['m', '500,000'], ['Ｒ', '100,000']]), 4)
    expect(r.ok).toBe(true)
  })
  it('同じ科目を複数行に分けても科目ごとの合計で比べる', () => {
    const r = gradeJournal(key, input([['N', '400000'], ['N', '200000']], [['M', '500000'], ['R', '100000']]), 4)
    expect(r.ok).toBe(true)
  })
  it('空行・金額なしの行は無視する', () => {
    const r = gradeJournal(key, input([['N', '600000'], ['', ''], ['K', '']], [['M', '500000'], ['R', '100000'], ['', '']]), 4)
    expect(r.ok).toBe(true)
  })
  it('金額違いは 0 点。誤りの行が分かる', () => {
    const r = gradeJournal(key, input([['N', '600000']], [['M', '500000'], ['R', '90000']]), 4)
    expect(r.ok).toBe(false)
    expect(r.earned).toBe(0)
    expect(r.credit.find(x => x.symbol === 'R')).toMatchObject({ expected: 100000, given: 90000, ok: false })
    expect(r.credit.find(x => x.symbol === 'M')?.ok).toBe(true)
  })
  it('借方と貸方を取り違えたら不正解', () => {
    const r = gradeJournal(key, input([['M', '500000'], ['R', '100000']], [['N', '600000']]), 4)
    expect(r.ok).toBe(false)
  })
  it('余分な科目があれば不正解（extra）', () => {
    const r = gradeJournal(key, input([['N', '600000'], ['K', '1']], [['M', '500000'], ['R', '100000']]), 4)
    expect(r.ok).toBe(false)
    expect(r.extra).toBe(true)
  })
  it('金額があるのに記号が解釈できない行は不正解', () => {
    const r = gradeJournal(key, input([['N', '600000'], ['資本', '5']], [['M', '500000'], ['R', '100000']]), 4)
    expect(r.ok).toBe(false)
    expect(r.extra).toBe(true)
  })
  it('金額が数字でなければ不正解', () => {
    const r = gradeJournal(key, input([['N', 'abc']], [['M', '500000'], ['R', '100000']]), 4)
    expect(r.ok).toBe(false)
  })
  it('未入力は 0 点', () => {
    const r = gradeJournal(key, input([['', '']], [['', '']]), 4)
    expect(r).toMatchObject({ ok: false, earned: 0, max: 4 })
  })
})

describe('gradeCells', () => {
  const cells: Cell[] = [
    { id: 'a', kind: 'amount', expected: 4350, points: 4 },
    { id: 'b', kind: 'amount', expected: 404550, points: 4 },
    { id: 'diff', kind: 'amount', expected: 2200, points: 3, group: 'g' },
    { id: 'mark', kind: 'symbol', expected: 'B', points: 3, group: 'g' },
  ]
  it('全問正解なら満点', () => {
    const r = gradeCells(cells, { a: '4,350', b: '￥404,550', diff: '2200', mark: 'b' })
    expect(r).toMatchObject({ earned: 14, max: 14, rate: 1 })
    expect(r.cells.every(c => c.ok)).toBe(true)
  })
  it('group は全部正解のときだけ得点（金額＋記号）', () => {
    const r = gradeCells(cells, { a: '4350', b: '404550', diff: '2200', mark: 'A' })
    expect(r.earned).toBe(8)
    expect(r.cells.find(c => c.id === 'diff')).toMatchObject({ ok: true, earned: 0 })
    expect(r.cells.find(c => c.id === 'mark')).toMatchObject({ ok: false, earned: 0 })
  })
  it('未入力は null として扱い不正解', () => {
    const r = gradeCells(cells, {})
    expect(r.earned).toBe(0)
    expect(r.cells[0].given).toBeNull()
    expect(r.rate).toBe(0)
  })
  it('採点マスが無ければ rate は 0', () => {
    expect(gradeCells([], {})).toEqual({ earned: 0, max: 0, rate: 0, cells: [] })
  })
  it('0 円の正答は未入力と区別する', () => {
    const z: Cell[] = [{ id: 'z', kind: 'amount', expected: 0, points: 2 }]
    expect(gradeCells(z, { z: '0' }).earned).toBe(2)
    expect(gradeCells(z, { z: '' }).earned).toBe(0)
  })
})
