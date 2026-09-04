// review_history（denken_reviews の JSONB 列）から FSRS オプティマイザの学習データを組む。
//
// ネイティブバインディングには依存しない純関数にしてある（テストのため）。
// FSRSItem への変換は optimize.ts の数行で行う。
//
// ■ FSRSItem の形
// 1つの FSRSItem は「1回の演習」に対応するが、そのカードのそれ以前の演習も全部含む。
// n回演習したカードからは (n-1) 個の item ができる（初回だけの演習は学習に使えない
// ―― 予測すべき「前回からの経過日数」が存在しないため）。
//
// ■ 理解度 → Rating
// アプリの A/B/C は fsrs.ts の RATING_MAP と同じ対応で FSRS の 4段階へ写す。
//   A → Easy(4) / B → Good(3) / C → Again(1)
// **Hard(2) は出てこない。** アプリの入力が3値しかないためで、学習しても Hard 関連の
// 重みは事前値のまま動かない（それ自体は害にならないが、当てはまりの上限になる）。
//
// ■ S（復習不要）は学習から外す
// S はスケジューラを回さない記録（fsrs.ts の calcFSRS が早期リターンする）ので、
// 「その日に想起できたか」の観測ではない。学習データに混ぜると誤った観測になる。
// 除いたぶんの経過日数は次の演習へ繰り越し、間隔が縮まないようにする。

import type { ReviewHistoryEntry, Status } from '../../src/domain/types.js'

/** FSRS の Rating（1=Again / 2=Hard / 3=Good / 4=Easy）。 */
export type Rating = 1 | 2 | 3 | 4

const RATING_OF: Partial<Record<Status, Rating>> = { A: 4, B: 3, C: 1 }

export interface TrainReview {
  rating: Rating
  /** 前回の演習からの経過日数。系列の先頭は必ず 0。 */
  deltaT: number
}

export interface TrainStats {
  cards: number
  reviews: number
  items: number
  /** Rating ごとの件数。Hard が 0 であることの確認に使う。 */
  ratings: Record<Rating, number>
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000,
  )
}

/** 1カードの履歴を、学習用の演習系列（実施日順）へ変換する。 */
export function toReviewSequence(history: ReviewHistoryEntry[]): TrainReview[] {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const out: TrainReview[] = []
  let previousDate: string | null = null
  // S などで飛ばした日数は捨てずに次へ繰り越す（間隔を実際より短く見せない）。
  for (const e of sorted) {
    const rating = RATING_OF[e.status]
    if (rating === undefined) continue
    const deltaT = previousDate === null ? 0 : Math.max(0, daysBetween(previousDate, e.date))
    out.push({ rating, deltaT })
    previousDate = e.date
  }
  return out
}

export interface TrainSet {
  /** 学習アイテム。各要素が1つの FSRSItem（先頭から i 回目までの系列）になる。 */
  items: TrainReview[][]
  stats: TrainStats
}

export function buildTrainSet(
  rows: { review_history: ReviewHistoryEntry[] | null }[],
): TrainSet {
  const items: TrainReview[][] = []
  const stats: TrainStats = { cards: 0, reviews: 0, items: 0, ratings: { 1: 0, 2: 0, 3: 0, 4: 0 } }

  for (const row of rows) {
    const seq = toReviewSequence(Array.isArray(row.review_history) ? row.review_history : [])
    if (seq.length === 0) continue
    stats.cards++
    stats.reviews += seq.length
    for (const r of seq) stats.ratings[r.rating]++
    for (let i = 1; i < seq.length; i++) {
      const item = seq.slice(0, i + 1)
      // 【必須】経過日数が全て 0 のアイテムを渡してはならない。
      // fsrs-rs は "Invalid FSRS item: at least one review with delta_t > 0 is required"
      // で **panic し、Node のプロセスごと abort する**（例外ではないので catch できない）。
      // 同じ問題を同じ日に2回記録すると簡単に発生する ―― 本番データには現時点で0件だが、
      // 起こりうる入力でサーバが落ちる形なので、ここで必ず落とす。
      if (!item.some(r => r.deltaT > 0)) continue
      items.push(item)
    }
  }
  stats.items = items.length
  return { items, stats }
}
