// 総合分析の骨格（§7.7）。Phase 1 では時間データ（duration_seconds）に依存しない
// (2) 章・トピック別の弱点スコアランキング と (3) 学習曲線（正答率トレンド）を実装する。
// 解答時間を使う (1) 4象限マトリクス・(4) 得点推定は Phase 2 で有効化する。
//
// すべて純関数。入力は (chapters, reviews)。母数（対象問題数）を必ず持たせ、
// 計測前・未着手データは自然に除外されるようにする。

import type { Chapter, Review, Status } from '../domain/types'

// 弱点スコアの重み（初期値・使用感で調整）。時間超過率(w3)は Phase 1 では未使用。
const W_INCORRECT = 0.5  // (1 - 直近正答率)
const W_LAPSE = 0.3      // lapse率（取りこぼし）
const W_IMPORTANCE = 0.2 // 重要度加重

export interface ChapterWeakness {
  code: string
  name: string
  attempted: number        // 着手済み（母数）
  total: number
  correctRate: number      // 直近A評価の割合（0..1）
  lapseRate: number        // lapse を経験した問題の割合（0..1）
  importanceWeight: number // 平均重要度の正規化（0..1）
  score: number            // 弱点スコア（0..1）。大きいほど弱い
  advice: string
}

function isCorrect(status: Status | undefined): boolean {
  return status === 'A'
}

// 章別の弱点スコアランキング（§7.7(2)）。着手済み問題が1問以上ある章のみ対象。
export function chapterWeaknessRanking(
  chapters: Chapter[],
  reviews: Record<string, Review>,
): ChapterWeakness[] {
  const rows: ChapterWeakness[] = []

  for (const c of chapters) {
    const attemptedQs = c.questions.filter(q => {
      const r = reviews[q.id]
      return r && r.status !== '未着手'
    })
    const attempted = attemptedQs.length
    if (attempted === 0) continue

    const correct = attemptedQs.filter(q => isCorrect(reviews[q.id]?.status)).length
    const lapsed = attemptedQs.filter(q => (reviews[q.id]?.lapses ?? 0) > 0).length
    const correctRate = correct / attempted
    const lapseRate = lapsed / attempted

    // 重要度: 未指定は 2（中央）とみなす。平均を (1..3)→(0..1) に正規化。
    const avgImportance =
      attemptedQs.reduce((s, q) => s + (q.importance ?? 2), 0) / attempted
    const importanceWeight = (avgImportance - 1) / 2

    const score =
      W_INCORRECT * (1 - correctRate) +
      W_LAPSE * lapseRate +
      W_IMPORTANCE * importanceWeight

    rows.push({
      code: c.code,
      name: c.name,
      attempted,
      total: c.questions.length,
      correctRate,
      lapseRate,
      importanceWeight,
      score,
      advice: adviceFor(correctRate, lapseRate),
    })
  }

  return rows.sort((a, b) => b.score - a.score)
}

// 支配的な要因から推奨アクション文を生成する。
function adviceFor(correctRate: number, lapseRate: number): string {
  if (correctRate < 0.5) return '正答率が低い — 解法・基礎の再確認'
  if (lapseRate >= 0.4) return '取りこぼし多発 — 反復と解説戻り'
  if (correctRate < 0.8) return 'あと一歩 — 誤答パターンの整理'
  return '安定 — 復習間隔を伸ばして維持'
}

// ---- 学習曲線（§7.7(3)・時間なし版）----

export interface WeeklyLearningPoint {
  week: string        // 週の開始日（月曜）"M/D"
  weekKey: string     // ソート用 "YYYY-MM-DD"
  freshRate: number | null   // 初見の正答率（0..1）。データ無しは null
  freshN: number
  reviewRate: number | null  // 復習の正答率（0..1）
  reviewN: number
}

// "YYYY-MM-DD" の属する週（月曜始まり）の開始日を返す。
function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const dow = d.getUTCDay() // 0=日..6=土
  const back = (dow + 6) % 7 // 月曜までの戻し日数
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

// 週次の正答率トレンド（初見/復習別）。
// review_history の各エントリを走査し、最初のエントリ=初見、以降=復習として集計する。
export function weeklyLearningCurve(reviews: Record<string, Review>): WeeklyLearningPoint[] {
  interface Bucket { freshOk: number; freshN: number; revOk: number; revN: number }
  const buckets = new Map<string, Bucket>()

  for (const r of Object.values(reviews)) {
    const history = [...(r.review_history ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    history.forEach((e, idx) => {
      if (e.status === '未着手') return
      const wk = weekStart(e.date)
      const b = buckets.get(wk) ?? { freshOk: 0, freshN: 0, revOk: 0, revN: 0 }
      const ok = e.status === 'A' ? 1 : 0
      if (idx === 0) { b.freshN++; b.freshOk += ok }
      else { b.revN++; b.revOk += ok }
      buckets.set(wk, b)
    })
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([wk, b]) => ({
      week: `${parseInt(wk.split('-')[1])}/${parseInt(wk.split('-')[2])}`,
      weekKey: wk,
      freshRate: b.freshN > 0 ? b.freshOk / b.freshN : null,
      freshN: b.freshN,
      reviewRate: b.revN > 0 ? b.revOk / b.revN : null,
      reviewN: b.revN,
    }))
}
