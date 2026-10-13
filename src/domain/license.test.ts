import { describe, expect, it } from 'vitest'
import {
  formatYear, makeItemId, makeQuestionId, normalizeLabel, parseItemId, parseQuestionId,
  questionIdOfItem, type AnswerSpec,
} from './license'

describe('normalizeLabel', () => {
  it('ア〜オ を A〜E に正規化する', () => {
    expect(['ア', 'イ', 'ウ', 'エ', 'オ'].map(normalizeLabel)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
  it('A〜E・小文字・全角・前後の空白を受け付ける', () => {
    expect(normalizeLabel('C')).toBe('C')
    expect(normalizeLabel('c')).toBe('C')
    expect(normalizeLabel('Ｄ')).toBe('D')
    expect(normalizeLabel('ｅ')).toBe('E')
    expect(normalizeLabel(' ア ')).toBe('A')
  })
  it('範囲外は null', () => {
    for (const s of ['F', 'カ', '', '1', 'AB', 'ｱ']) expect(normalizeLabel(s)).toBeNull()
  })
})

describe('formatYear', () => {
  it('元号+2桁', () => {
    expect(formatYear('R', 8)).toBe('R08')
    expect(formatYear('H', 29)).toBe('H29')
  })
  it('範囲外は例外', () => {
    expect(() => formatYear('R', 0)).toThrow()
    expect(() => formatYear('R', 100)).toThrow()
    expect(() => formatYear('R', 1.5)).toThrow()
  })
})

describe('ID の生成', () => {
  it('択一式の問・肢（ア〜オは A〜E に正規化）', () => {
    const c = { year: 'R08', format: 'taku', scoredSubject: 'RK', qNo: 3 } as const
    expect(makeQuestionId(c)).toBe('R08_T_RK_03')
    expect(makeItemId({ ...c, label: 'C' })).toBe('R08_T_RK_03_C')
    expect(makeItemId({ ...c, label: 'ウ' })).toBe('R08_T_RK_03_C')
    expect(makeItemId({ ...c, qNo: 10, label: 'オ' })).toBe('R08_T_RK_10_E')
  })
  it('選択式の問・空欄', () => {
    const c = { year: 'R08', format: 'sentaku', scoredSubject: 'RK', qNo: null } as const
    expect(makeQuestionId(c)).toBe('R08_S_RK')
    expect(makeItemId({ ...c, label: 'A' })).toBe('R08_S_RK_A')
  })
  it('不正な座標は例外', () => {
    expect(() => makeQuestionId({ year: 'R8', format: 'taku', scoredSubject: 'RK', qNo: 1 })).toThrow()
    expect(() => makeQuestionId({ year: 'R08', format: 'taku', scoredSubject: 'rk', qNo: 1 })).toThrow()
    expect(() => makeQuestionId({ year: 'R08', format: 'taku', scoredSubject: 'RK', qNo: 0 })).toThrow()
    expect(() => makeQuestionId({ year: 'R08', format: 'taku', scoredSubject: 'RK', qNo: null })).toThrow()
    expect(() => makeQuestionId({ year: 'R08', format: 'sentaku', scoredSubject: 'RK', qNo: 1 })).toThrow()
    expect(() => makeItemId({ year: 'R08', format: 'taku', scoredSubject: 'RK', qNo: 1, label: 'F' })).toThrow()
  })
})

describe('ID のパース', () => {
  it('択一式の肢', () => {
    expect(parseItemId('R08_T_RK_03_C')).toEqual({
      year: 'R08', format: 'taku', scoredSubject: 'RK', qNo: 3, label: 'C',
    })
  })
  it('選択式の空欄', () => {
    expect(parseItemId('H29_S_KN_E')).toEqual({
      year: 'H29', format: 'sentaku', scoredSubject: 'KN', qNo: null, label: 'E',
    })
  })
  it('問ID', () => {
    expect(parseQuestionId('R07_T_IP_10')).toEqual({ year: 'R07', format: 'taku', scoredSubject: 'IP', qNo: 10 })
    expect(parseQuestionId('R07_S_SI')).toEqual({ year: 'R07', format: 'sentaku', scoredSubject: 'SI', qNo: null })
  })
  it('不正な ID は null', () => {
    for (const id of [
      'R08_T_RK_3_C', 'R08_T_RK_00_C', 'R08_T_RK_03_F', 'R08_T_RK_03_ウ', 'R8_T_RK_03_C',
      'R08_S_RK_01_A', 'R08_X_RK_A', 'X27_book_001', 'R08_T_RK_03', '',
    ]) expect(parseItemId(id)).toBeNull()
    expect(parseQuestionId('R08_T_RK_03_C')).toBeNull()
    expect(parseQuestionId('R08_S_RK_01')).toBeNull()
  })
  it('生成とパースが往復する', () => {
    for (const id of ['R08_T_RK_03_C', 'R06_T_KY_10_A', 'R08_S_RK_A']) {
      const c = parseItemId(id)!
      expect(makeItemId(c)).toBe(id)
    }
  })
  it('肢ID → 親の問ID', () => {
    expect(questionIdOfItem('R08_T_RK_03_C')).toBe('R08_T_RK_03')
    expect(questionIdOfItem('R08_S_RK_A')).toBe('R08_S_RK')
    expect(questionIdOfItem('R08_T_RK_03')).toBeNull()
  })
})

describe('AnswerSpec', () => {
  it('kind で判別できる', () => {
    const specs: AnswerSpec[] = [
      { kind: 'one', direction: 'wrong', correct: 3 },
      { kind: 'combo', correct: 2 },
      { kind: 'count', correct: 3 },
      { kind: 'sentaku', blanks: { A: 12 }, wordbank: { '12': '30日' } },
    ]
    const summary = specs.map(s => (s.kind === 'sentaku' ? Object.keys(s.blanks).join() : s.correct))
    expect(summary).toEqual([3, 2, 3, 'A'])
  })
})
