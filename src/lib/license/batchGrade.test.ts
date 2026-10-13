// 一括コピーの選定と一括記録の採点（licensehub-expansion.md §6.3）。
import { describe, expect, it } from 'vitest'
import type { ItemBody } from './itemBody'
import type { ReviewHistoryEntry } from '../../domain/types'
import { EMPTY_ROW, canSubmitBatch, findRecordIndex, gradeBatchRow, isRowFilled, pickBatch } from './batchGrade'

const body = (id: string, over: Partial<ItemBody> = {}): ItemBody => ({
  id, question_id: id.slice(0, -2), label: 'A', statement: `本文 ${id}`, truth: true,
  explanation: '解説', explanation_source: 'book', law_status: 'ok',
  study_subject: 'rouki', scored_subject: 'RK', ...over,
})

describe('pickBatch', () => {
  const bodies: Record<string, ItemBody> = {
    a: body('a'),
    b: body('b', { truth: null }),
    c: body('c', { law_status: 'review' }),
    d: body('d', { statement: '' }),
    e: body('e', { truth: false }),
    f: body('f'),
  }
  it('キューの順に、出題できる肢だけを n 件選ぶ', () => {
    expect(pickBatch(['a', 'b', 'c', 'd', 'e', 'f'], bodies, 2)).toEqual(['a', 'e'])
  })
  it('本文が取れなかった肢は飛ばし、足りなければ取れた分だけ', () => {
    expect(pickBatch(['x', 'a', 'y', 'f', 'e'], bodies, 10)).toEqual(['a', 'f', 'e'])
    expect(pickBatch([], bodies, 10)).toEqual([])
  })
  it('重複は1回だけ', () => {
    expect(pickBatch(['a', 'a', 'f'], bodies, 10)).toEqual(['a', 'f'])
  })
})

describe('canSubmitBatch', () => {
  it('未記録の行がすべて ○/× と 確信/迷い の両方入力済みのときだけ送信できる', () => {
    const full = { answer: true, confidence: 'sure' as const }
    expect(canSubmitBatch(['a', 'b'], { a: full, b: full })).toBe(true)
    expect(canSubmitBatch(['a', 'b'], { a: full })).toBe(false)
    expect(canSubmitBatch(['a', 'b'], { a: full, b: { answer: false, confidence: null } })).toBe(false)
    expect(canSubmitBatch(['a', 'b'], { a: full, b: { answer: null, confidence: 'unsure' } })).toBe(false)
    expect(canSubmitBatch([], {})).toBe(false)
    expect(isRowFilled(EMPTY_ROW)).toBe(false)
  })
})

describe('gradeBatchRow', () => {
  it('ItemSolver と同じ写像（正解×確信=A、正解×迷い=B、不正解=C）', () => {
    expect(gradeBatchRow({ answer: true, confidence: 'sure' }, true)).toEqual({
      status: 'A', correct: true, attempt: { selected: [1], confidence: 'sure', correct: true },
    })
    expect(gradeBatchRow({ answer: false, confidence: 'unsure' }, false)).toEqual({
      status: 'B', correct: true, attempt: { selected: [2], confidence: 'unsure', correct: true },
    })
    expect(gradeBatchRow({ answer: true, confidence: 'sure' }, false)).toEqual({
      status: 'C', correct: false, attempt: { selected: [1], confidence: 'sure', correct: false },
    })
  })
  it('入力が欠けていれば採点しない', () => {
    expect(gradeBatchRow(undefined, true)).toBeNull()
    expect(gradeBatchRow({ answer: true, confidence: null }, true)).toBeNull()
  })
})

describe('findRecordIndex', () => {
  it('記録した日付・理解度に一致する最後の履歴の位置', () => {
    const h: ReviewHistoryEntry[] = [
      { date: '2026-10-12', status: 'B' },
      { date: '2026-10-13', status: 'A' },
      { date: '2026-10-13', status: 'A' },
    ]
    expect(findRecordIndex(h, { date: '2026-10-13', status: 'A' })).toBe(2)
    expect(findRecordIndex(h, { date: '2026-10-13', status: 'C' })).toBe(-1)
  })
})
