// FSRS（ts-fsrs v5 公式実装）による復習スケジューリング。
// enable_short_term=false で日単位スケジューリング。
import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs'
import type { Card, Grade } from 'ts-fsrs'
import type { Review, ReviewHistoryEntry, Status } from '../domain/types'
import { addDaysStr, dateAtUTCNoon, diffDays, toDateStr, todayJST } from './date'

// 目標保持率 request_retention（§6-2）。
// 学習時間が希少で未着手が多い段階では 0.9 は保守的すぎる（同じ時間で触れる問題数が減る）。
// 既定を 0.85 に下げ、直前期＝試験60日前からは精度優先で 0.9 へ戻す。
// retention を「その実施日から試験日までの残日数」だけで決めるのが要点で、こうすると
// deriveFromHistory が review_history を再生するたびに同じ結果になる（決定的）。
export const RETENTION_DEFAULT = 0.85
export const RETENTION_ENDGAME = 0.9
export const RETENTION_ENDGAME_DAYS = 60

export function retentionFor(eventDate: string, examDate?: string | null): number {
  if (!examDate) return RETENTION_DEFAULT
  return diffDays(eventDate, examDate) <= RETENTION_ENDGAME_DAYS
    ? RETENTION_ENDGAME
    : RETENTION_DEFAULT
}

// request_retention ごとに FSRS インスタンスを使い回す（実施日ごとに生成しない）。
const schedulers = new Map<number, FSRS>()
function schedulerFor(retention: number): FSRS {
  let s = schedulers.get(retention)
  if (!s) {
    s = new FSRS({ enable_short_term: false, request_retention: retention })
    schedulers.set(retention, s)
  }
  return s
}

// S（復習不要）の試験前最終確認（§6-4・課題4）。
// S にした問題は due_date=null で忘却追跡から完全に外れ、そのままだと試験まで一度も
// 戻ってこない。試験日の21日前に1回だけ復習キューへ戻す。
// - 試験日が未設定なら従来どおり null（復習キューから外れたまま）。
// - 最終確認日が実施日を過ぎている場合も null。過去日を due にすると毎日 due に
//   居座り、直前期に S を付け直すたびに翌日また出てくることになるため。
export const FINAL_CHECK_DAYS_BEFORE_EXAM = 21

export function finalCheckDue(eventDate: string, examDate?: string | null): string | null {
  if (!examDate) return null
  const due = addDaysStr(examDate, -FINAL_CHECK_DAYS_BEFORE_EXAM)
  return due > eventDate ? due : null
}

const RATING_MAP: Record<Status, Grade> = {
  A: Rating.Easy,
  B: Rating.Good,
  C: Rating.Again,
  // S・未着手 はスケジューラを回さない（calcFSRS で早期リターン）。便宜上の既定値。
  S: Rating.Easy,
  '未着手': Rating.Good,
}

function toFSRSCard(review: Partial<Review>, now: Date): Card {
  const lastReview = review.last_reviewed ? dateAtUTCNoon(toDateStr(review.last_reviewed)) : now
  const due = review.due_date ? dateAtUTCNoon(toDateStr(review.due_date)) : now
  return {
    due,
    stability: review.stability ?? 0,
    difficulty: review.difficulty_fsrs ?? 5,
    elapsed_days: Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / 86400000)),
    scheduled_days: Math.max(0, Math.floor((due.getTime() - lastReview.getTime()) / 86400000)),
    learning_steps: 0,
    reps: review.repetitions ?? 0,
    lapses: review.lapses ?? 0,
    state: (review.fsrs_state ?? State.New) as State,
    last_review: lastReview,
  }
}

// 試験日クリップ（§7.3）。
// FSRS が出した次回復習日(due)を、試験日を越えない範囲に丸める。
// - interval = min(interval, 試験日までの残日数)：試験後に復習予定が漏れるのを防ぐ
// - 直前期テーパー：残28日以内→間隔上限14日 / 残14日以内→間隔上限7日
//   （直前に間隔が開きすぎて忘れるのを防ぐ）
// examDate 未指定・試験日を過ぎている場合は素通し（現行挙動を維持）。
export function clipDueToExam(due: string, eventDate: string, examDate?: string | null): string {
  if (!examDate) return due
  const daysToExam = diffDays(eventDate, examDate)
  if (daysToExam <= 0) return due // 試験日当日/経過後はクリップしない
  const interval = diffDays(eventDate, due)
  if (interval <= 0) return due
  let maxInterval = daysToExam
  if (daysToExam <= 14) maxInterval = Math.min(maxInterval, 7)
  else if (daysToExam <= 28) maxInterval = Math.min(maxInterval, 14)
  const clipped = Math.min(interval, maxInterval)
  return clipped >= interval ? due : addDaysStr(eventDate, clipped)
}

