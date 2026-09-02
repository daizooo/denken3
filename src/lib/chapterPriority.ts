// 章別の優先順位（analytics-tab-consolidation / 課題15）。純関数。
//
// 分析タブには章ごとの表が3つあった:
//   1. 本番想定得点「得点を伸ばす近道」  … 章 × 最大+N点（impact 降順・上位3）
//   2. 章別 弱点ランキング               … 章 × 弱点スコア・正答率・アドバイス（弱点降順）
//   3. 章別進捗                          … 章 × 完答/習得中/収録数（章の学習順）
//
// 同じ章名が3回、別々の順序で並ぶため、「次にどの章をやるか」の答えが3つあった。
// しかも3つは互いに矛盾しうる（弱点1位の章が、出題比率の低さから伸びしろ最下位、など）。
//
// ここでは3つを1行に束ね、**伸びしろ（impact＝その章を全問A相当にしたときの総得点への寄与）
// 降順**で並べる。分析タブが答えるべき問いは「限られた時間をどの章に使うか」であり、
// 得点への寄与がその答えそのものだから。弱点スコア・正答率・進捗は、その順位を
// 裏づける材料として同じ行に置く（別の順序で並べ直さない）。
//
// 新しい計算は増やさない。既存の chapterWeaknessRanking / estimateScore の出力と
// Chapter・Review を突き合わせるだけ。

import type { Chapter, Review, Status } from '../domain/types'
import type { ChapterWeakness, ChapterImpact } from './analytics'

export interface ChapterPriorityRow {
  code: string
  name: string
  /** 収録済みの問題数（このアプリに入っている数。原本の totalCount ではない）。 */
  total: number
  /** 着手済み（未着手でない）問題数。 */
  attempted: number
  /** A または S の問題数（＝完答）。 */
  mastered: number
  /** 着手済みに対する A以上の割合（0..1）。着手0なら null。 */
  correctRate: number | null
  /** 弱点スコア（0..1。大きいほど弱い）。着手0なら null。 */
  weaknessScore: number | null
  /** この章を全問A相当まで上げたときの総得点への寄与（点）。 */
  impact: number
  /** 弱点ランキングの一言アドバイス。着手0なら null。 */
  advice: string | null
}

function isMastered(status: Status | undefined): boolean {
  return status === 'A' || status === 'S'
}

export function buildChapterPriority(
  chapters: Chapter[],
  reviews: Record<string, Review>,
  weakness: ChapterWeakness[],
  impacts: ChapterImpact[],
): ChapterPriorityRow[] {
  const weaknessBy = new Map(weakness.map(w => [w.code, w]))
  const impactBy = new Map(impacts.map(i => [i.code, i]))

  const rows = chapters
    // 収録0の章は表に出さない（進捗も弱点も伸びしろも定義できないため）。
    .filter(c => c.questions.length > 0)
    .map<ChapterPriorityRow>(c => {
      const w = weaknessBy.get(c.code)
      const attempted = c.questions.filter(q => {
        const r = reviews[q.id]
        return r && r.status !== '未着手'
      }).length
      return {
        code: c.code,
        name: c.name,
        total: c.questions.length,
        attempted,
        mastered: c.questions.filter(q => isMastered(reviews[q.id]?.status)).length,
        correctRate: w ? w.correctRate : null,
        weaknessScore: w ? w.score : null,
        impact: impactBy.get(c.code)?.impact ?? 0,
        advice: w ? w.advice : null,
      }
    })

  // 伸びしろ降順。同点は弱点スコア降順 →（どちらも無ければ）収録数降順で割る。
  return rows.sort((a, b) => {
    if (a.impact !== b.impact) return b.impact - a.impact
    const wa = a.weaknessScore ?? -1, wb = b.weaknessScore ?? -1
    if (wa !== wb) return wb - wa
    return b.total - a.total
  })
}
