// 解答時間 → FSRS の評価（review-schedule-realism.md §3-5）。純関数。
// 基準は本番の持ち時間 E（examTime.ts）。学習中の切り上げ時間は使わない（自己参照を避ける）。
import type { Status } from '../domain/types.js'

/** FSRS の Rating の数値（1=Again / 2=Hard / 3=Good / 4=Easy）。 */
export type RatingValue = 1 | 2 | 3 | 4

/**
 * 自己評価と解答時間から FSRS の評価を決める。
 * - A: t ≤ 0.5E → Easy / t ≤ E → Good / t > E → Hard。計測なしは Good（時間で Easy を裏付けられない）
 * - B: Hard（本番では0点）
 * - C: Again
 * 過去の S（廃止）は A として扱う。未着手は null（スケジューラを回さない）。
 */
export function ratingFromSolve(
  status: Status,
  durationSeconds: number | undefined,
  limitSeconds: number,
): RatingValue | null {
  if (status === '未着手') return null
  if (status === 'C') return 1
  if (status === 'B') return 2
  if (durationSeconds === undefined) return 3
  if (durationSeconds <= limitSeconds / 2) return 4
  return durationSeconds <= limitSeconds ? 3 : 2
}
