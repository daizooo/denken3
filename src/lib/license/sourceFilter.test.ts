// 出題年度・出題形式の絞り込み。
import { describe, expect, it } from 'vitest'
import type { LicFormat } from '../../domain/license'
import { FORMAT_LABEL, formatsOf, matchSource, yearChipLabel, yearsOf } from './sourceFilter'

const sel = (years: string[] = [], formats: LicFormat[] = []) => ({ years: new Set(years), formats: new Set(formats) })

const IDS = ['H29_T_RK_01_A', 'R06_T_RK_04_A', 'R06_S_RK_A', 'R08_S_RK_B', 'R01_T_RK_02_C']

describe('matchSource', () => {
  it('何も選ばなければすべて通す（ID として読めない問も）', () => {
    expect(matchSource('R06_T_RK_04_A', sel())).toBe(true)
    expect(matchSource('ac1_54', sel())).toBe(true)
  })
  it('年度だけ・形式だけ・両方（軸間は AND、軸内は OR）', () => {
    expect(IDS.filter(id => matchSource(id, sel(['R06'])))).toEqual(['R06_T_RK_04_A', 'R06_S_RK_A'])
    expect(IDS.filter(id => matchSource(id, sel([], ['sentaku'])))).toEqual(['R06_S_RK_A', 'R08_S_RK_B'])
    expect(IDS.filter(id => matchSource(id, sel(['R06', 'R08'], ['sentaku'])))).toEqual(['R06_S_RK_A', 'R08_S_RK_B'])
    expect(IDS.filter(id => matchSource(id, sel(['R01', 'H29'])))).toEqual(['H29_T_RK_01_A', 'R01_T_RK_02_C'])
  })
  it('軸が有効なとき、ID として読めない問は除く', () => {
    expect(matchSource('ac1_54', sel(['R06']))).toBe(false)
    expect(matchSource('ac1_54', sel([], ['taku']))).toBe(false)
  })
})

describe('yearsOf / formatsOf', () => {
  it('年度は令和→平成、新しい順', () => {
    expect(yearsOf(IDS)).toEqual(['R08', 'R06', 'R01', 'H29'])
    expect(yearsOf(['H30_T_RK_01_A', 'H29_T_RK_01_A', 'R10_S_RK_A'])).toEqual(['R10', 'H30', 'H29'])
  })
  it('読めない ID だけなら空（軸を出さない）', () => {
    expect(yearsOf(['ac1_54'])).toEqual([])
    expect(formatsOf(['ac1_54'])).toEqual([])
  })
  it('形式は択一式→選択式の順で、あるものだけ', () => {
    expect(formatsOf(IDS)).toEqual(['taku', 'sentaku'])
    expect(formatsOf(['R06_S_RK_A'])).toEqual(['sentaku'])
  })
})

describe('表示', () => {
  it('チップの年度は元号＋数字', () => {
    expect(yearChipLabel('R06')).toBe('令和6')
    expect(yearChipLabel('R01')).toBe('令和元')
    expect(yearChipLabel('H29')).toBe('平成29')
    expect(FORMAT_LABEL.sentaku).toBe('選択式')
  })
})
