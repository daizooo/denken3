// 肢モードの自動採点（licensehub-expansion.md §6.2）。
import { describe, expect, it } from 'vitest'
import { isCorrectAnswer, itemAttempt, statusFromAttempt } from './attempt'
import { isMeaningful } from '../attempt'

describe('statusFromAttempt', () => {
  it('正解×確信=A、正解×迷い=B', () => {
    expect(statusFromAttempt(true, 'sure', false)).toBe('A')
    expect(statusFromAttempt(true, 'unsure', false)).toBe('B')
  })
  it('不正解は確信の有無によらず C', () => {
    expect(statusFromAttempt(false, 'sure', false)).toBe('C')
    expect(statusFromAttempt(false, 'unsure', false)).toBe('C')
  })
  it('降参（分からない）は C', () => {
    expect(statusFromAttempt(true, 'sure', true)).toBe('C')
    expect(statusFromAttempt(false, undefined, true)).toBe('C')
  })
  it('確信が未選択の正解は B（Easy にしない）', () => {
    expect(statusFromAttempt(true, undefined, false)).toBe('B')
  })
})

describe('itemAttempt', () => {
  it('○ は selected=[1]、× は selected=[2]。正誤は記録時点の truth で決める', () => {
    expect(itemAttempt(true, 'sure', false, true)).toEqual({ selected: [1], confidence: 'sure', correct: true })
    expect(itemAttempt(false, 'unsure', false, true)).toEqual({ selected: [2], confidence: 'unsure', correct: false })
    expect(itemAttempt(false, 'sure', false, false)).toEqual({ selected: [2], confidence: 'sure', correct: true })
  })
  it('降参は gaveUp かつ不正解として残し、履歴に残す価値がある', () => {
    const a = itemAttempt(null, undefined, true, true)
    expect(a).toEqual({ gaveUp: true, correct: false })
    expect(isMeaningful(a)).toBe(true)
  })
  it('isCorrectAnswer', () => {
    expect(isCorrectAnswer(true, true)).toBe(true)
    expect(isCorrectAnswer(true, false)).toBe(false)
  })
})
