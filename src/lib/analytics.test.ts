// 想定得点の忘却補正（analytics.cardProb / estimateScore）の回帰テスト。
// 守るのは次の4つ: ① 補正は下げる方向だけ（STATUS_PROB を超えない） ② R ≥ 0.90 は補正なし
// ③ 遅れたカードほど下がる ④ 合格ライン目標（passTarget）が同じ物差しで動く。

import { describe, it, expect } from 'vitest'
import { deriveFromHistory } from './fsrs'
import { STATUS_PROB, cardProb, estimateScore } from './analytics'
import { planPassTarget } from './passTarget'
import { addDaysStr } from './date'
import type { Chapter, Review, ReviewHistoryEntry } from '../domain/types'

const EXAM = '2027-02-06'
const h = (date: string, status: ReviewHistoryEntry['status']): ReviewHistoryEntry => ({ date, status })

function review(id: string, history: ReviewHistoryEntry[]): Review {
  const d = deriveFromHistory(history, EXAM)
  return {
    question_id: id, status: d.status, stability: d.stability, difficulty_fsrs: d.difficulty_fsrs,
    due_date: d.due_date, repetitions: d.repetitions, lapses: d.lapses, last_reviewed: d.last_reviewed,
    fsrs_state: d.fsrs_state, tags: [], memo: '', review_history: d.review_history, first_reviewed: d.first_reviewed,
  }
}

const REVIEWED = '2026-09-01'
const aCard = review('q1', [h('2026-08-20', 'A'), h(REVIEWED, 'A')])

describe('cardProb', () => {
  it('記録した当日（R=1）は補正なし ＝ STATUS_PROB と同じ', () => {
    expect(cardProb(aCard, REVIEWED)).toBe(STATUS_PROB.A)
  })

  it('補正は下げる方向だけ。どの日でも STATUS_PROB を超えない', () => {
    for (let d = 0; d <= 400; d += 20) {
      expect(cardProb(aCard, addDaysStr(REVIEWED, d))).toBeLessThanOrEqual(STATUS_PROB.A)
    }
  })

  it('R が 0.90 を割ってからは、遅れるほど下がり続ける', () => {
    // 安定度50日（頭打ち）のカードは、30日後でも R≈0.94 で補正なし。60日後から割り込む。
    expect(cardProb(aCard, addDaysStr(REVIEWED, 30))).toBe(STATUS_PROB.A)
    const p = [60, 120, 240, 365].map(d => cardProb(aCard, addDaysStr(REVIEWED, d)))
    expect(p[0]).toBeLessThan(STATUS_PROB.A)
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeLessThan(p[i - 1])
    expect(p[p.length - 1]).toBeGreaterThan(0)
  })

  it('B・C にも同じ補正がかかる（理解度の確率は超えない）', () => {
    const b = review('qb', [h(REVIEWED, 'B')])
    const c = review('qc', [h(REVIEWED, 'C')])
    expect(cardProb(b, REVIEWED)).toBe(STATUS_PROB.B)
    expect(cardProb(c, addDaysStr(REVIEWED, 200))).toBeLessThan(STATUS_PROB.C)
  })

  it('未着手・履歴なしは理解度の確率のまま（補正しない）', () => {
    expect(cardProb(undefined, REVIEWED)).toBe(0)
    const noDue: Review = { ...aCard, due_date: null }
    expect(cardProb(noDue, REVIEWED)).toBe(STATUS_PROB.A)
  })
})

describe('estimateScore の忘却補正', () => {
  const questions = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}`, number: i + 1, title: `問${i + 1}`, difficulty: 1 as const }))
  const chapters: Chapter[] = [{ code: 'c1', name: '章1', subject: '理論', totalCount: 10, questions }]
  const reviews: Record<string, Review> = {}
  for (const q of questions) reviews[q.id] = review(q.id, [h('2026-08-20', 'A'), h(REVIEWED, 'A')])

  it('記録直後は補正なし（減点0）', () => {
    const est = estimateScore(chapters, reviews, [], 60, REVIEWED)
    expect(est.forgettingPenalty).toBe(0)
    expect(est.estimate).toBe(Math.round(STATUS_PROB.A * 100))
  })

  it('復習が遅れると想定得点が下がり、下がった分が forgettingPenalty に出る', () => {
    const fresh = estimateScore(chapters, reviews, [], 60, REVIEWED)
    const late = estimateScore(chapters, reviews, [], 60, addDaysStr(REVIEWED, 120))
    expect(late.estimate).toBeLessThan(fresh.estimate)
    expect(late.forgettingPenalty).toBe(fresh.estimate - late.estimate)
  })

  it('溜まった章ほど伸びしろ（impact）が大きく出る', () => {
    const fresh = estimateScore(chapters, reviews, [], 60, REVIEWED)
    const late = estimateScore(chapters, reviews, [], 60, addDaysStr(REVIEWED, 120))
    expect(late.chapters[0].impact).toBeGreaterThan(fresh.chapters[0].impact)
  })

  it('同じ入力は同じ出力（決定的）', () => {
    const t = addDaysStr(REVIEWED, 60)
    expect(estimateScore(chapters, reviews, [], 60, t)).toEqual(estimateScore(chapters, reviews, [], 60, t))
  })
})

describe('planPassTarget が想定得点と同じ物差しで動く', () => {
  const questions = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}`, number: i + 1, title: `問${i + 1}`, difficulty: 1 as const }))
  const chapters: Chapter[] = [{ code: 'c1', name: '章1', subject: '理論', totalCount: 10, questions }]
  const reviews: Record<string, Review> = {}
  for (const q of questions) reviews[q.id] = review(q.id, [h('2026-08-20', 'A'), h(REVIEWED, 'A')])

  it('全問Aなら、新鮮な状態の到達上限は STATUS_PROB.A ぶん（75点）', () => {
    const est = estimateScore(chapters, reviews, [], 60, REVIEWED)
    const t = planPassTarget(chapters, reviews, est, 15, REVIEWED)
    expect(t.maxScore).toBe(75)
    expect(t.masteryRemainingQ).toBe(0)
  })

  it('忘却で想定得点が下がっても、復習で戻せる分を到達上限に含める（矛盾しない）', () => {
    const late = addDaysStr(REVIEWED, 120)
    const est = estimateScore(chapters, reviews, [], 60, late)
    const t = planPassTarget(chapters, reviews, est, 15, late)
    // 全部を新鮮なAへ戻せば 75点。A のままなので「A以上へ引き上げる問数」は増えない。
    expect(t.maxScore).toBe(75)
    expect(t.masteryRemainingQ).toBe(0)
    expect(t.estimate).toBeLessThan(75)
    expect(t.pointGap).toBeGreaterThan(0)
  })
})
