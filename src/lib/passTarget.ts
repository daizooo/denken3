// 合格ライン目標モード（study-time-scarcity.md 課題2）。すべて純関数。
//
// 既存のペース分析（pace.ts）のゴールは「全問が A 以上」＝440問で固定だった。
// 理論の合格は60点（18問中おおむね11問）であり、440問すべてA以上は「合格」ではなく
// 「満点狙い」の目標になる。時間が潤沢なら健全だが、学習時間が逼迫した状況では
// **到達不能な目標に対して毎日 behind と判定される**（設計書 §3 課題2）。
//
// そこで「合格ライン到達に必要な最小の問題集合」を求め、その問数をペースの分母にする。
// 求め方は analytics.ts の想定得点モデル（estimateScore）をそのまま裏返したもの:
//
//   ある1問を A 以上へ引き上げたときの総得点の伸び（点）
//     = 〔その章の出題比率 weight〕÷〔章の原本問題数 denom〕
//       ×〔A の正答確率 − 現在の理解度の正答確率〕× 100
//
// この「1問あたりの伸び」の降順に積み上げ、目標点（合格点＋マージン）との差を
// 埋めきった時点の問数が requiredQ。章単位の積み上げ（ChapterImpact.impact の降順）でも
// 近似できるが、章の途中で目標に届いたときの按分が要る。問題単位で積むほうが
// 最小集合として厳密で、実装も短い。
//
// 注意: 現行の出題比率は「オーム社原本の収録数比」（weight = denom / 総問数）なので、
// 上の式の weight ÷ denom は 1/総問数 に約分され、**1問あたりの伸びは章に依らず
// 理解度だけで決まる**（未着手 0.72 > C 0.67 > B 0.32 の順）。つまり最小集合は
// 「理解度の低い問題から順に」であって、章の重み付けは効かない。
// それでも weight から一般形で計算しているのは、出題比率を年度別 topic 集計へ
// 置き換えた場合（§7.7(4)）に、この関数を直さずに正しさが保たれるようにするため。
// 同じ伸びの問題どうしの順序は Array#sort の安定性により章の学習順（registry の並び）
// のまま。ユーザーが実際に進める順序と一致するので、章別の内訳は返さない
// （現行モデルでは内訳に情報量がなく、並び順を「最適な章配分」と誤読させるだけ）。

import type { Chapter, MockSession, Review, Status } from '../domain/types'
import { STATUS_PROB, type ScoreEstimate } from './analytics'

// ペースの目標モード。`pass` を既定とし、達成したら `mastery` へ自動昇格する（§6-1）。
export type GoalMode = 'pass' | 'mastery'

// 合格点に上乗せする安全マージン（点）。想定得点は推定であり、本番のブレもあるため
// 合格点ちょうどを目標にはしない（§6-1 の決定事項）。
export const DEFAULT_PASS_MARGIN = 10

// ---- 最小集合モードのゲート（adaptive-fsrs-policy.md §2 訂正・2026-09-03）----
//
// `pass`（合格に必要な最小集合だけをゴールにする）モードは、想定得点モデルが正しいことを
// 前提に「やる量を減らしてよい」と言う仕組みである。モデルが未検証のままこれを効かせると、
// 楽観的な推定がそのまま学習量の削減に直結する ―― つまり、つまみを下げていないのに
// 実質的に合格ラインを下げたのと同じことが起きる。
//
// そこで、想定得点が本番形式の実測（CBT模試）で検証されるまで `pass` は使わない。
// 検証前の既定ゴールは `mastery`（全範囲を A 以上）＝ 最も安全な側。
//
// 最低2回を要件にするのは、1回では実力なのか出題の当たり外れなのか切り分けられないため。
export const MIN_VALIDATION_SESSIONS = 2

/** 想定得点を実測で較正できるだけの CBT 結果が揃っているか。 */
export function isEstimateValidated(sessions: MockSession[]): boolean {
  const finished = sessions.filter(
    s => s.status === 'finished' && s.mode === 'cbt' && s.score != null,
  )
  return finished.length >= MIN_VALIDATION_SESSIONS
}

