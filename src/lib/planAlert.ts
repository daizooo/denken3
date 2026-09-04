// 計画アラートの1本化（review-display-analysis-warnings）。すべて純関数。
//
// ==========================================================================
// これが解いている問題:
//
//   分析タブには「時間が足りません」（赤・実現可能性バナー）と
//   「遅延が続いています — 計画の見直しを検討」（黄・ペースカード）が同時に立ち、
//   合計6項目の選択肢が並んでいた。**両者の原因は1つ**（使える時間が必要量に届かない）で、
//   選択肢も「時間を増やす／範囲や目標日を動かす／不足を承知で進む」と重複している。
//   常時2枚出る警告は読み飛ばされ、本当に効かせたい日に効かなくなる。
//
//   さらに、旧文言の「科目合格制を使い、今回は理論だけに絞って残りを次回受験へ回す」は
//   **選択肢の置き場所が間違っていた**。設計書 §3.2 の表は科目合格制を ②期日を延ばす に
//   置いているが、この画面のモデルに現れる効果はそこではない。実現可能性（policy.ts）は
//   科目ごとの denken_exam_plans と、その科目の収録問題だけで必要量を積んでいるので、
//   他科目を次回へ回しても**必要 分/日 は1分も減らない**。効くのは供給側 ――
//   他科目に使っていた時間がこの科目へ回るぶん、実績 分/日 が上がる。
//   つまり科目合格制は ①学習に使う時間を増やす の一手段であって、独立した3つ目の手ではない。
//   （設計書 §3.2 ② の「判断材料は出すが自動では動かさない」はそのまま守る。）
//
//   同様に「目標を『合格ライン到達』に切り替える」も、そのモードは CBT実測2回で想定得点が
//   較正されるまで無効（passTarget.isEstimateValidated）なので、利用者がいま押せる手ではない。
//   選べない手を選択肢として並べない。
//
// 残るのは、この画面のデータで実際に動かせる3つ（設計書 §3.6 の options と同じ3つ）:
//   ① increase_time … 学習に使う時間を増やす（科目合格制での集中を含む）
//   ② defer_exam   … 完走目標日（分野別 全問A以上 目標日）を後ろ倒す。試験日は動かせない
//   ③ accept_risk  … 不足を承知でこのまま進む。目標もノルマも自動では下げない
// ==========================================================================

import type { Feasibility, FeasibilityOption } from './policy'
import type { PaceResult } from './pace'
import { MIN_NENDO_DAYS } from './pace'
import { formatMinutes } from './estimateMinutes'
import { addDaysStr, formatMD } from './date'

export type PlanAlertLevel = 'shortfall' | 'behind'

export interface PlanAlertChoice {
  /** 設計書 §3.6 の Feasibility.options と同じキー。文言だけをここで持つ。 */
  key: FeasibilityOption
  title: string
  detail: string
}

export interface PlanAlert {
  level: PlanAlertLevel
  headline: string
  /** 原因の事実。1行ずつ。 */
  facts: string[]
  choices: PlanAlertChoice[]
  /** 補足（選べない手についての注記）。無ければ null。 */
  note: string | null
}

/**
 * 分析タブに出す唯一の警告を組み立てる。出さないときは null。
 *
 * 出す条件は旧2枚の OR（時間不足 または 遅延の持続）。どちらか一方でも、原因の説明と
 * 取れる手は同じなので、見出しと事実行だけを状況に合わせて変える。
 */
export function buildPlanAlert(params: {
  feasibility: Feasibility
  pace: PaceResult
  /** 想定得点が CBT実測で較正済みか（passTarget.isEstimateValidated）。 */
  estimateValidated: boolean
}): PlanAlert | null {
  const { feasibility: f, pace, estimateValidated } = params
  const shortfall = f.verdict === 'shortfall'
  const behind = pace.needsReplan
  if (!shortfall && !behind) return null

  const goalLabel = pace.goalMode === 'pass' ? '合格ライン到達' : '全問A以上'
  const shortageMinutes = Math.max(0, f.requiredMinutesPerDay - f.availableMinutesPerDay)

  const headline = shortfall
    ? behind ? `時間が足りません（遅延 ${pace.verdictDays}日）` : '時間が足りません'
    : `遅れが続いています（${pace.verdictDays}日）`

  const facts: string[] = []
  if (shortfall) {
    facts.push(
      `全範囲の完走に必要な時間は ${formatMinutes(f.requiredMinutesPerDay)}/日。` +
      `直近の実績は ${formatMinutes(f.availableMinutesPerDay)}/日で、${formatMinutes(shortageMinutes)}/日 足りません。`,
    )
  }
  if (behind && pace.projectedFinishDate && pace.bunyaTargetDate) {
    facts.push(
      `現ペース（${pace.currentPace.toFixed(1)}問/日）だと ${goalLabel} は ` +
      `${formatMD(pace.projectedFinishDate)} 見込みで、目標 ${formatMD(pace.bunyaTargetDate)} を ` +
      `${pace.verdictDays}日 超過します。`,
    )
  }

  const choices: PlanAlertChoice[] = [
    {
      key: 'increase_time',
      title: '学習に使う時間を増やす',
      detail: (shortfall
        ? `あと ${formatMinutes(shortageMinutes)}/日 で計画どおりになります。`
        : `目標には ${pace.requiredPace.toFixed(1)}問/日 が必要です（現在 ${pace.currentPace.toFixed(1)}問/日）。`)
        + '科目合格制を使って今回はこの科目に集中するのも、この時間を作る手の一つです。',
    },
  ]
  if (pace.bunyaTargetDate) {
    const limitDate = pace.examDate ? addDaysStr(pace.examDate, -MIN_NENDO_DAYS) : null
    choices.push({
      key: 'defer_exam',
      title: '完走目標日を後ろ倒す（設定タブ）',
      detail: limitDate
        ? `年度別演習に最低${MIN_NENDO_DAYS}日を残す限界は ${formatMD(limitDate)}。試験日は動かせません。`
        : '「分野別 全問A以上 目標日」を実態に合わせ直します。試験日は動かせません。',
    })
  }
  choices.push({
    key: 'accept_risk',
    title: '不足を承知でこのまま進む',
    detail: '目標もノルマも自動では下げません。今日のキューは順序が変わるだけで、やらなかった分は翌日以降に必ず戻ります。',
  })

  // 「範囲を絞る」は選択肢に置かない ― CBT実測2回で想定得点が較正されるまで
  // 無効なモードであり、いま押せる手ではないため（passTarget.ts のゲート）。
  const note = !estimateValidated
    ? '「合格ラインに必要な問題だけへ範囲を絞る」は、CBT模試2回で想定得点を較正するまで使えません。'
    : null

  return { level: shortfall ? 'shortfall' : 'behind', headline, facts, choices, note }
}
