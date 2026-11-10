import { describe, expect, it } from 'vitest'
import { choiceAttempt, recordAnswer, statusOfAttempt, undoLast } from './record.ts'

describe('choiceAttempt / statusOfAttempt', () => {
  it('正解×確信=A、正解×迷い=B、不正解=C、分からない=C', () => {
    expect(statusOfAttempt(choiceAttempt(3, 'sure', 3))).toBe('A')
    expect(statusOfAttempt(choiceAttempt(3, 'unsure', 3))).toBe('B')
    expect(statusOfAttempt(choiceAttempt(3, undefined, 3))).toBe('B')   // 確信を申告しない正解は B に倒す
    expect(statusOfAttempt(choiceAttempt(1, 'sure', 3))).toBe('C')
    expect(statusOfAttempt(choiceAttempt(null, undefined, 3))).toBe('C')
  })
  it('選んだ肢と正誤を残す', () => {
    expect(choiceAttempt(2, 'sure', 4)).toEqual({ selected: [2], confidence: 'sure', correct: false })
    expect(choiceAttempt(null, 'sure', 4)).toEqual({ gaveUp: true, correct: false })
  })
})

describe('recordAnswer', () => {
  it('履歴に足して FSRS を再生する', () => {
    const r1 = recordAnswer(undefined, 'D1_R08_A_01', choiceAttempt(3, 'sure', 3), '2026-11-10')
    expect(r1.question_id).toBe('D1_R08_A_01')
    expect(r1.status).toBe('A')
    expect(r1.review_history).toHaveLength(1)
    expect(r1.review_history[0].policy?.retention).toBeGreaterThan(0)
    expect(r1.due_date && r1.due_date > '2026-11-10').toBe(true)
    const r2 = recordAnswer(r1, 'D1_R08_A_01', choiceAttempt(1, 'sure', 3), '2026-11-12')
    expect(r2.status).toBe('C')
    expect(r2.lapses).toBe(1)
    expect(r2.first_reviewed).toBe('2026-11-10')
    expect(r2.last_reviewed).toBe('2026-11-12')
  })
  it('取り消すと1つ前の状態に戻る', () => {
    const r1 = recordAnswer(undefined, 'x', choiceAttempt(3, 'sure', 3), '2026-11-10')
    const r2 = recordAnswer(r1, 'x', choiceAttempt(1, 'sure', 3), '2026-11-12')
    const back = undoLast(r2)
    expect(back.review_history).toEqual(r1.review_history)
    expect(back.due_date).toBe(r1.due_date)
    expect(back.status).toBe('A')
    expect(undoLast(back).status).toBe('未着手')
  })
})
