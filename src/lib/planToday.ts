// 今日のライン（adaptive-fsrs-policy.md §3.5・Phase B-1）。すべて純関数。
//
// ==========================================================================
// これが解いている問題（設計書 §2.2）:
//
//   現行の推奨ライン（reviewPlan.planDailyReviews）は締切からの逆算だけで決まり、
//   **その人が今日どれだけ時間を使えるかが一切入っていない。**
//   14日休んで復帰した日に ceil(106問 ÷ 3日) = 「今日36問・約4時間」と出る。
//   育児中の隙間時間に対してこの数字は確実に折れる。
//
// 対処は「量を減らすこと」ではない（原則 §0・要求3）。
//
//   **総量は減らさない。今日の絞り込みは順序付けだけに使う。**
//   **線より下は"遅れ"ではなく"順番待ち"で、翌日以降に必ず戻る。**
//
// 並び順は「1問あたりの点数影響 ÷ 所要時間」＝単位時間あたりの期待得点の伸び。
// 時間が希少なとき、その時間が最も点数に効く使われ方をするのはこの順（§3.3 層2）。
// ==========================================================================
//
// 前進コアと維持コアを**同じ土俵に並べる**のがこのファイルの要点（設計書 §3.3 訂正）。
// 「既に A の179問の維持」と「未着手208問への前進」は、1問あたりの点数影響がほぼ同じ
// 大きさ（0.15点／0.17点）であり、どちらかを後回しの箱に入れてよいものではない。
// 前進だけを積めば A が忘却で落ちて想定得点が下がり、維持だけを回せば範囲が埋まらない。

import type { MasterQuestion, Review, Status } from '../domain/types'
import type { Policy } from './policy'
import type { TimeStats } from './estimateMinutes'
import { STATUS_PROB } from './analytics'
import { estimateMinutes } from './estimateMinutes'
import { reviewValue } from './reviewPlan'

export interface TodayCandidate {
  question: MasterQuestion
  review: Review | undefined
}

export interface TodayPlanItem {
  id: string
  /** コア集合（policy.coreIds）に入っているか。false＝バッファ（後回しにできる）。 */
  core: boolean
  /** 前進コア（まだ A 以上に届いていない）か。false＝維持コア（A・S の復習）。 */
  forward: boolean
  /** 🔴優先（忘却が目標保持率を大きく下回っている）か。コアの分は必ず線の上に来る。 */
  urgent: boolean
  minutes: number
  /**
   * この1回で動く期待正答率（Δ確率）。全問一律の係数（100 ÷ 出題比率の分母）を掛ければ点になる。
   * 係数が一律なので、並び順を決めるうえでは点に直さなくても順序は変わらない。
   */
  impact: number
  /** impact ÷ 推定所要分。並び順の主キー。 */
  density: number
}

export interface TodayPlan {
  /** 表示順。前半が「今日の分」（recommendedCount 件）、後半が「順番待ち」。 */
  items: TodayPlanItem[]
  /** id → items 内の位置。呼び出し側が同じ順序で並べ替えるために使う。 */
  rank: Map<string, number>

  /** 今日のライン（この件数までが今日の分）。上限キャップではなく推奨。 */
  recommendedCount: number
  recommendedMinutes: number
  /** 今日の分のうち、前進コア／維持コアの内訳。 */
  forwardCount: number
  maintainCount: number
  /** 今日の分に含まれる🔴優先の数（コアの分は必ず含まれる）。 */
  urgentCount: number

  /** 線より下（順番待ち）。消えず、翌日以降に必ず戻る。 */
  waitingCount: number
  waitingMinutes: number

  totalCount: number
  totalMinutes: number

  /** 今日の目安時間（分）。予算未選択なら「完走に必要な 分/日」。 */
  targetMinutes: number
  /** 利用者が選んだ時間予算（分）。null＝未選択。 */
  budgetMinutes: number | null
  /**
   * 今日の分の推定所要が目安時間を超えたか。
   * 切れない分（コアの🔴優先・最低ラインの1問）は予算より優先されるため起こりうる。
   */
  overBudget: boolean
}

function isMastered(status: Status): boolean {
  return status === 'A' || status === 'S'
}

