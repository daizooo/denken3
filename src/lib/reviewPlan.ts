// 復習の適応型セレクタ（learning-recovery-rebuild）。すべて純関数。
//
// 設計思想は pace.ts と同じ ――「1日の上限で機械的に切らない。残り日数と進捗から
// 毎日、最適な問題を自動で選ぶ」。pace.ts が"新規着手"に対して行っていることを、
// ここでは"復習の選択"に対して行う。
//
// 中心は2つ:
//   ① 価値順（reviewValue）: 期待得点への寄与＝〔忘却リスク(1-R)〕×〔理解度〕。
//      いま忘れかけていて、理解度の低い問題ほど先に出す。
//   ② 今日の推奨ライン（planDailyReviews）: 溜まった復習を"上限で隠す"のではなく、
//      価値順に並べたうえで「今日はここまでやれば計画通り」の線を引く。
//      線より下は"遅延"ではなく"順番待ち"。忘却リスクの高い問題は必ず線の上に来る。
//
// 入力は (question, review, today, examDate) のみ。DB・UI には依存しない。

import type { MasterQuestion, Review, Status } from '../domain/types'
import { retentionFor, retrievability } from './fsrs'
import { sourceFrequency } from './sourceLink'
import { diffDays } from './date'

// 理解度の重み（大きいほど価値が高い＝先に復習）。
// C（答えを見た）> B（方向性OK・計算ミス）> A（見ずに解けた）> S（完璧に理解）。
// S は通常の復習キューには載らないが、試験前の最終確認（fsrs.ts `finalCheckDue`）と
// 手動の復習再開では due_date が付いて載る。そのとき価値0だとキューの最下段に沈み、
// 時間予算の線から外れて「結局やらない」ことになるため、A より低い重みを与える。
// 未着手だけが復習対象外（重み未設定）。
const STATUS_WEIGHT: Partial<Record<Status, number>> = { C: 1.0, B: 0.7, A: 0.45, S: 0.25 }

// 忘却リスクが十分低くても、理解度で最低限の差がつくようにする下駄。
const RISK_FLOOR = 0.15

// リスク帯のしきい値（想起確率 R）。FSRS の目標保持率 request_retention を基準にする。
// R≥目標＝まだ目標圏内（余裕）／目標>R≥目標-0.10＝目標割れ（そろそろ）／それ未満＝優先。
//
// 目標保持率は固定値ではなく試験までの残日数で変わる（fsrs.ts `retentionFor`：既定0.85・
// 直前期0.9）ため、ここも連動させる。連動させずに 0.9 固定のままだと、retention 0.85 で
// FSRS が「予定どおり」と判断した問題が期限当日に軒並み🟡そろそろ になり、帯が
// 優先度として機能しなくなる（§6-2）。
const BAND_HIGH_MARGIN = 0.1 // 目標からこれだけ下回ったら🔴 優先（忘却が進行）

export type RiskBand = 'high' | 'mid' | 'low'

export interface ReviewValue {
  score: number // 価値スコア（大きいほど先に復習）
  r: number | null // 想起確率 R（0..1）。対象外は null
  risk: number // 忘却リスク 1-R（対象外は 0）
  band: RiskBand
  frequency: number // 過去の出題回数（同点時のタイブレーク専用・§8.4）
}

function bandOf(r: number | null, retention: number): RiskBand {
  if (r === null) return 'low'
  if (r < retention - BAND_HIGH_MARGIN) return 'high'
  if (r < retention) return 'mid'
  return 'low'
}

// 1問の復習価値。復習タブの並び順の主キー。
// examDate はリスク帯のしきい値（目標保持率）を決めるためだけに使う。
// 未指定なら既定の保持率で判定する（試験日未設定時の従来どおりの挙動）。
//
// importance はスコアから外した（課題11）。分布が 3:366 / 2:70 / 1:4 と83%が3で、
// 重みは実質つねに1.4の定数になっており、並び順に寄与していなかった。代替として
// 検討した出題頻度も 1回:360 / 2回:75 / 3回:5 とほぼ同じ偏りで、定数を別の定数へ
// 置き換えるだけになる（§8.4）。そこで頻度は主キーには入れず、価値が同点のときの
// タイブレークとしてだけ返す（2回以上出題された80問を、同条件のときだけ前に出す）。
// targetRetention は、その問題に適用されている目標保持率（Phase C・層3）。
// 省略時は従来どおり日付だけで決まる `retentionFor(today, examDate)` を使う。
// **帯のしきい値はスケジューリングに使った保持率と揃える必要がある。** コアを 0.90 で
// スケジュールしているのに帯だけ 0.85 基準で見ると、FSRS が「そろそろ危ない」と判断して
// due にした問題が画面上は「余裕あり」に見え、帯が優先度として機能しなくなる（§6-2 と同じ理由）。
export function reviewValue(
  question: MasterQuestion,
  review: Review | undefined,
  today: string,
  examDate?: string | null,
  targetRetention?: number,
): ReviewValue {
  const status = review?.status ?? '未着手'
  const statusW = STATUS_WEIGHT[status]
  const frequency = sourceFrequency(question.title)
  // 復習対象外（未着手＝新規着手枠）はスコア0で末尾へ。
  if (statusW === undefined) return { score: 0, r: null, risk: 0, band: 'low', frequency }
  const r = retrievability(review, today)
  const risk = r === null ? 0 : 1 - r
  const score = statusW * (RISK_FLOOR + risk)
  const retention = targetRetention ?? retentionFor(today, examDate)
  return { score, r, risk, band: bandOf(r, retention), frequency }
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
  urgentCount: number // うち🔴優先（R が目標保持率-0.10 未満）の数。必ず推奨ラインの上に来る
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
    if (reviewValue(c.question, c.review, today, examDate).band === 'high') urgentCount++
  }

  const daysToExam = examDate ? diffDays(today, examDate) : null
  const spread = Math.ceil(dueCount / catchUpDays(daysToExam))
  const recommendedCount = Math.min(dueCount, Math.max(urgentCount, spread, 1))

  return { dueCount, urgentCount, recommendedCount }
}
