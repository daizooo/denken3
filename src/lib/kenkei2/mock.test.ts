import { describe, expect, it } from 'vitest'
import type { Kk2Row } from './cards.ts'
import { answeredCount, emptyCardDraft, formatRemaining, isAnswered, KK2_MOCK, missedCards, scoreMock, type MockAnswers } from './mock.ts'

// すべて架空のデータ（仕訳4点・金額3点・精算表30点 + 第3問14点 + 第4問24点 = 75 点分の小さな模試）
const journal: Kk2Row = {
  id: 'K2_99_1_1', exam_no: 99, part: 1, sub: 1, points: 4, stem: 'x', form_kind: 'journal',
  frame: { symbols: [['A', '現金'], ['B', '資本金']] }, key: { debit: [{ s: 'A', a: 100 }], credit: [{ s: 'B', a: 100 }] },
}
const amount: Kk2Row = { id: 'K2_99_2_1', exam_no: 99, part: 2, sub: 1, points: 3, stem: 'x', form_kind: 'amount', frame: { unit: '円' }, key: { value: 500 } }
const sheet: Kk2Row = {
  id: 'K2_99_3_1', exam_no: 99, part: 3, sub: 1, points: 10, stem: 'x', form_kind: 'sheet',
  frame: { box: [0, 0, 700, 400], page: 1, words: [], rules: [], units: [
    { id: '3-1', points: 5, cells: [{ k: 'a', box: [0, 0, 1, 1] }] }, { id: '3-2', points: 5, cells: [{ k: 'a', box: [0, 0, 1, 1] }] },
  ] },
  key: { '3-1.0': 10, '3-2.0': 20 },
}
const rows = [sheet, amount, journal]   // わざと順不同

const draft = (over: Partial<ReturnType<typeof emptyCardDraft>>) => ({ ...emptyCardDraft(), ...over })
const full: MockAnswers = {
  [journal.id]: draft({ journal: { debit: [{ symbol: 'a', amount: '100' }], credit: [{ symbol: 'B', amount: '100' }] } }),
  [amount.id]: draft({ answers: { v: '500' } }),
  [sheet.id]: draft({ answers: { '3-1.0': '10', '3-2.0': '20' } }),
}

describe('scoreMock', () => {
  it('全問正解なら満点。大問ごとの得点と順序（大問・設問）', () => {
    const s = scoreMock(rows, full)
    expect(s.total).toBe(17)
    expect(s.max).toBe(17)
    expect(s.bySection).toEqual({ '1': 4, '2': 3, '3': 10 })
    expect(s.cards.map(c => c.id)).toEqual([journal.id, amount.id, sheet.id])
    expect(s.cards.every(c => c.correct)).toBe(true)
  })
  it('未解答は 0 点で「正解」にならない。合否は 70 点基準', () => {
    const s = scoreMock(rows, {})
    expect(s.total).toBe(0)
    expect(s.cards.some(c => c.correct)).toBe(false)
    expect(s.passed).toBe(false)
    expect(KK2_MOCK.passScore).toBe(70)
  })
  it('第3〜5問は得点率80%以上で正解扱い、未満は復習対象', () => {
    const half: MockAnswers = { ...full, [sheet.id]: draft({ answers: { '3-1.0': '10', '3-2.0': '0' } }) }   // 5/10 = 50%
    const s = scoreMock(rows, half)
    expect(s.total).toBe(12)
    expect(missedCards(s).map(c => c.id)).toEqual([sheet.id])
    const near: MockAnswers = { ...full, [sheet.id]: draft({ answers: { '3-1.0': '10', '3-2.0': '20' } }) }
    expect(missedCards(scoreMock(rows, near))).toEqual([])
  })
  it('仕訳・金額は満点でなければ復習対象（部分点でも正解扱いにしない）', () => {
    const s = scoreMock(rows, { ...full, [amount.id]: draft({ answers: { v: '499' } }) })
    expect(missedCards(s).map(c => c.id)).toEqual([amount.id])
  })
  it('合否: 合計が基準点以上なら合格（基準を超える小さな模試で確認）', () => {
    const big: Kk2Row = { ...sheet, id: 'K2_99_5_1', part: 5, points: 80, frame: { ...sheet.frame, units: [{ id: '5-1', points: 80, cells: [{ k: 'a', box: [0, 0, 1, 1] }] }] }, key: { '5-1.0': 1 } }
    const s = scoreMock([...rows, big], { ...full, [big.id]: draft({ answers: { '5-1.0': '1' } }) })
    expect(s.total).toBe(97)
    expect(s.passed).toBe(true)
  })
})

describe('isAnswered / answeredCount', () => {
  it('入力があれば解答済み。メモだけ・空白だけは未解答', () => {
    expect(isAnswered(undefined)).toBe(false)
    expect(isAnswered(emptyCardDraft())).toBe(false)
    expect(isAnswered(draft({ memo: '計算' }))).toBe(false)
    expect(isAnswered(draft({ answers: { v: '  ' } }))).toBe(false)
    expect(isAnswered(draft({ answers: { v: '1' } }))).toBe(true)
    expect(isAnswered(draft({ journal: { debit: [{ symbol: 'A', amount: '' }], credit: [] } }))).toBe(true)
  })
  it('解答済みの数', () => {
    expect(answeredCount(rows, full)).toBe(3)
    expect(answeredCount(rows, { [amount.id]: draft({ answers: { v: '5' } }) })).toBe(1)
  })
})

describe('formatRemaining', () => {
  it('分:秒（90分は 90:00）', () => {
    expect(formatRemaining(5400)).toBe('90:00')
    expect(formatRemaining(61)).toBe('1:01')
    expect(formatRemaining(-5)).toBe('0:00')
  })
})
