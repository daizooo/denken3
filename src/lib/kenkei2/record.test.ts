import { describe, expect, it } from 'vitest'
import { KENKEI2_EXAM_ID, SETTLEMENT_PASS_RATE, recordAnswer, scoredAttempt, statusOfAttempt } from './record.ts'

describe('scoredAttempt / 理解度の写像', () => {
  it('満点×確信=A、満点×迷い=B、満点未満=C', () => {
    expect(statusOfAttempt(scoredAttempt(1, 'sure'))).toBe('A')
    expect(statusOfAttempt(scoredAttempt(1, 'unsure'))).toBe('B')
    expect(statusOfAttempt(scoredAttempt(0.99, 'sure'))).toBe('C')
  })
  it('確信を申告しない満点は B に倒す', () => {
    expect(statusOfAttempt(scoredAttempt(1, undefined))).toBe('B')
  })
  it('精算表は得点率 80% 以上を正解扱いにできる', () => {
    const opts = { passRate: SETTLEMENT_PASS_RATE }
    expect(statusOfAttempt(scoredAttempt(0.8, 'sure', opts))).toBe('A')
    expect(statusOfAttempt(scoredAttempt(0.79, 'sure', opts))).toBe('C')
  })
  it('わからない（降参）は C', () => {
    expect(scoredAttempt(1, 'sure', { gaveUp: true })).toEqual({ gaveUp: true, correct: false })
  })
})

describe('recordAnswer（1級土木と共通の記録）', () => {
  it('exam_id と、履歴に足して FSRS を再生する', () => {
    expect(KENKEI2_EXAM_ID).toBe('kenkei2')
    const r = recordAnswer(undefined, 'K2_39_1_1', scoredAttempt(1, 'sure'), '2026-11-12')
    expect(r.question_id).toBe('K2_39_1_1')
    expect(r.status).toBe('A')
    expect(r.review_history).toHaveLength(1)
  })
})
