// 起動時に本文を先取りする肢の選定（licensehub-expansion.md §5）。純関数。
//
//   ① 今日〜14日先の復習対象（期限切れ＝今日やる分も含む）
//   ② 現在の学習科目の未着手の先頭200件
//
// 電車・会社など電波の弱い場所で、今日〜2週間ぶんの復習と次に進む肢が開けるようにする。
import type { Review } from '../../domain/types'
import { parseItemId } from '../../domain/license'
import { addDaysStr } from '../date'

export const PREFETCH_HORIZON_DAYS = 14
export const PREFETCH_UNSTARTED_LIMIT = 200

function isUnstarted(r: Review | undefined): boolean {
  return !r || (r.status === '未着手' && (r.review_history?.length ?? 0) === 0)
}

export function prefetchTargets(
  reviews: Record<string, Review>,
  subjectItemIds: string[],
  today: string,
  horizonDays = PREFETCH_HORIZON_DAYS,
  unstartedLimit = PREFETCH_UNSTARTED_LIMIT,
): string[] {
  const until = addDaysStr(today, horizonDays)
  const due = Object.values(reviews)
    .filter(r => !!r.due_date && r.due_date.slice(0, 10) <= until && parseItemId(r.question_id) !== null)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .map(r => r.question_id)
  const unstarted = subjectItemIds
    .filter(id => parseItemId(id) !== null && isUnstarted(reviews[id]))
    .slice(0, unstartedLimit)
  return [...new Set([...due, ...unstarted])]
}
