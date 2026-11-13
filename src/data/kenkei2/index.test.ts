import { describe, expect, it } from 'vitest'
import { buildKenkei2Subjects, KENKEI2_EXAM, parseKk2Id } from './index.ts'
import { KENKEI2_MASTERS } from './masters/index.ts'

describe('parseKk2Id', () => {
  it('回・大問・設問に分ける', () => {
    expect(parseKk2Id('K2_39_1_5')).toEqual({ kai: 39, part: 1, sub: 5 })
    expect(parseKk2Id('K2_39_5_1')).toEqual({ kai: 39, part: 5, sub: 1 })
  })
  it('他資格の ID・不正な ID は undefined', () => {
    expect(parseKk2Id('D1_R08_A_01')).toBeUndefined()
    expect(parseKk2Id('R03-RK-05-C')).toBeUndefined()
    expect(parseKk2Id('K2_39_6_1')).toBeUndefined()
  })
})

describe('資格定義', () => {
  it('索引の ID は一意で、すべて K2_ の形', () => {
    const ids = KENKEI2_MASTERS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => parseKk2Id(id) !== undefined)).toBe(true)
  })
  it('第39回は12枚（仕訳5・金額4・原価計算2・精算表1）', () => {
    const by = Object.fromEntries(KENKEI2_EXAM.subjects.map(s => [s.id, s.chapters.flatMap(c => c.questions).length]))
    expect(by).toEqual({ shiwake: 5, kingaku: 4, genka: 2, seisan: 1 })
  })
  it('科目の並びは 仕訳・金額・原価計算・精算表、章は回', () => {
    expect(KENKEI2_EXAM.subjects.map(s => s.name)).toEqual(['仕訳', '金額', '原価計算', '精算表'])
    expect(KENKEI2_EXAM.subjects[0].chapters.map(c => c.name)).toEqual(['第39回'])
  })
  it('回が増えても新しい回が先に並び、番号は科目内で連番', () => {
    const subjects = buildKenkei2Subjects([
      { id: 'K2_38_1_1', title: 'a', studyMode: 'calc' },
      { id: 'K2_39_1_1', title: 'b', studyMode: 'calc' },
      { id: 'K2_39_1_2', title: 'c', studyMode: 'calc' },
    ])
    const ch = subjects[0].chapters
    expect(ch.map(c => c.code)).toEqual(['k39', 'k38'])
    expect(ch[0].questions.map(q => q.number)).toEqual([1, 2])
    expect(ch[0].totalCount).toBe(2)
  })
  it('1級土木・社労士の ID を拾わない', () => {
    const subjects = buildKenkei2Subjects([{ id: 'D1_R08_A_01', title: 'x', studyMode: 'calc' }])
    expect(subjects.flatMap(s => s.chapters)).toEqual([])
  })
  it('合格点は70・ID は kenkei2', () => {
    expect(KENKEI2_EXAM.id).toBe('kenkei2')
    expect(KENKEI2_EXAM.passingScore).toBe(70)
  })
})
