// buildTrainSet の出力が、そのままオプティマイザに通ることの確認（結合テスト）。
//
// 純関数側（trainSet.test.ts）は形を検証するが、ネイティブバインディングが実際に
// 受け取れるかは別の話で、ここが食い違うと本番で初めて落ちる。
// 学習は 500件規模で1秒未満なので、テストに入れても支障はない。

import { describe, it, expect } from 'vitest'
import {
  FSRSBinding, FSRSBindingItem, FSRSBindingReview, computeParameters,
} from '@open-spaced-repetition/binding'
import { buildTrainSet } from './trainSet.js'
import type { ReviewHistoryEntry, Status } from '../../src/domain/types.js'

const W_LENGTH = 21

// 本番の履歴と同じ形（C→B→A と間隔が伸びる系列）を、学習が成立する件数だけ作る。
function fixture(cards: number): { review_history: ReviewHistoryEntry[] }[] {
  const rows: { review_history: ReviewHistoryEntry[] }[] = []
  for (let i = 0; i < cards; i++) {
    const pattern: Status[] = i % 3 === 0
      ? ['C', 'B', 'A', 'A']
      : i % 3 === 1
        ? ['B', 'A', 'A']
        : ['A', 'A', 'C', 'A']
    // 日付は必ず単調増加させる（同日記録は経過日数0のアイテムになり、fsrs-rs が落ちる）。
    let day = 0
    const history: ReviewHistoryEntry[] = pattern.map((status, k) => {
      day += k === 0 ? 0 : 1 + ((i + k) % 12)
      const d = new Date(Date.UTC(2026, 6, 1) + day * 86_400_000)
      return { date: d.toISOString().slice(0, 10), status }
    })
    rows.push({ review_history: history })
  }
  return rows
}

describe('buildTrainSet → オプティマイザ', () => {
  const { items, stats } = buildTrainSet(fixture(240))

  it('本番と同じ規模の学習データが組める', () => {
    expect(stats.cards).toBe(240)
    expect(stats.items).toBeGreaterThan(400)
    // アプリの入力は3値なので Hard は必ず 0。学習してもここは動かない。
    expect(stats.ratings[2]).toBe(0)
  })

  it('FSRSItem へそのまま変換でき、21個のパラメータが返る', async () => {
    const trainSet = items.map(seq =>
      new FSRSBindingItem(seq.map(r => new FSRSBindingReview(r.rating, r.deltaT))),
    )
    const w = await computeParameters(trainSet, { enableShortTerm: false })
    expect(w).toHaveLength(W_LENGTH)
    expect(w.every(v => Number.isFinite(v))).toBe(true)
  }, 30_000)

  it('既定パラメータでの評価が取れる（採用ゲートの比較対象）', () => {
    const trainSet = items.map(seq =>
      new FSRSBindingItem(seq.map(r => new FSRSBindingReview(r.rating, r.deltaT))),
    )
    const before = new FSRSBinding().evaluate(trainSet)
    expect(Number.isFinite(before.logLoss)).toBe(true)
    expect(Number.isFinite(before.rmseBins)).toBe(true)
  })

  it('先頭の経過日数は 0（オプティマイザの前提条件）', () => {
    expect(items.every(seq => seq[0].deltaT === 0)).toBe(true)
  })
})