export interface PassTarget {
  hasData: boolean
  targetScore: number        // 合格点 + マージン
  estimate: number           // 現在の想定得点
  pointGap: number           // 目標までの不足点（達成済みは 0）
  requiredQ: number          // 目標到達に必要な「A以上へ引き上げる問数」
  achieved: boolean          // 既に目標に届いているか（→ mastery へ昇格）
  reachable: boolean         // 収録済み問題を全部 A にすれば目標に届くか
  maxScore: number           // 収録済みを全部 A にしたときの想定得点（到達上限）
  masteryRemainingQ: number  // 全問A以上までの残り（従来のゴール・参考値）
  // requiredQ の中身（＝伸びの大きい順に積んだ最小集合の問題ID）。
  //
  // 【命名の注意・adaptive-fsrs-policy.md §3.3 訂正 / §7】この集合を「コア」と呼んではならない。
  // 設計書の初版は層2のコアを「合格に必要な最小集合」と定義していたが、同§で訂正済みで、
  // コアは〔前進コア＝未修得すべて〕＋〔維持コア＝既に A・S の問題〕と再定義された。
  // 最小集合をコアとして扱うと「やる量を減らしてよい」と言う仕組みになり、原則 §0
  // （不確実性は必ず「もっとやる」側へ倒す）に反する。実データでも最小集合はすべて
  // 未着手問題になり、期限到来している106問（A:85 / B:21）が1問も入らない。
  // したがってここは事実の集合（requiredIds）として返すだけにとどめ、コア集合の組み立ては
  // policy.ts が行い、この集合は想定得点が CBT 実測で検証されたときにだけ使う。
  requiredIds: Set<string>
}

// 目標到達に必要な最小の問題集合を求める。
// est は analytics.estimateScore の結果（出題比率 weight の唯一の出所）。
export function planPassTarget(
  chapters: Chapter[],
  reviews: Record<string, Review>,
  est: ScoreEstimate,
  marginPoints: number = DEFAULT_PASS_MARGIN,
): PassTarget {
  const targetScore = Math.min(100, est.passingScore + marginPoints)
  const weightOf = new Map(est.chapters.map(c => [c.code, c.weight]))

  // 未修得（A・S 以外）の1問ごとの「A以上へ引き上げたときの得点の伸び」。
  const gains: { id: string; gain: number }[] = []
  for (const c of chapters) {
    const denom = Math.max(c.totalCount, c.questions.length)
    const weight = weightOf.get(c.code) ?? 0
    if (denom === 0 || weight === 0) continue
    for (const q of c.questions) {
      const status: Status = reviews[q.id]?.status ?? '未着手'
      const gain = (weight / denom) * (STATUS_PROB.A - STATUS_PROB[status]) * 100
      if (gain <= 0) continue // A・S は伸びしろ 0＝対象外
      gains.push({ id: q.id, gain })
    }
  }
  gains.sort((a, b) => b.gain - a.gain)

  const masteryRemainingQ = gains.length
  const maxGain = gains.reduce((s, g) => s + g.gain, 0)
  const maxScore = Math.round(est.estimate + maxGain)
  const pointGap = Math.max(0, targetScore - est.estimate)
  const achieved = pointGap === 0
  const reachable = maxGain >= pointGap

  // 伸びの大きい順に、不足点を埋めきるまで積む。
  // 届かない場合（reachable=false）は収録済みの全未修得問題が必要ということ。
  let requiredQ = 0
  let acc = 0
  const requiredIds = new Set<string>()
  for (const g of gains) {
    if (acc >= pointGap) break
    acc += g.gain
    requiredIds.add(g.id)
    requiredQ++
  }

  return {
    hasData: est.hasData,
    targetScore,
    estimate: est.estimate,
    pointGap,
    requiredQ,
    achieved,
    reachable,
    maxScore,
    masteryRemainingQ,
    requiredIds,
  }
}
