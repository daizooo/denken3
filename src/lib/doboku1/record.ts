// 1級土木の演習の記録（denken_reviews に exam_id='doboku1'）。社労士の画面・集計には混ぜない（docs/design/doboku1-ichiji.md）。
// 理解度の写像は社労士の肢モードと同じ（正解×確信=A、正解×迷い=B、不正解・分からない=C）。すべて純関数。
import type { Attempt, Confidence } from '../attempt'
import type { Review, ReviewHistoryEntry } from '../../domain/types'
import { defaultReview, deriveFromHistory, retentionFor } from '../fsrs'
import { statusFromAttempt, type ItemStatus } from '../license/attempt'

export const DOBOKU1_EXAM_ID = 'doboku1'

/** 四肢択一の解答（choice は 1〜4。null は「分からない」）。 */
export function choiceAttempt(choice: number | null, confidence: Confidence | undefined, correct: number): Attempt {
  if (choice === null) return { gaveUp: true, correct: false }
  return { selected: [choice], ...(confidence ? { confidence } : {}), correct: choice === correct }
}

export function statusOfAttempt(a: Attempt): ItemStatus {
  return statusFromAttempt(a.correct === true, a.confidence, a.gaveUp === true)
}

/** 1回の解答を履歴に足し、FSRS を再生した Review を返す（試験日は未設定＝クリップしない）。 */
export function recordAnswer(current: Review | undefined, questionId: string, attempt: Attempt, date: string): Review {
  const base = current ?? defaultReview(questionId)
  const entry: ReviewHistoryEntry = {
    date,
    status: statusOfAttempt(attempt),
    attempt,
    policy: { retention: retentionFor(date, null) },
  }
  return { ...base, ...deriveFromHistory([...(base.review_history ?? []), entry], null) }
}

/** 直近の記録を1件取り消す（誤タップの修正）。 */
export function undoLast(current: Review): Review {
  const h = current.review_history.slice(0, -1)
  return { ...current, ...deriveFromHistory(h, null) }
}
