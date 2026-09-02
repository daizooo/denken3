// 今日の一手サマリ（study-time-scarcity.md 課題9）。純関数。
//
// 分析タブは「読む」設計で、ペース分析・弱点ランキング・学習曲線・4象限・想定得点・
// 章別進捗と密度が高い。情報としては良質だが、5分の隙間に開いて意思決定するための
// 画面ではない（§3 課題9）。そこで復習タブの最上部に1行だけ、
//
//   今日の残り 約12分（7問） · 想定得点 47点 · 合格まであと13点
//
// を出す。新しい計算は増やさず、既に画面が持っている3つの値を1行に束ねるだけにする:
//   - 今日の残り  = 復習の推奨ライン（reviewPlan.planDailyReviews）＋ 新規着手枠（課題3）
//   - 想定得点    = analytics.estimateScore
//   - 合格まで    = passTarget.pointGap（合格点＋マージンとの差）
//
// Phase H（learning-metrics-ui-redesign）で、これに「今日すでに記録した問数」を足した。
// 残りだけでは「終わりが見える」感覚が出ず、ヘッダ・章チップ・日付タブの総数（109問）に
// 目が行って「今日は39問なのか109問なのか」が読めなくなっていたため、
// 進捗バー（doneCount / doneCount + remainingCount）で今日の総量を1本に固定する。
//
// 「残り」はどちらも記録済みを含まない（復習は due_date が先へ動いて候補から外れ、
// 新規着手枠は今日の着手数だけ枠が減る）ので、記録するたびに減っていく。
// 章フィルタには依存しない（科目全体の"今日"を表す）。

import type { ScoreEstimate } from './analytics'
import type { PassTarget } from './passTarget'

export interface TodaySummary {
  /** 想定得点を出せるだけのデータがあるか。false なら得点まわりは表示しない。 */
  hasData: boolean
  /** 今日の残り問数（復習の推奨ライン＋新規着手枠）。 */
  remainingCount: number
  /** その推定所要分。 */
  remainingMinutes: number
  /** 今日の分を終えているか（残り0問）。 */
  done: boolean
  /** 今日すでに記録した問数（進捗バーの分子）。残りと足したものが今日の総量。 */
  doneCount: number
  /** 現在の想定得点（点）。 */
  estimate: number
  /** 目標点（合格点＋マージン）。 */
  targetScore: number
  /** 目標までの不足点（達成済みは 0）。 */
  pointGap: number
  /** 目標に到達済みか。 */
  achieved: boolean
}

export function buildTodaySummary(
  todayReview: { recommendedCount: number; recommendedMinutes: number },
  todayNew: { count: number; minutes: number },
  est: ScoreEstimate,
  target: PassTarget,
  doneCount: number,
): TodaySummary {
  const remainingCount = todayReview.recommendedCount + todayNew.count
  return {
    hasData: est.hasData,
    remainingCount,
    remainingMinutes: todayReview.recommendedMinutes + todayNew.minutes,
    done: remainingCount === 0,
    doneCount,
    estimate: est.estimate,
    targetScore: target.targetScore,
    pointGap: target.pointGap,
    achieved: target.achieved,
  }
}
