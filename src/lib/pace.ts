// 適応型ペース分析（§7.2）。すべて純関数。
//
// 設計原則: 学習キャパシティを事前に宣言させない。
// 産後1年程度は1日にどれだけ勉強できるか不確定であり「この期間はこう」と断定できない。
// そこで固定の休止期間や固定窓の平均ではなく、日々の実績（新規着手数）の
// 指数加重移動平均（EWMA・半減期14日）で現在ペースを推定し続け、
// 毎日、残り日数と突き合わせて計画を再計算する。
//
// 入力は (questions, reviews, plan, today)。DB・UIには依存しない。

import type { ExamPlan, Review } from '../domain/types'
import { addDaysStr, diffDays, formatMD } from './date'

// EWMA 半減期14日 → 1ステップ(1日)あたりの平滑化係数。
// (1-alpha)^14 = 0.5 を満たす alpha。
const EWMA_HALF_LIFE_DAYS = 14
const EWMA_ALPHA = 1 - Math.pow(0.5, 1 / EWMA_HALF_LIFE_DAYS)

// 遅延が「持続」していると見なす超過日数のしきい値（軌道修正提案のトリガ）。
const REPLAN_LATE_DAYS = 14
// 分野別完走の既定目標＝試験日の何日前か（plan.bunya_target_date 未設定時）。
const DEFAULT_BUNYA_LEAD_DAYS = 90
// 年度別演習に最低限確保したい日数（後ろ倒しの限界日算出に使う）。
const MIN_NENDO_DAYS = 30

export type PaceVerdict = 'done' | 'ahead' | 'onTrack' | 'behind' | 'stalled'

export interface Milestone {
  key: string
  label: string
  date: string
  daysFromToday: number
}

export interface WeeklyLoad {
  weekLabel: string
  due: number          // その週に既に予定されている復習（due_date 分布）
  projectedNew: number // 推奨ノルマで新規着手した分から発生する初回復習の推定
}

export interface ReplanOption {
  key: 'postpone' | 'narrow' | 'capacity'
  title: string
  detail: string
}

export interface PaceResult {
  hasPlan: boolean
  examDate: string | null
  bunyaTargetDate: string | null
  daysToExam: number | null

  totalQ: number
  startedQ: number
  remainingQ: number       // 未着手 U

  currentPace: number      // EWMA 現在ペース（問/日）
  requiredPace: number     // U / 残り日数（問/日）
  recommendedNorm: number  // 今日の推奨ノルマ（問・整数）

  projectedFinishDate: string | null
  verdict: PaceVerdict
  verdictDays: number      // 先行/遅延の日数（onTrack/done/stalled は 0）

  needsReplan: boolean     // 遅延が持続し計画見直しが要るか
  replanOptions: ReplanOption[]

  milestones: Milestone[]
  weeklyLoad: WeeklyLoad[]
}

interface QLike { id: string }

// 未着手判定: レビュー無し or status==='未着手'
function isUntouched(r: Review | undefined): boolean {
  return !r || r.status === '未着手'
}

// 日次の新規着手数（first_reviewed === その日）を集計。
function dailyNewStarts(reviews: Record<string, Review>): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of Object.values(reviews)) {
    const d = r.first_reviewed
    if (!d) continue
    m.set(d, (m.get(d) ?? 0) + 1)
  }
  return m
}

