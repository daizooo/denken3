import { describe, it, expect } from 'vitest'
import { buildTrainSet, toReviewSequence } from './trainSet'
import type { ReviewHistoryEntry, Status } from '../../src/domain/types'

const h = (date: string, status: Status): ReviewHistoryEntry => ({ date, status })

describe('toReviewSequence', () => {
  it('A/B/C を FSRS の Rating へ写す（Hard は出てこない）', () => {
    const seq = toReviewSequence([h('2026-07-18', 'C'), h('2026-07-20', 'B'), h('2026-07-24', 'A')])
    expect(seq.map(r => r.rating)).toEqual([1, 3, 4])
  })

  it('先頭の経過日数は必ず 0、以降は前の演習からの日数', () => {
    const seq = toReviewSequence([h('2026-07-18', 'C'), h('2026-07-20', 'B'), h('2026-07-24', 'A')])
    expect(seq.map(r => r.deltaT)).toEqual([0, 2, 4])
  })

  it('実施日順に正規化する（入力の並びに依らない）', () => {
    const a = toReviewSequence([h('2026-07-24', 'A'), h('2026-07-18', 'C'), h('2026-07-20', 'B')])
    const b = toReviewSequence([h('2026-07-18', 'C'), h('2026-07-20', 'B'), h('2026-07-24', 'A')])
    expect(a).toEqual(b)
  })

  it('S はスケジューラを回さない記録なので学習から外し、経過日数は次へ繰り越す', () => {
    // 7/18 → (7/22 は S) → 7/26。S を無視して 7/18→7/26 の 8日として数える。
    const seq = toReviewSequence([h('2026-07-18', 'A'), h('2026-07-22', 'S'), h('2026-07-26', 'A')])
    expect(seq).toEqual([{ rating: 4, deltaT: 0 }, { rating: 4, deltaT: 8 }])
  })

  it('未着手は履歴に載らない想定だが、混ざっても落とす', () => {
    expect(toReviewSequence([h('2026-07-18', '未着手'), h('2026-07-20', 'A')]))
      .toEqual([{ rating: 4, deltaT: 0 }])
  })
})

describe('buildTrainSet', () => {
  it('n回演習したカードから (n-1) 個のアイテムができる', () => {
    const { items, stats } = buildTrainSet([
      { review_history: [h('2026-07-18', 'C'), h('2026-07-20', 'B'), h('2026-07-24', 'A')] },
      { review_history: [h('2026-08-01', 'A'), h('2026-08-09', 'A')] },
    ])
    expect(items).toHaveLength(3) // 2 + 1
    expect(stats).toEqual({
      cards: 2, reviews: 5, items: 3, ratings: { 1: 1, 2: 0, 3: 1, 4: 3 },
    })
  })

  it('各アイテムは「その回まで」の系列になっている', () => {
    const { items } = buildTrainSet([
      { review_history: [h('2026-07-18', 'C'), h('2026-07-20', 'B'), h('2026-07-24', 'A')] },
    ])
    expect(items[0].map(r => r.rating)).toEqual([1, 3])
    expect(items[1].map(r => r.rating)).toEqual([1, 3, 4])
  })

  it('1回だけの演習は学習に使えないのでアイテムにならない（カード数には入る）', () => {
    const { items, stats } = buildTrainSet([{ review_history: [h('2026-08-15', 'A')] }])
    expect(items).toHaveLength(0)
    expect(stats.cards).toBe(1)
    expect(stats.reviews).toBe(1)
  })

  it('同じ日に2回記録したぶんはアイテムにしない（fsrs-rs がプロセスごと落ちるため）', () => {
    // 経過日数が全て 0 のアイテムを渡すと fsrs-rs が panic し、catch できずに abort する。
    const { items } = buildTrainSet([
      { review_history: [h('2026-08-15', 'C'), h('2026-08-15', 'A')] },
    ])
    expect(items).toHaveLength(0)
  })

  it('同日記録があっても、日をまたぐアイテムは残す', () => {
    const { items } = buildTrainSet([
      { review_history: [h('2026-08-15', 'C'), h('2026-08-15', 'A'), h('2026-08-20', 'A')] },
    ])
    // [0日, 0日] は捨て、[0日, 0日, 5日] は残る
    expect(items).toHaveLength(1)
    expect(items[0].map(r => r.deltaT)).toEqual([0, 0, 5])
  })

  it('履歴が空・null の行は無視する', () => {
    const { items, stats } = buildTrainSet([
      { review_history: [] }, { review_history: null },
    ])
    expect(items).toHaveLength(0)
    expect(stats.cards).toBe(0)
  })

  it('本番データと同じ規模感で組める（232カード相当）', () => {
    // 実DB: カード232 / 演習509 / 2回以上180 / アイテム277。比率が同じ形を作る。
    const rows = Array.from({ length: 180 }, (_, i) => ({
      review_history: [h('2026-07-18', 'C'), h(`2026-07-${20 + (i % 9)}`, 'A')],
    }))
    const { stats } = buildTrainSet(rows)
    expect(stats.items).toBe(180)
  })
})