/**
 * 1回の演習で動く期待正答率（Δ確率）。
 *
 * 維持（A・S）… 今日やらなければ忘れて落ちる分（A→C）に、いまの忘却リスクを掛ける。
 *               まだ忘れていない問題を今日やっても得るものは小さい、を素直に表す。
 * 前進（未着手・C・B）… A まで引き上げたときの伸びを、そこに要する演習回数で割る。
 *
 * **前進を「回数で割る」のが要点。** 割らずに 0.75（未着手→A の伸び）をそのまま置くと、
 * 前進が維持の5倍以上の密度になり、毎日キューの上を未着手が占めて A が復習されなくなる。
 * 実際には未着手1問を A にするには平均2〜3回かかるので、1回あたりの伸びはその分小さい。
 * こうして初めて前進と維持が同じ土俵（0.15点／0.17点）に並ぶ（設計書 §3.3 訂正）。
 */
function impactOf(status: Status, r: number | null, attemptsPerMastery: number): number {
  if (isMastered(status)) {
    // R が出ない（履歴が無いのに due が付いている等）ときは最大リスク＝安全側に倒す。
    const risk = r === null ? 1 : Math.max(0, 1 - r)
    return risk * (STATUS_PROB.A - STATUS_PROB.C)
  }
  return (STATUS_PROB.A - STATUS_PROB[status]) / Math.max(1, attemptsPerMastery)
}

/**
 * 今日、新しく着手する枠の数（前進コアの当日分）。
 *
 * 現行の `pace.recommendedNorm` は `clamp(必要ペース, 現在ペース×0.8, 現在ペース×1.3)` で、
 * **停止が続いて現在ペースが 0 に近づくと枠も 0 へ張り付く**（設計書 §3.1）。
 * 「勉強できないから要求を下げる」という、利用者が明確に禁止した挙動そのものなので、
 * 今日の枠は現在ペースを一切見ずに、残量と残り日数だけから決める。
 * 休めば `requiredPaceQ`（残り ÷ 残り日数）は自動で上がる ―― 下がることはない。
 */
export function forwardSlotsToday(policy: Policy, startedToday: number): number {
  const target = Math.max(policy.dailyFloor, Math.ceil(policy.requiredPaceQ))
  return Math.max(0, target - startedToday)
}

/**
 * 今日のキューを「点数影響 ÷ 所要時間」の降順に並べ、今日のラインを引く（設計書 §3.5）。
 *
 *   ① コアの🔴優先は、予算を超えても必ず線の上に置く（切らない）
 *   ② 残った予算を コアの残り → バッファ の順で埋める
 *   ③ 予算が未設定・ゼロでも dailyFloor（1〜3問）は必ず出す
 *
 * 予算未選択のときの目安は「コア完遂に必要な 分/日」（policy.feasibility）。締切からの
 * 逆算（現行の catchUpDays）ではなく、完走ペースそのものを今日の目安に使う。
 * こうすると停止明けでも目安は 分/日 のまま動かず、増えた分は順番待ちへ流れるだけになる。
 */
