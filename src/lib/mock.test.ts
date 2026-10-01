// 移行判定（review-schedule-realism.md §3-6）の回帰テスト。
// 旧基準（合格点を2回連続）は、真の実力が合格点ちょうどでも約36%の確率で満たされた。
// 新基準は「直近3回の平均 ≥ 目標点（既定＝合格点＋15）」で、回数は固定しない。

import { describe, it, expect } from 'vitest'
import { DEFAULT_TARGET_MARGIN, TRANSITION_WINDOW, transitionJudgment } from './mock'
import type { MockSession } from '../domain/types'

const session = (score: number, day: number): MockSession => ({
  status: 'finished', mode: 'cbt', score, finished_at: `2026-12-${String(day).padStart(2, '0')}T00:00:00Z`,
} as unknown as MockSession)

describe('transitionJudgment', () => {
  it('旧基準（60点×2回連続）を満たしても、平均が目標点に届かなければ達成にしない', () => {
    const j = transitionJudgment([session(60, 1), session(61, 2), session(62, 3)])
    expect(j.met).toBe(false)
    expect(j.targetScore).toBe(60 + DEFAULT_TARGET_MARGIN)
    expect(j.shortfall).toBeGreaterThan(0)
  })

  it('直近3回の平均が目標点以上なら達成', () => {
    const j = transitionJudgment([session(70, 1), session(76, 2), session(79, 3)])
    expect(j.met).toBe(true)
    expect(j.recentAvg).toBeCloseTo(75, 5)
    expect(j.shortfall).toBe(0)
  })

  it('3回に満たないうちは判定しない（高得点でも）', () => {
    const j = transitionJudgment([session(95, 1), session(95, 2)])
    expect(j.met).toBe(false)
    expect(j.needMore).toBe(TRANSITION_WINDOW - 2)
  })

  it('受験がまだ無いときは平均なし・目標点までの不足は目標点そのもの', () => {
    const j = transitionJudgment([])
    expect(j.recentAvg).toBeNull()
    expect(j.needMore).toBe(TRANSITION_WINDOW)
    expect(j.shortfall).toBe(75)
  })

  it('古い回は見ない（直近3回だけで判定し、後から伸びれば達成になる）', () => {
    const j = transitionJudgment([session(40, 1), session(50, 2), session(76, 3), session(78, 4), session(80, 5)])
    expect(j.met).toBe(true)
    expect(j.windowN).toBe(3)
  })

  it('目標点は引数で上書きできる（policy.targetScore）', () => {
    const j = transitionJudgment([session(70, 1), session(70, 2), session(70, 3)], 60, 70)
    expect(j.met).toBe(true)
  })

  it('途中で終了した・自由モードのセッションは数えない', () => {
    const ignored = [
      { ...session(99, 4), mode: 'free' }, { ...session(99, 5), status: 'in_progress' },
    ] as unknown as MockSession[]
    const j = transitionJudgment([session(60, 1), session(60, 2), session(60, 3), ...ignored])
    expect(j.met).toBe(false)
    expect(j.recentAvg).toBeCloseTo(60, 5)
  })
})
