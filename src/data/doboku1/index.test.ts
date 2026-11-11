import { describe, expect, it } from 'vitest'
import { DOBOKU1_EXAM, dbkCategoryOfId } from './index.ts'
import { DOBOKU1_CATEGORIES, YEAR_INDEX } from './categories.ts'

describe('DOBOKU1_EXAM', () => {
  const qs = DOBOKU1_EXAM.subjects.flatMap(s => s.chapters.flatMap(c => c.questions))
  it('索引の全年度の全問を、重複なく1回ずつ載せる', () => {
    expect(qs.length).toBe(YEAR_INDEX.reduce((n, y) => n + y.total.A + y.total.B, 0))
    expect(new Set(qs.map(q => q.id)).size).toBe(qs.length)
  })
  it('全学習分野がどれか1つの科目に属する', () => {
    const codes = DOBOKU1_EXAM.subjects.flatMap(s => s.chapters.map(c => c.code))
    expect(new Set(codes)).toEqual(new Set(DOBOKU1_CATEGORIES.map(c => c.id)))
    expect(codes.length).toBe(DOBOKU1_CATEGORIES.length)
  })
  it('問の分野は年度索引と一致', () => {
    expect(dbkCategoryOfId('D1_R08_A_01')).toBe('kiso')
    expect(dbkCategoryOfId('D1_R08_B_35')).toBe('hinshitsu')
    expect(dbkCategoryOfId('D1_R01_A_01')).toBe('dokou')
    expect(dbkCategoryOfId('D1_R05_B_21')).toBe('keikaku')
    expect(dbkCategoryOfId('R08_T_RK_03_C')).toBeUndefined()
  })
})
