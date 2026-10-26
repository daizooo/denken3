// 選択式の空欄を1問として解く（肢モードの選択式版）。
import { describe, expect, it } from 'vitest'
import type { AnswerSpec } from '../../domain/license'
import type { ItemBody } from './itemBody'
import {
  correctWordNo, isAskableSentaku, isSentakuItemId, sentakuAttempt, sentakuQuestionId, splitBlanks, wordChoices,
} from './sentakuItem'

const SPEC: AnswerSpec = {
  kind: 'sentaku',
  blanks: { A: 3, B: 2 },
  wordbank: { '1': '一', '2': '二', '3': '三', '4': '四' },
}
const body = (over: Partial<ItemBody> = {}): ItemBody => ({
  id: 'R98_S_RK_A', question_id: 'R98_S_RK', label: 'A', statement: '使用者は、［A］を使用してはならない。',
  truth: null, explanation: null, explanation_source: 'none', law_status: 'ok', study_subject: 'rouki', scored_subject: 'RK',
  ...over,
})

describe('ID', () => {
  it('選択式の肢だけを選択式と判定し、問IDを返す', () => {
    expect(isSentakuItemId('R06_S_RK_A')).toBe(true)
    expect(isSentakuItemId('R06_T_RK_04_A')).toBe(false)
    expect(isSentakuItemId('ac1_54')).toBe(false)
    expect(sentakuQuestionId('R06_S_RK_A')).toBe('R06_S_RK')
    expect(sentakuQuestionId('R06_T_RK_04_A')).toBeNull()
  })
})

describe('correctWordNo / isAskableSentaku', () => {
  it('answer_spec の空欄 → 語群の番号を返す。無ければ null', () => {
    expect(correctWordNo(SPEC, 'A')).toBe(3)
    expect(correctWordNo(SPEC, 'C')).toBeNull()
    expect(correctWordNo(null, 'A')).toBeNull()
    expect(correctWordNo({ kind: 'one', direction: 'wrong', correct: 1 }, 'A')).toBeNull()
    expect(correctWordNo({ kind: 'sentaku', blanks: { A: 9 }, wordbank: { '1': '一' } }, 'A')).toBeNull()
  })

  it('本文あり・law_status=ok・正答ありのときだけ出題する（truth は問わない）', () => {
    expect(isAskableSentaku(body(), SPEC)).toBe(true)
    expect(isAskableSentaku(undefined, SPEC)).toBe(false)
    expect(isAskableSentaku(body({ statement: '  ' }), SPEC)).toBe(false)
    expect(isAskableSentaku(body({ law_status: 'review' }), SPEC)).toBe(false)
    expect(isAskableSentaku(body({ label: 'C' }), SPEC)).toBe(false)
    expect(isAskableSentaku(body(), null)).toBe(false)
  })
})

describe('wordChoices', () => {
  it('語群の番号順に語句を返す。空欄ごとの語群があればそれだけ', () => {
    expect(wordChoices(SPEC, 'A').map(c => c.no)).toEqual([1, 2, 3, 4])
    const grouped: AnswerSpec = { kind: 'sentaku', blanks: { A: 3 }, wordbank: { '1': '一', '2': '二', '3': '三' }, groups: { A: [2, 3] } }
    expect(wordChoices(grouped, 'A')).toEqual([{ no: 2, word: '二' }, { no: 3, word: '三' }])
    expect(wordChoices(null, 'A')).toEqual([])
  })
})

describe('sentakuAttempt', () => {
  it('選んだ語の番号と記録時点の正誤を持つ', () => {
    expect(sentakuAttempt(3, 'sure', false, 3)).toEqual({ selected: [3], confidence: 'sure', correct: true })
    expect(sentakuAttempt(2, 'unsure', false, 3)).toEqual({ selected: [2], confidence: 'unsure', correct: false })
    expect(sentakuAttempt(3, undefined, false, 3)).toEqual({ selected: [3], correct: true })
  })
  it('降参・未選択は gaveUp（不正解扱い）', () => {
    expect(sentakuAttempt(null, undefined, true, 3)).toEqual({ gaveUp: true, correct: false })
    expect(sentakuAttempt(3, 'sure', true, 3)).toEqual({ gaveUp: true, correct: false })
  })
})

describe('splitBlanks', () => {
  it('地の文と空欄の印に分ける（全角・半角の括弧）', () => {
    expect(splitBlanks('使用者は、［A］を、[B]に。')).toEqual([
      { text: '使用者は、' }, { mark: 'A' }, { text: 'を、' }, { mark: 'B' }, { text: 'に。' },
    ])
    expect(splitBlanks('印なし')).toEqual([{ text: '印なし' }])
    expect(splitBlanks('［E］')).toEqual([{ mark: 'E' }])
  })
})