// 現在ペース（EWMA）。最初の実績日〜today を1日刻みで走査し、
// 学習ゼロの日も0問として算入する（休止を自動的に織り込む）。
export function estimateCurrentPace(reviews: Record<string, Review>, today: string): number {
  const daily = dailyNewStarts(reviews)
  if (daily.size === 0) return 0
  const startDay = [...daily.keys()].sort()[0]
  const span = diffDays(startDay, today)
  if (span < 0) return 0
  let ewma = 0
  for (let i = 0; i <= span; i++) {
    const day = addDaysStr(startDay, i)
    const x = daily.get(day) ?? 0
    ewma = EWMA_ALPHA * x + (1 - EWMA_ALPHA) * ewma
  }
  return ewma
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// 週次の復習負荷予測（§7.2 復習負荷予測）。
// 既存 due_date 分布に、推奨ノルマで新規着手した分の初回復習見込みを重ねる。
function buildWeeklyLoad(
  questions: QLike[],
  reviews: Record<string, Review>,
  today: string,
  horizonWeeks: number,
  recommendedNorm: number,
  bunyaTargetDate: string | null,
): WeeklyLoad[] {
  const weeks: WeeklyLoad[] = []
  for (let w = 0; w < horizonWeeks; w++) {
    const start = addDaysStr(today, w * 7)
    const end = addDaysStr(today, (w + 1) * 7) // [start, end)
    const due = questions.filter(q => {
      const d = reviews[q.id]?.due_date
      if (!d) return false
      // 最初の週は「今日以前の遅延分」も含める
      if (w === 0) return d < end
      return d >= start && d < end
    }).length
    // 新規着手はおおむね翌週に初回復習が発生すると仮定した軽量な推定。
    const withinTarget = !bunyaTargetDate || start < bunyaTargetDate
    const projectedNew = w >= 1 && withinTarget ? Math.round(recommendedNorm * 7) : 0
    weeks.push({ weekLabel: formatMD(start), due, projectedNew })
  }
  return weeks
}

export function analyzePace(
  questions: QLike[],
  reviews: Record<string, Review>,
  plan: ExamPlan | null,
  today: string,
): PaceResult {
  const totalQ = questions.length
  const remainingQ = questions.filter(q => isUntouched(reviews[q.id])).length
  const startedQ = totalQ - remainingQ

  const currentPace = estimateCurrentPace(reviews, today)

  const examDate = plan?.exam_date ?? null
  const daysToExam = examDate ? diffDays(today, examDate) : null

  // 分野別完走の目標日: 明示指定 > (試験日 - 90日) > なし
  const bunyaTargetDate =
    plan?.bunya_target_date ??
    (examDate ? addDaysStr(examDate, -DEFAULT_BUNYA_LEAD_DAYS) : null)

  const hasPlan = !!examDate

  // 目標日までの残り日数（下限1日）。
  const R = bunyaTargetDate ? Math.max(1, diffDays(today, bunyaTargetDate)) : null
  const requiredPace = R !== null ? remainingQ / R : 0

  // 完走予測日: today + ceil(U / 現在ペース)。ペース0（実績なし）は予測不能。
  const projectedFinishDate =
    remainingQ === 0
      ? today
      : currentPace > 0
        ? addDaysStr(today, Math.ceil(remainingQ / currentPace))
        : null

  // 判定: 完走予測 vs 目標日。
  let verdict: PaceVerdict
  let verdictDays = 0
  if (remainingQ === 0) {
    verdict = 'done'
  } else if (!projectedFinishDate) {
    verdict = 'stalled'
  } else if (!bunyaTargetDate) {
    verdict = 'onTrack'
  } else {
    const lead = diffDays(projectedFinishDate, bunyaTargetDate) // 正=目標より早い
    if (lead >= 3) { verdict = 'ahead'; verdictDays = lead }
    else if (lead <= -1) { verdict = 'behind'; verdictDays = -lead }
    else verdict = 'onTrack'
  }

  // 今日の推奨ノルマ: clamp(必要ペース, 現在ペース×0.8, 現在ペース×1.3)。
  // 実績とかけ離れた無理な数字を出さない。実績が無い（currentPace=0）ときは
  // 必要ペースをそのまま提示する。
  const lower = currentPace > 0 ? currentPace * 0.8 : 0
  const upper = currentPace > 0 ? currentPace * 1.3 : requiredPace
  const recommendedNorm =
    remainingQ === 0 ? 0 : Math.max(1, Math.ceil(clamp(requiredPace, lower, upper)))

  // 計画見直しが要るか: 必要ペースが現在ペースの上限（×1.3）を超え続ける、
  // かつ完走予測が目標を REPLAN_LATE_DAYS 日以上超過。
  const needsReplan =
    remainingQ > 0 &&
    verdict === 'behind' &&
    verdictDays >= REPLAN_LATE_DAYS

  const replanOptions: ReplanOption[] = []
  if (needsReplan) {
    // a) 目標日の後ろ倒し（試験日から逆算した限界日を併記）
    const limitDate = examDate ? addDaysStr(examDate, -MIN_NENDO_DAYS) : null
    replanOptions.push({
      key: 'postpone',
      title: '完走目標を後ろ倒しする',
      detail: projectedFinishDate
        ? `現ペースなら ${formatMD(projectedFinishDate)} 完走見込み。` +
          (limitDate ? `年度別に最低${MIN_NENDO_DAYS}日を残す限界は ${formatMD(limitDate)}。` : '')
        : '現ペースでは完走時期を見通せません。',
    })
    // b) 範囲の絞り込み（importance=3 のみ完走 → 残りは年度別期に回す）
    replanOptions.push({
      key: 'narrow',
      title: '範囲を絞る（重要度の高い問題を優先）',
      detail: '重要度3の問題だけ先に完走し、残りは年度別演習期に回す。',
    })
    // c) daily_cap・生活時間の見直し
    replanOptions.push({
      key: 'capacity',
      title: '1日の学習時間・復習上限を見直す',
      detail: `目標達成には約 ${requiredPace.toFixed(1)} 問/日 が必要（現在ペース ${currentPace.toFixed(1)} 問/日）。`,
    })
  }

  // マイルストーン表（分野別完走目標 → 年度別開始 → 申込期間 → 試験日）。
  const milestones: Milestone[] = []
  const push = (key: string, label: string, date: string | null | undefined) => {
    if (!date) return
    milestones.push({ key, label, date, daysFromToday: diffDays(today, date) })
  }
  push('bunya', '分野別 完走目標', bunyaTargetDate)
  push('nendo', '年度別演習 開始', plan?.nendo_start_date)
  push('appStart', '申込開始', plan?.application_start)
  push('appEnd', '申込締切', plan?.application_end)
  push('exam', '試験日', examDate)
  milestones.sort((a, b) => a.date.localeCompare(b.date))

  // 週次の復習負荷予測（試験日まで、最大16週）。
  const horizonWeeks = daysToExam && daysToExam > 0
    ? Math.min(16, Math.ceil(daysToExam / 7))
    : 12
  const weeklyLoad = buildWeeklyLoad(
    questions, reviews, today, horizonWeeks, recommendedNorm, bunyaTargetDate,
  )

  return {
    hasPlan,
    examDate,
    bunyaTargetDate,
    daysToExam,
    totalQ,
    startedQ,
    remainingQ,
    currentPace,
    requiredPace,
    recommendedNorm,
    projectedFinishDate,
    verdict,
    verdictDays,
    needsReplan,
    replanOptions,
    milestones,
    weeklyLoad,
  }
}

// 申込リマインドの状態（§7.1）。
// 当日が「開始14日前〜締切」の範囲にあるとき表示。締切3日前からは赤強調。
export interface ApplicationReminder {
  show: boolean
  urgent: boolean
  message: string
}

export function applicationReminder(plan: ExamPlan | null, today: string): ApplicationReminder {
  const none: ApplicationReminder = { show: false, urgent: false, message: '' }
  if (!plan?.application_end) return none
  const toEnd = diffDays(today, plan.application_end)
  if (toEnd < 0) return none // 締切超過は本バナーでは扱わない
  // 開始日があれば「開始14日前」から、無ければ締切14日前から表示。
  const startAnchor = plan.application_start ?? plan.application_end
  const toStartAnchor = diffDays(today, addDaysStr(startAnchor, -14))
  if (toStartAnchor > 0) return none // まだ表示期間前

  const urgent = toEnd <= 3
  const started = !plan.application_start || diffDays(today, plan.application_start) >= 0
  const window =
    plan.application_start && plan.application_end
      ? `${formatMD(plan.application_start)}〜${formatMD(plan.application_end)}`
      : formatMD(plan.application_end)
  const message = started
    ? `受験申込 受付中（${window}）。締切まであと ${toEnd} 日 — CBTを欠席すると筆記も受験できません。`
    : `受験申込 まもなく開始（${window}）。`
  return { show: true, urgent, message }
}