// eventDate = 実施日（過去日でもよい）。未指定なら今日。
// examDate を渡すと due を試験日クリップする（§7.3）。
export function calcFSRS(
  current: Partial<Review> | null,
  status: Status,
  eventDate?: string,
  examDate?: string | null,
) {
  if (status === '未着手') return {}
  // 実施日未指定なら JST基準の「今日」を使う（UTC日付ズレ防止）
  const eDate = eventDate ?? todayJST()
  // S（完璧に理解・復習不要）: 通常の復習キューからは外し、試験前の最終確認だけ残す。
  // stability 等の FSRS 値は現状のまま温存するので、後で復習に戻す（due_date 再設定）／
  // A・B・C で再採点したときに、それまでの学習履歴を失わずスケジューリングを再開できる。
  if (status === 'S') return { due_date: finalCheckDue(eDate, examDate), last_reviewed: eDate }
  const rating = RATING_MAP[status]
  const now = dateAtUTCNoon(eDate)
  const card = current && (current.repetitions ?? 0) > 0
    ? toFSRSCard(current, now)
    : createEmptyCard(now)
  const newCard = schedulerFor(retentionFor(eDate, examDate)).repeat(card, now)[rating].card
  const rawDue = newCard.due.toISOString().split('T')[0]
  return {
    stability: newCard.stability,
    difficulty_fsrs: newCard.difficulty,
    repetitions: newCard.reps,
    lapses: newCard.lapses,
    due_date: clipDueToExam(rawDue, eDate, examDate),
    last_reviewed: eDate,
    fsrs_state: newCard.state,
  }
}

// review_history を実施日順に再生し、FSRS・初回/実施日・ステータスを一括導出する。
// 記録・取消のどちらでも履歴と各フィールドが常に一致する。
// examDate を渡すと各ステップの due を試験日クリップする（§7.3）。
export function deriveFromHistory(history: ReviewHistoryEntry[], examDate?: string | null) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  let acc: Partial<Review> = {
    stability: 0, difficulty_fsrs: 5, repetitions: 0, lapses: 0,
    due_date: null, last_reviewed: null, fsrs_state: State.New,
  }
  for (const e of sorted) {
    acc = { ...acc, ...calcFSRS(acc, e.status, e.date, examDate) }
  }
  return {
    stability: acc.stability ?? 0,
    difficulty_fsrs: acc.difficulty_fsrs ?? 5,
    repetitions: acc.repetitions ?? 0,
    lapses: acc.lapses ?? 0,
    due_date: acc.due_date ?? null,
    fsrs_state: acc.fsrs_state ?? State.New,
    review_history: sorted,
    first_reviewed: sorted.length ? sorted[0].date : null,
    last_reviewed: sorted.length ? sorted[sorted.length - 1].date : null,
    status: (sorted.length ? sorted[sorted.length - 1].status : '未着手') as Status,
  }
}

// 現在の想起確率 R（0..1）。復習キューの価値・リスク帯の算定に使う（reviewPlan.ts）。
// FSRS の忘却曲線から「今この瞬間まだ正解できる確率」を求める。
// 対象外（未学習=repetitions 0／S 等で due_date 無し）は null を返す。
export function retrievability(review: Partial<Review> | null | undefined, today?: string): number | null {
  if (!review || (review.repetitions ?? 0) <= 0) return null
  if (!review.due_date) return null
  const now = dateAtUTCNoon(today ?? todayJST())
  // get_retrievability は忘却曲線そのもので request_retention に依存しないため、
  // どのインスタンスで呼んでも同じ値になる。
  const r = schedulerFor(RETENTION_DEFAULT).get_retrievability(toFSRSCard(review, now), now, false)
  return typeof r === 'number' ? r : null
}

export function defaultReview(questionId: string): Review {
  return {
    question_id: questionId, status: '未着手',
    stability: 0, difficulty_fsrs: 5,
    due_date: null, repetitions: 0, lapses: 0,
    last_reviewed: null, fsrs_state: State.New,
    tags: [], memo: '',
    review_history: [], first_reviewed: null,
  }
}
