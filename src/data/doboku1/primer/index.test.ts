import { describe, expect, it } from 'vitest'
import { DOBOKU1_EXAM, dbkCategoryOfId } from '../index.ts'
import { DOBOKU1_CATEGORIES } from '../categories.ts'
import { statusOfAttempt } from '../../../lib/doboku1/record.ts'
import { buildD1PrimerSubject, D1_PRIMER_TOPICS, d1PrimerIdOf, d1PrimerOf, maruBatsuAttempt, parseD1PrimerId } from './index.ts'

const ids = D1_PRIMER_TOPICS.flatMap(t => t.quizzes.map((_, i) => d1PrimerIdOf(t.id, i + 1)))

describe('入門のID', () => {
  it('一意で、D1_ で始まり、過去問の ID とは区別できる', () => {
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(D1_PRIMER_TOPICS.map(t => t.id)).size).toBe(D1_PRIMER_TOPICS.length)
    for (const id of ids) {
      expect(id.startsWith('D1_')).toBe(true)
      expect(dbkCategoryOfId(id)).toBeUndefined()
      expect(parseD1PrimerId(id)).toBeDefined()
    }
    expect(parseD1PrimerId('D1_R08_A_01')).toBeUndefined()
  })
  it('過去問の ID と重ならない', () => {
    const past = new Set(DOBOKU1_EXAM.subjects.filter(s => s.id !== 'nyumon').flatMap(s => s.chapters.flatMap(c => c.questions.map(q => q.id))))
    expect(ids.some(id => past.has(id))).toBe(false)
  })
})

describe('分野と問の中身', () => {
  it('分野 id は学習分野（DOBOKU1_CATEGORIES）のどれか', () => {
    const cats = new Set(DOBOKU1_CATEGORIES.map(c => c.id))
    for (const t of D1_PRIMER_TOPICS) expect(cats.has(t.id), t.id).toBe(true)
  })
  it('1分野あたり5〜8問、ノート・解説・根拠がある', () => {
    for (const t of D1_PRIMER_TOPICS) {
      expect(t.quizzes.length, t.id).toBeGreaterThanOrEqual(5)
      expect(t.quizzes.length, t.id).toBeLessThanOrEqual(8)
      expect(t.sections.length).toBeGreaterThan(0)
      expect(t.basis.length).toBeGreaterThan(0)
      for (const q of t.quizzes) expect(q.statement && q.explain && q.title).toBeTruthy()
    }
  })
  it('○と×の両方を含む（どちらかに偏らない）', () => {
    for (const t of D1_PRIMER_TOPICS) {
      expect(t.quizzes.some(q => q.answer), t.id).toBe(true)
      expect(t.quizzes.some(q => !q.answer), t.id).toBe(true)
    }
  })
  it('正答を選ぶと正解、逆を選ぶと不正解として記録される', () => {
    for (const id of ids) {
      const { quiz } = d1PrimerOf(id)!
      const ok = maruBatsuAttempt(quiz.answer, 'sure', quiz.answer)
      expect(ok.correct, id).toBe(true)
      expect(statusOfAttempt(ok)).toBe('A')
      expect(maruBatsuAttempt(!quiz.answer, 'sure', quiz.answer).correct).toBe(false)
    }
    expect(maruBatsuAttempt(null, undefined, true)).toEqual({ gaveUp: true, correct: false })
    expect(maruBatsuAttempt(true, 'unsure', true).selected).toEqual([1])
    expect(maruBatsuAttempt(false, 'unsure', true).selected).toEqual([2])
  })
  it('未知の ID は undefined', () => {
    expect(d1PrimerOf('D1_P_nothing_01')).toBeUndefined()
    expect(d1PrimerOf('D1_P_dokou_99')).toBeUndefined()
  })
})

describe('入門タブ', () => {
  it('1級土木の科目タブの先頭。章 ＝ 分野（着手順）、問 ＝ ○×', () => {
    expect(DOBOKU1_EXAM.subjects[0].name).toBe('入門')
    const s = buildD1PrimerSubject(D1_PRIMER_TOPICS)
    expect(s.chapters.map(c => c.name)).toEqual(D1_PRIMER_TOPICS.map(t => t.name))
    expect(s.chapters.every(c => c.questions.length > 0 && c.subject === '入門')).toBe(true)
  })
})
