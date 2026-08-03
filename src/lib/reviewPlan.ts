// 復習の適応型セレクタ（learning-recovery-rebuild）。すべて純関数。
//
// 設計思想は pace.ts と同じ ――「1日の上限で機械的に切らない。残り日数と進捗から
// 毎日、最適な問題を自動で選ぶ」。pace.ts が"新規着手"に対して行っていることを、
// ここでは"復習の選択"に対して行う。
//
// 中心は2つ:
//   ① 価値順（reviewValue）: 期待得点への寄与＝〔重要度〕×〔忘却リスク(1-R)〕×〔理解度〕。
//      頻出・重要で、いま忘れかけていて、理解度の低い問題ほど先に出す。
//   ② 今日の推奨ライン（planDailyReviews）: 溜まった復習を"上限で隠す"のではなく、
//      価値順に並べたうえで「今日はここまでやれば計画通り」の線を引く。
//      線より下は"遅延"ではなく"順番待ち"。忘却リスクの高い問題は必ず線の上に来る。
//
// 入力は (question, review, today, examDate) のみ。DB・UI には依存しない。

import type { MasterQuestion, Review, Status } from '../domain/types'
import { retrievability } from './fsrs'
import { diffDays } from './date'

// 理解度の重み（大きいほど価値が高い＝先に復習）。
// C（答えを見た）> B（方向性OK・計算ミス）> A（見ずに解けた）。S・未着手は復習対象外。
const STATUS_WEIGHT: Partial<Record<Status, number>> = { C: 1.0, B: 0.7, A: 0.45 }

// 忘却リスクが十分低くても、重要度・理解度で最低限の差がつくようにする下駄。
const RISK_FLOOR = 0.15

// リスク帯のしきい値（想起確率 R）。FSRS の目標保持率90%を基準にする。
// R≥0.90＝まだ目標圏内（余裕）／0.90>R≥0.80＝目標割れ（そろそろ）／R<0.80＝優先。
const R_HIGH = 0.8 // これ未満＝🔴 優先（忘却が進行）
const R_MID = 0.9 // これ未満＝🟡 そろそろ

export type RiskBand = 'high' | 'mid' | 'low'

export interface ReviewValue {
  score: number // 価値スコア（大きいほど先に復習）
  r: number | null // 想起確率 R（0..1）。対象外は null
  risk: number // 忘却リスク 1-R（対象外は 0）
  band: RiskBand
}

// 重要度(1..3)の重み。未設定は2扱い。imp1=0.6 / imp2=1.0 / imp3=1.4。
function importanceWeight(importance?: 1 | 2 | 3): number {
  return 0.6 + 0.4 * ((importance ?? 2) - 1)
}

function bandOf(r: number | null): RiskBand {
  if (r === null) return 'low'
  if (r < R_HIGH) return 'high'
  if (r < R_MID) return 'mid'
  return 'low'
}

// 1問の復習価値。復習タブの並び順の主キー。
export function reviewValue(
  question: MasterQuestion,
  review: Review | undefined,
  today: string,
): ReviewValue {
  const status = review?.status ?? '未着手'
  const statusW = STATUS_WEIGHT[status]
  // 復習対象外（未着手・S）はスコア0で末尾へ。
  if (statusW === undefined) return { score: 0, r: null, risk: 0, band: 'low' }
  const r = retrievability(review, today)
  const risk = r === null ? 0 : 1 - r
  const score = statusW * importanceWeight(question.importance) * (RISK_FLOOR + risk)
  return { score, r, risk, band: bandOf(r) }
}

// リスク帯の表示メタ（QuestionCard 等で使う）。
export function bandMeta(band: RiskBand): { label: string; cls: string; dot: string } {
  switch (band) {
    case 'high':
      return { label: '優先（忘却が進行）', cls: 'text-red-500', dot: 'bg-red-400' }
    case 'mid':
      return { label: 'そろそろ', cls: 'text-amber-500', dot: 'bg-amber-400' }
    default:
      return { label: '余裕あり', cls: 'text-emerald-600', dot: 'bg-emerald-400' }
  }
}

export interface DailyReviewPlan {
  dueCount: number // 今日時点で復習期限を迎えている問題数
  urgentCount: number // うち🔴危険（R<0.75）の数。必ず推奨ラインの上に来る
  recommendedCount: number // 今日の推奨ライン（順番待ちとの境界）
}

// 溜まった復習を何日で捌くか。試験が近いほど詰める（deadline-aware）。
function catchUpDays(daysToExam: number | null): number {
  if (daysToExam === null) return 3
  if (daysToExam <= 14) return 1
  if (daysToExam <= 30) return 2
  return 3
}

// 今日の推奨ライン（② 線引き型）。上限キャップではなく推奨。
// - 忘却リスクの高い問題（urgent）は必ず全部、線の上に含める。
// - 残りは catchUpDays 日で均すよう ceil(due/日数) を目安にする。
// - どちらも due 総数を超えない。
export function planDailyReviews(
  candidates: { question: MasterQuestion; review: Review | undefined }[],
  today: string,
  examDate: string | null,
): DailyReviewPlan {
  const dueCount = candidates.length
  if (dueCount === 0) return { dueCount: 0, urgentCount: 0, recommendedCount: 0 }

  let urgentCount = 0
  for (const c of candidates) {
    if (reviewValue(c.question, c.review, today).band === 'high') urgentCount++
  }

  const daysToExam = examDate ? diffDays(today, examDate) : null
  const spread = Math.ceil(dueCount / catchUpDays(daysToExam))
  const recommendedCount = Math.min(dueCount, Math.max(urgentCount, spread, 1))

  return { dueCount, urgentCount, recommendedCount }
}
