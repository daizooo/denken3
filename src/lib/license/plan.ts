// 試験日程と目標日（本試験からの逆算）— licensehub-expansion.md §10.1・§15の9・§17。
//
// 目標日は固定値で持たない。本試験日と基準点（anchors）から「1周目の完了期限」を出し、
// 演習の開始日から完了期限までを科目の重みで按分して、学習順に並べた各科目の目標日を出す。
// 結果は denken_exam_plans.bunya_target_date に書く。
//
// - 上書きした科目（overrides）は再計算の対象外（その日付をそのまま返す）。他の科目の按分は変えない。
// - 制約「目標日 ≧ 書籍の発売日＋最短演習日数」を満たせない科目は警告を返す（日付は動かさない）。
import { addDaysStr, diffDays } from '../date'

/** 逆算の基準点（すべて設定値。§10.1 の表）。 */
export interface PlanAnchors {
  /** 演習の開始日（起点）。'YYYY-MM-DD' */
  startDate: string
  /** 模試ゲート。'YYYY-MM-DD'（日付で持つ。本試験日を変えても動かない） */
  gateDate: string
  /** 直前期の開始 = 本試験の何週前か */
  finalPhaseWeeks: number
  /** 通し演習の開始 = 模試ゲートの何週前か（1周目の完了期限はその前日） */
  throughWeeks: number
  /** 書籍の発売日から目標日までに最低限ほしい日数 */
  minPracticeDays: number
  /** 科目ごとの書籍の発売日（科目ID → 'YYYY-MM-DD'）。無い科目は制約を確かめない */
  releaseDates: Record<string, string>
}

export interface PlanMilestones {
  examDate: string
  finalPhaseStart: string
  gateDate: string
  throughStart: string
  firstRoundDeadline: string
  startDate: string
}

export interface SubjectTarget {
  subjectId: string
  /** 目標日（上書きした科目は上書きの日付） */
  target: string
  /** 逆算の値（上書きの有無によらない） */
  computed: string
  overridden: boolean
  /** 制約を満たせないときの理由。満たすときは null */
  warning: string | null
}

export interface PlanResult {
  milestones: PlanMilestones
  targets: SubjectTarget[]
  /** 基準点どうしの矛盾など、科目によらない警告 */
  warnings: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 本試験日と基準点から、直前期の開始・通し演習の開始・1周目の完了期限を出す。 */
export function planMilestones(examDate: string, anchors: PlanAnchors): PlanMilestones {
  const throughStart = addDaysStr(anchors.gateDate, -7 * anchors.throughWeeks)
  return {
    examDate,
    finalPhaseStart: addDaysStr(examDate, -7 * anchors.finalPhaseWeeks),
    gateDate: anchors.gateDate,
    throughStart,
    firstRoundDeadline: addDaysStr(throughStart, -1),
    startDate: anchors.startDate,
  }
}

/**
 * 各科目の目標日を出す。
 * 開始日から1周目の完了期限までの日数 N を、学習順に累積した重みの割合で按分する
 * （科目 i の目標日 = 開始日 + round(N × 累積重み_i / 重みの合計)）。最後の科目は完了期限ちょうどになる。
 * order に無い科目・重みが0以下の科目は対象外。order の重複は先に出た方だけを使う。
 */
export function computeTargets(
  examDate: string,
  anchors: PlanAnchors,
  weights: Record<string, number>,
  order: string[],
  overrides: Record<string, string> = {},
): PlanResult {
  const milestones = planMilestones(examDate, anchors)
  const warnings: string[] = []
  const subjects = [...new Set(order)].filter(id => (weights[id] ?? 0) > 0)
  const total = subjects.reduce((s, id) => s + weights[id], 0)
  const span = diffDays(anchors.startDate, milestones.firstRoundDeadline)

  if (span <= 0) warnings.push(`1周目の完了期限（${milestones.firstRoundDeadline}）が演習の開始日（${anchors.startDate}）より後になっていません`)
  if (diffDays(anchors.gateDate, milestones.finalPhaseStart) <= 0) {
    warnings.push(`模試ゲート（${anchors.gateDate}）が直前期の開始（${milestones.finalPhaseStart}）より前になっていません`)
  }
  if (diffDays(milestones.finalPhaseStart, examDate) <= 0) warnings.push('直前期の開始が本試験日より前になっていません')

  let cum = 0
  const targets = subjects.map((subjectId): SubjectTarget => {
    cum += weights[subjectId]
    const computed = addDaysStr(anchors.startDate, Math.round((Math.max(span, 0) * cum) / total))
    const override = overrides[subjectId]
    const overridden = typeof override === 'string' && DATE_RE.test(override)
    const target = overridden ? override : computed
    return { subjectId, target, computed, overridden, warning: releaseWarning(target, anchors, subjectId) }
  })
  return { milestones, targets, warnings }
}

function releaseWarning(target: string, anchors: PlanAnchors, subjectId: string): string | null {
  const release = anchors.releaseDates[subjectId]
  if (!release) return null
  const earliest = addDaysStr(release, anchors.minPracticeDays)
  if (diffDays(earliest, target) >= 0) return null
  return `目標日 ${target} が、書籍の発売日 ${release}＋最短演習日数 ${anchors.minPracticeDays}日（${earliest}）より前です`
}

/**
 * 設定値（denken_settings の jsonb。未設定は null）を既定値に重ねる。型の合わない値は既定値に戻す。
 * order は既知の科目だけを残し、漏れた科目を既定の順で末尾に足す（科目が増えても消えない）。
 */
export function resolvePlanSettings(
  defaults: { anchors: PlanAnchors; weights: Record<string, number>; order: string[] },
  stored: { anchors?: unknown; weights?: unknown; order?: unknown },
): { anchors: PlanAnchors; weights: Record<string, number>; order: string[] } {
  const a = isRecord(stored.anchors) ? stored.anchors : {}
  const pickDate = (v: unknown, d: string) => (typeof v === 'string' && DATE_RE.test(v) ? v : d)
  const pickNum = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d)
  const releaseDates = { ...defaults.anchors.releaseDates }
  if (isRecord(a.releaseDates)) {
    for (const [k, v] of Object.entries(a.releaseDates)) if (typeof v === 'string' && DATE_RE.test(v)) releaseDates[k] = v
  }
  const anchors: PlanAnchors = {
    startDate: pickDate(a.startDate, defaults.anchors.startDate),
    gateDate: pickDate(a.gateDate, defaults.anchors.gateDate),
    finalPhaseWeeks: pickNum(a.finalPhaseWeeks, defaults.anchors.finalPhaseWeeks),
    throughWeeks: pickNum(a.throughWeeks, defaults.anchors.throughWeeks),
    minPracticeDays: pickNum(a.minPracticeDays, defaults.anchors.minPracticeDays),
    releaseDates,
  }
  const weights = { ...defaults.weights }
  if (isRecord(stored.weights)) {
    for (const [k, v] of Object.entries(stored.weights)) if (k in weights) weights[k] = pickNum(v, weights[k])
  }
  const known = new Set(defaults.order)
  const fromStored = Array.isArray(stored.order) ? stored.order.filter((v): v is string => typeof v === 'string' && known.has(v)) : []
  const order = [...new Set([...fromStored, ...defaults.order])]
  return { anchors, weights, order }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
