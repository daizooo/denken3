// 復習の先読み（review-schedule-realism.md §3-2）の回帰テスト。
// 守るのは次の3つ: ① 溜まりは今日に全部数える（能力で切らない） ② 未着手の再演習が入る
// ③ 時間・実績ペースに依存しない（同じ入力は同じ出力）。

import { describe, it, expect } from 'vitest'
import { deriveFromHistory } from './fsrs'
import { FOLLOW_UP_OFFSETS, forecastLoad, requiredPace } from './reviewForecast'
import type { Review, ReviewHistoryEntry } from '../domain/types'
import { addDaysStr } from './date'

const TODAY = '2026-10-01'
const EXAM = '2027-02-06'

function review(id: string, history: ReviewHistoryEntry[]): Review {
  const d = deriveFromHistory(history, EXAM)
  return {
    question_id: id, status: d.status, stability: d.stability, difficulty_fsrs: d.difficulty_fsrs,
    due_date: d.due_date, repetitions: d.repetitions, lapses: d.lapses, last_reviewed: d.last_reviewed,
    fsrs_state: d.fsrs_state, tags: [], memo: '', review_history: d.review_history, first_reviewed: d.first_reviewed,
  }
}
const h = (date: string, status: ReviewHistoryEntry['status']): ReviewHistoryEntry => ({ date, status })

// 期限超過（古い C）3枚＋遠い予定（A,A）1枚。
const overdue = ['a', 'b', 'c'].map(id => review(id, [h('2026-08-01', 'C')]))
const far = review('far', [h('2026-08-13', 'A'), h('2026-09-28', 'A')])

describe('forecastLoad', () => {
  it('溜まり（期限超過）は能力で切らず、今日にすべて数える', () => {
    const f = forecastLoad({ cards: [...overdue, far], unstarted: 0, newPerDay: 0, attemptsPerMastery: 2, today: TODAY, examDate: EXAM })
    expect(f[0].date).toBe(TODAY)
    expect(f[0].reviews).toBe(3)
    expect(f).toHaveLength(14)
  })

  it('未着手の着手と、その再演習（1日後・3日後…）が入る', () => {
    const f = forecastLoad({ cards: [], unstarted: 10, newPerDay: 2, attemptsPerMastery: 3, today: TODAY, examDate: EXAM })
    expect(f[0].newStarts).toBe(2)
    // 1問あたり attemptsPerMastery-1 = 2 回の再演習: 着手の1日後と3日後。
    expect(f[1].followUps).toBe(2)
    expect(f[3].followUps).toBeGreaterThanOrEqual(2) // 初日ぶんの +3日（2日目の +1日も重なる）
    expect(f[FOLLOW_UP_OFFSETS[0]].date).toBe(addDaysStr(TODAY, 1))
  })

  it('未着手が尽きたら着手は止まる', () => {
    const f = forecastLoad({ cards: [], unstarted: 3, newPerDay: 2, attemptsPerMastery: 2, today: TODAY, examDate: EXAM })
    expect(f.map(d => d.newStarts).slice(0, 3)).toEqual([2, 1, 0])
  })

  it('同じ入力は同じ出力（決定的）', () => {
    const input = { cards: [...overdue, far], unstarted: 5, newPerDay: 1, attemptsPerMastery: 2, today: TODAY, examDate: EXAM }
    expect(forecastLoad(input)).toEqual(forecastLoad(input))
  })
})

describe('requiredPace', () => {
  it('試験日が未設定なら数える地平が無い（0）', () => {
    const r = requiredPace({ cards: [far], unstarted: 5, attemptsPerMastery: 2, today: TODAY, examDate: null })
    expect(r.perDay).toBe(0)
  })

  it('カードも未着手も無ければ 0', () => {
    const r = requiredPace({ cards: [], unstarted: 0, attemptsPerMastery: 2, today: TODAY, examDate: EXAM })
    expect(r.total).toBe(0)
    expect(r.perDay).toBe(0)
  })

  it('未着手は（演習回数＋最終確認）回ぶん数える', () => {
    const r = requiredPace({ cards: [], unstarted: 10, attemptsPerMastery: 2, today: TODAY, examDate: EXAM })
    expect(r.newWork).toBe(30)
    expect(r.days).toBe(128) // 今日〜試験前日（2/5）
    expect(r.perDay).toBeCloseTo(30 / 128, 5)
  })

  it('溜まりと、試験までの復習を数える（頭打ちがあるので試験前に最低1回は入る）', () => {
    const r = requiredPace({ cards: [...overdue, far], unstarted: 0, attemptsPerMastery: 2, today: TODAY, examDate: EXAM })
    expect(r.backlog).toBe(3)
    expect(r.scheduledReviews).toBeGreaterThanOrEqual(4)
  })

  it('溜まりが増えると必要ペースは上がる（休むほど要求が下がることはない）', () => {
    const base = requiredPace({ cards: [far], unstarted: 20, attemptsPerMastery: 2, today: TODAY, examDate: EXAM })
    const more = requiredPace({ cards: [far, ...overdue], unstarted: 20, attemptsPerMastery: 2, today: TODAY, examDate: EXAM })
    expect(more.perDay).toBeGreaterThan(base.perDay)
  })

  it('今日が試験日に近づくと、同じ仕事量でも必要ペースは上がる', () => {
    const args = { cards: [] as Review[], unstarted: 20, attemptsPerMastery: 2, examDate: EXAM }
    const early = requiredPace({ ...args, today: '2026-10-01' })
    const late = requiredPace({ ...args, today: '2027-01-01' })
    expect(late.perDay).toBeGreaterThan(early.perDay)
  })
})
