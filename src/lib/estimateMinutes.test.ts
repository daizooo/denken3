// 所要時間の推定（estimateMinutes.ts）の回帰テスト。
// 社労士の1問は、択一式の肢か選択式の空欄。既定値も実測の集計も、この形式ごとに持つ。

import { describe, it, expect } from 'vitest'
import {
  baselineSeconds, buildTimeStats, estimateMinutes, timeKindOf, type TimeStats,
} from './estimateMinutes'
import { MAX_DURATION_SECONDS } from './timer'
import type { Chapter, MasterQuestion, Review, Status } from '../domain/types'

const TAKU = 'R08_T_RK_03_C'
const SENTAKU = 'R08_S_RK_A'

function q(id: string): MasterQuestion {
  return { id, number: 1, title: id, difficulty: 2, studyMode: 'memory' }
}

function review(status: Status, durationSeconds?: number): Review {
  return {
    question_id: 'x', status, stability: 1, difficulty_fsrs: 5, due_date: null, repetitions: 1,
    lapses: 0, last_reviewed: null, fsrs_state: 2, tags: [], memo: '', first_reviewed: null,
    review_history: [{ date: '2026-10-01', status, duration_seconds: durationSeconds }],
  }
}

const NO_STATS: TimeStats = { byKind: { taku: null, sentaku: null }, measured: {}, measuredN: 0 }

function chapterOf(ids: string[]): Chapter {
  return { code: 'c', name: 'c', subject: '労基', totalCount: ids.length, questions: ids.map(q) }
}

// 同じ形式の肢を n 件作り、すべて同じ所要秒で記録する。
function takuIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `R08_T_RK_${String(i + 1).padStart(2, '0')}_A`)
}

describe('形式の判定', () => {
  it('肢IDは択一式、空欄IDは選択式。読めないIDは択一式として扱う', () => {
    expect(timeKindOf(TAKU)).toBe('taku')
    expect(timeKindOf(SENTAKU)).toBe('sentaku')
    expect(timeKindOf('q1')).toBe('taku')
  })
})

describe('既定値（実測が無いとき）', () => {
  it('択一の肢は90秒、選択式の空欄は120秒', () => {
    expect(baselineSeconds(q(TAKU))).toBe(90)
    expect(baselineSeconds(q(SENTAKU))).toBe(120)
  })

  it('理解度が高いほど短く見積もる（未着手・C: 1.0 / B: 0.7 / A: 0.5）', () => {
    const at = (id: string, s: Status | undefined) =>
      estimateMinutes(q(id), s ? review(s) : undefined, NO_STATS) * 60
    expect(at(TAKU, undefined)).toBeCloseTo(90, 6)
    expect(at(TAKU, 'C')).toBeCloseTo(90, 6)
    expect(at(TAKU, 'B')).toBeCloseTo(63, 6)
    expect(at(TAKU, 'A')).toBeCloseTo(45, 6)
    expect(at(SENTAKU, undefined)).toBeCloseTo(120, 6)
  })
})

describe('実測の集計', () => {
  it('その問題自身の実測が最優先（理解度係数は掛けない）', () => {
    const stats: TimeStats = { ...NO_STATS, measured: { [TAKU]: 30 } }
    expect(estimateMinutes(q(TAKU), review('A'), stats) * 60).toBeCloseTo(30, 6)
  })

  it('同じ形式が5件以上あれば、その中央値を未計測の問題に使う（形式をまたがない）', () => {
    const ids = takuIds(5)
    const reviews = Object.fromEntries(ids.map(id => [id, review('B', 60)]))
    const stats = buildTimeStats([chapterOf(ids)], reviews)
    expect(stats.byKind.taku).toBe(60)
    expect(stats.byKind.sentaku).toBeNull()
    expect(stats.measuredN).toBe(5)
    // 未計測の肢は、理解度に関わらず形式の中央値（係数は既定値にだけ掛かる）
    expect(estimateMinutes(q('R08_T_RK_99_A'), review('A'), stats) * 60).toBeCloseTo(60, 6)
    // 選択式は実測が無いので既定値のまま
    expect(estimateMinutes(q(SENTAKU), undefined, stats) * 60).toBeCloseTo(120, 6)
  })

  it('4件以下なら中央値は使わず既定値に落ちる', () => {
    const ids = takuIds(4)
    const reviews = Object.fromEntries(ids.map(id => [id, review('B', 60)]))
    const stats = buildTimeStats([chapterOf(ids)], reviews)
    expect(stats.byKind.taku).toBeNull()
    expect(estimateMinutes(q('R08_T_RK_99_A'), undefined, stats) * 60).toBeCloseTo(90, 6)
  })

  it('外れ値（中断で長くなった記録）は中央値にも問題別の実測にも入れない', () => {
    const ids = [...takuIds(5), 'R08_T_RK_50_A']
    const reviews: Record<string, Review> = Object.fromEntries(ids.map(id => [id, review('B', 60)]))
    reviews['R08_T_RK_50_A'] = review('B', 290) // 中央値60秒の3倍（180秒）を超える
    const stats = buildTimeStats([chapterOf(ids)], reviews)
    expect(stats.byKind.taku).toBe(60)
    expect(stats.measured['R08_T_RK_50_A']).toBeUndefined()
    expect(stats.measuredN).toBe(5)
  })

  it(`絶対上限（${MAX_DURATION_SECONDS}秒）を超える記録は、母数が足りていても使わない`, () => {
    const ids = takuIds(5)
    const reviews = Object.fromEntries(ids.map(id => [id, review('B', MAX_DURATION_SECONDS + 1)]))
    const stats = buildTimeStats([chapterOf(ids)], reviews)
    expect(stats.measuredN).toBe(0)
    expect(stats.byKind.taku).toBeNull()
  })
})
