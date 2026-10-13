// 肢の解答ボタン（1タップ）と採点の写像（licensehub-expansion.md §6.1・§6.2）。
import { describe, expect, it } from 'vitest'
import { ITEM_CHOICES, choiceOf } from './choices'
import { canSubmitBatch, gradeBatchRow, isRowFilled } from './batchGrade'

const row = (key: Parameters<typeof choiceOf>[0]) => {
  const c = choiceOf(key)
  return { answer: c.answer, confidence: c.confidence, gaveUp: c.gaveUp }
}

describe('ITEM_CHOICES', () => {
  it('○／○？／×？／×／分からない の5つ。？付きが迷い', () => {
    expect(ITEM_CHOICES.map(c => c.label)).toEqual(['○', '○？', '×？', '×', '分からない'])
    expect(ITEM_CHOICES.filter(c => c.label.endsWith('？')).every(c => c.confidence === 'unsure')).toBe(true)
  })

  it('正答が○の肢: ○=A、○？=B、×？・×・分からない=C', () => {
    expect(gradeBatchRow(row('right'), true)?.status).toBe('A')
    expect(gradeBatchRow(row('right-unsure'), true)?.status).toBe('B')
    expect(gradeBatchRow(row('wrong-unsure'), true)?.status).toBe('C')
    expect(gradeBatchRow(row('wrong'), true)?.status).toBe('C')
    expect(gradeBatchRow(row('giveup'), true)?.status).toBe('C')
  })

  it('正答が×の肢: ×=A、×？=B、○系・分からない=C', () => {
    expect(gradeBatchRow(row('wrong'), false)?.status).toBe('A')
    expect(gradeBatchRow(row('wrong-unsure'), false)?.status).toBe('B')
    expect(gradeBatchRow(row('right'), false)?.status).toBe('C')
    const giveup = gradeBatchRow(row('giveup'), false)
    expect(giveup?.status).toBe('C')
    expect(giveup?.attempt).toEqual({ gaveUp: true, correct: false })
  })

  it('一括記録では「分からない」も入力済みとして送信できる', () => {
    expect(isRowFilled(row('giveup'))).toBe(true)
    expect(canSubmitBatch(['a', 'b'], { a: row('giveup'), b: row('right') })).toBe(true)
  })
})