export function planToday(params: {
  candidates: TodayCandidate[]
  policy: Policy
  budgetMinutes: number | null
  stats: TimeStats
  today: string
  examDate: string | null
}): TodayPlan {
  const { candidates, policy, budgetMinutes, stats, today, examDate } = params

  // ---- 1. 各問題の点数影響・所要時間・密度 ----
  const scored = candidates.map(c => {
    const status = c.review?.status ?? '未着手'
    const v = reviewValue(c.question, c.review, today, examDate)
    const minutes = estimateMinutes(c.question, c.review, stats)
    const impact = impactOf(status, v.r, policy.attemptsPerMastery)
    return {
      item: {
        id: c.question.id,
        core: policy.coreIds.has(c.question.id),
        forward: !isMastered(status),
        urgent: v.band === 'high',
        minutes,
        impact,
        // 0分割りを避けるのは planByBudget / valueDensity と同じ 0.25分の下限。
        density: impact / Math.max(minutes, 0.25),
      } as TodayPlanItem,
      frequency: v.frequency,
      difficulty: c.question.difficulty,
    }
  })

  // 密度の降順。同点は出題頻度 → 難易度で割る（reviewPlan の並びと揃える）。
  scored.sort((a, b) => {
    if (a.item.density !== b.item.density) return b.item.density - a.item.density
    if (a.frequency !== b.frequency) return b.frequency - a.frequency
    return b.difficulty - a.difficulty
  })
  const ordered = scored.map(s => s.item)

  const totalMinutes = ordered.reduce((s, i) => s + i.minutes, 0)
  if (ordered.length === 0) {
    return {
      items: [], rank: new Map(),
      recommendedCount: 0, recommendedMinutes: 0, forwardCount: 0, maintainCount: 0,
      urgentCount: 0, waitingCount: 0, waitingMinutes: 0,
      totalCount: 0, totalMinutes: 0,
      targetMinutes: budgetMinutes ?? policy.feasibility.requiredMinutesPerDay,
      budgetMinutes, overBudget: false,
    }
  }

  const targetMinutes = budgetMinutes ?? policy.feasibility.requiredMinutesPerDay

  // ---- 2. 今日の分を選ぶ ----
  const selected = new Set<string>()
  let minutes = 0
  const take = (i: TodayPlanItem) => {
    if (selected.has(i.id)) return
    selected.add(i.id)
    minutes += i.minutes
  }

  // ① コアの🔴優先は無条件（予算を超えても切らない）。忘却が進行している問題を
  //    予算の都合で落とすと、そのぶんは戻ってこない損失になる。
  for (const i of ordered) if (i.core && i.urgent) take(i)

  // ② 最低ラインも無条件（停止中でも切らない・設計書 §3.5 ③）。先頭＝密度が最も高い
  //    問題から順に取る。予算5分に対して先頭が9分でも「今日は何もできない」とは出さず、
  //    かつ予算に収まる安い問題で埋め合わせもしない（estimateMinutes.planByBudget と同じ
  //    「先頭の1問は必ず含める」規約。その時間で最も点数に効くのは先頭の1問であって、
  //    たまたま予算に収まる下位の1問ではない）。
  //
  //    最低ラインの大きさは予算の有無で変える。
  //    - 予算が未設定・ゼロ … dailyFloor（1〜3問）。「今日は0問」を出さないための下限で、
  //      停止が続いても切らない最低ラインそのもの。
  //    - 予算を明示して選んだ … 1問。5分と申告した人に dailyFloor=3問（≒23分）を出すのは、
  //      小さくなっただけの同じ崖であり、Phase B が消そうとしているもの（設計書 §3.5 の表:
  //      「5分しかない日 → コアの最高リスク1問を出す」）。足りない分は順番待ちへ流し、
  //      翌日以降に戻す ―― 総量は減っていない。
  const floor = Math.min(
    budgetMinutes === null || budgetMinutes <= 0 ? policy.dailyFloor : 1,
    ordered.length,
  )
  for (const i of ordered) {
    if (selected.size >= floor) break
    take(i)
  }

  // ③ 残りの予算を コア → バッファ の順で埋める。どちらも密度の降順。
  //    入らない問題は飛ばして次を見る（後ろの短い問題で隙間を埋める）。
  for (const i of ordered) {
    if (!i.core || selected.has(i.id)) continue
    if (minutes + i.minutes > targetMinutes) continue
    take(i)
  }
  for (const i of ordered) {
    if (i.core || selected.has(i.id)) continue
    if (minutes + i.minutes > targetMinutes) continue
    take(i)
  }

  // ---- 3. 今日の分 → 順番待ち の順に並べ直す ----
  // ①で入った🔴優先は密度が低くても線の上に来るため、密度そのままの並びにはならない。
  const items = [
    ...ordered.filter(i => selected.has(i.id)),
    ...ordered.filter(i => !selected.has(i.id)),
  ]
  const rank = new Map(items.map((i, idx) => [i.id, idx]))

  const todayItems = items.slice(0, selected.size)
  const recommendedMinutes = todayItems.reduce((s, i) => s + i.minutes, 0)

  return {
    items,
    rank,
    recommendedCount: todayItems.length,
    recommendedMinutes,
    forwardCount: todayItems.filter(i => i.forward).length,
    maintainCount: todayItems.filter(i => !i.forward).length,
    urgentCount: todayItems.filter(i => i.urgent).length,
    waitingCount: items.length - todayItems.length,
    waitingMinutes: totalMinutes - recommendedMinutes,
    totalCount: items.length,
    totalMinutes,
    targetMinutes,
    budgetMinutes,
    overBudget: recommendedMinutes > targetMinutes,
  }
}
