import { describe, expect, it } from 'vitest'
import { itemIdLabelJa, questionIdLabelJa, subjectNameJa, yearLabelJa } from './idLabel'

describe('yearLabelJa', () => {
  it('元号+2桁を和暦の年度にする', () => {
    expect(yearLabelJa('R06')).toBe('令和6年度')
    expect(yearLabelJa('R10')).toBe('令和10年度')
    expect(yearLabelJa('H29')).toBe('平成29年度')
  })
  it('令和元年度は「元」と書く', () => {
    expect(yearLabelJa('R01')).toBe('令和元年度')
  })
  it('読めない値はそのまま返す', () => {
    expect(yearLabelJa('(不明)')).toBe('(不明)')
  })
})

describe('itemIdLabelJa', () => {
  it('選択式の空欄', () => {
    expect(itemIdLabelJa('R06_S_KN_B')).toBe('令和6年度 国民年金法 選択式 空欄B')
  })
  it('択一式の肢', () => {
    expect(itemIdLabelJa('R06_T_RK_04_C')).toBe('令和6年度 労働基準法及び労働安全衛生法 択一式 問4 肢C')
    expect(itemIdLabelJa('H29_T_RS_10_A', true)).toBe('平成29年度 労災 択一式 問10 肢A')
  })
  it('読めない ID はそのまま返す', () => {
    expect(itemIdLabelJa('foo')).toBe('foo')
  })
})

describe('questionIdLabelJa', () => {
  it('択一式・選択式の問', () => {
    expect(questionIdLabelJa('R03_T_KY_07')).toBe('令和3年度 雇用保険法 択一式 問7')
    expect(questionIdLabelJa('R08_S_RK')).toBe('令和8年度 労働基準法及び労働安全衛生法 選択式')
  })
  it('肢IDは問のIDではないのでそのまま返す', () => {
    expect(questionIdLabelJa('R06_T_RK_04_C')).toBe('R06_T_RK_04_C')
  })
})

describe('subjectNameJa', () => {
  it('コードを科目名にする（未知のコードはそのまま）', () => {
    expect(subjectNameJa('KN')).toBe('国民年金法')
    expect(subjectNameJa('KN', true)).toBe('国年')
    expect(subjectNameJa('ZZ')).toBe('ZZ')
  })
})
