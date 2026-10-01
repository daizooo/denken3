// 復習の先読み（review-schedule-realism.md §3-2）。すべて純関数。
//
// 担当は2つだけ ――
//   forecastLoad … 今日から数日先まで、「予定どおりにやった場合」の1日あたりの件数を出す
//   requiredPace … 試験までに必要な 問/日（溜まり＋試験までの復習＋未着手の着手と再復習）
//
// **時間も実績ペースも使わない（2026-10-01 決定）。** 利用者が消化できるかどうかに関わらず、
// 合格に必要なラインをそのまま出す。実績で能力を決めると、消化できなかった分だけ予定が
// 軽く見えて要求が下がる。ここでは能力の上限をかけず、期限が来たものは全部その日に数える。
//
// 先の予定は DB に入っている次回予定日の集計ではなく、各カードを `calcFSRS` で前へ進めて出す
// （頭打ち・試験日の地平も同じ関数が適用する）。これで次の2つが入る:
//   ① 消化したあとに発生する再復習
//   ② これから着手する未着手の復習（1回目のあとに続く再演習）
//
// 成功の仮定は B（Good）に固定する。A（Easy）で進めるより間隔が短く、復習が多めに出る側＝
// 「不確実性はもっとやる側へ」（policy.ts 冒頭の原則）。

import type { Review } from '../domain/types'
import { LAST_REVIEW_LEAD_DAYS, calcFSRS } from './fsrs'
import { addDaysStr, diffDays } from './date'

export const FORECAST_DAYS = 14

// 未着手1問が A に届くまでの再演習の間隔（日）。1回目の着手から数える。
// 先頭から `attemptsPerMastery - 1` 個を使う。
export const FOLLOW_UP_OFFSETS = [1, 3, 7, 14, 28]

// 暗記に近い再演習を、試験前の最終確認として1回足す（A になったあとの維持ぶん）。
const FINAL_REVIEWS_PER_NEW = 1

// 1枚のカードを前へ進める回数の上限（無限ループ防止。頭打ちがあるので実際は数回）。
const MAX_STEPS = 20

type Card = Partial<Review>

function wVersionOf(r: Card): number | undefined {
  const h = r.review_history
  return h?.length ? h[h.length - 1].policy?.w_version : undefined
}

// 期限が来たカードを、その日に B（Good）で復習したとして1回進める。
function advance(card: Card, date: string, examDate: string | null): Card {
  const next = calcFSRS(card, 'B', date, examDate, undefined, wVersionOf(card))
  return { ...card, ...next, review_history: card.review_history }
}

export interface ForecastDay {
  date: string
  /** 期限が来たカードの復習。今日の分には期限超過（溜まり）がすべて入る。 */
  reviews: number
  /** この日に着手する未着手。 */
  newStarts: number
  /** 着手済みの未着手の再演習（1回目の次以降）。 */
  followUps: number
  total: number
}

export interface ForecastInput {
  /** 着手済みのカード（due_date を持つもの）。 */
  cards: Review[]
  /** まだ着手していない問題数。 */
  unstarted: number
  /** 1日に着手する数（policy.requiredPaceQ を切り上げた値など）。 */
  newPerDay: number
  /** 1問が A に届くまでの演習回数（policy.attemptsPerMastery）。 */
  attemptsPerMastery: number
  today: string
  examDate: string | null
  days?: number
}

export function forecastLoad(input: ForecastInput): ForecastDay[] {
  const { cards, today, examDate, newPerDay, attemptsPerMastery } = input
  const days = input.days ?? FORECAST_DAYS
  const followCount = Math.max(0, Math.round(attemptsPerMastery) - 1)

  // 日付 → その日に期限が来るカード。今日より前（溜まり）は今日へ寄せる。
  const byDate = new Map<string, Card[]>()
  const put = (date: string, card: Card) => {
    const key = date < today ? today : date
    const list = byDate.get(key)
    if (list) list.push(card); else byDate.set(key, [card])
  }
  for (const r of cards) if (r.due_date) put(r.due_date, r)

  const followByDate = new Map<string, number>()
  let unstarted = input.unstarted
  const out: ForecastDay[] = []

  for (let i = 0; i < days; i++) {
    const date = addDaysStr(today, i)
    const due = byDate.get(date) ?? []
    for (const card of due) {
      const next = advance(card, date, examDate)
      // 同じ窓の中にもう一度期限が来るもの（Cのような短い間隔）は、その日へ積み直す。
      if (next.due_date && next.due_date > date) put(next.due_date, next)
    }

    const newStarts = Math.min(unstarted, Math.max(0, newPerDay))
    unstarted -= newStarts
    for (let k = 0; k < followCount; k++) {
      const key = addDaysStr(date, FOLLOW_UP_OFFSETS[Math.min(k, FOLLOW_UP_OFFSETS.length - 1)])
      followByDate.set(key, (followByDate.get(key) ?? 0) + newStarts)
    }
    const followUps = followByDate.get(date) ?? 0

    out.push({ date, reviews: due.length, newStarts, followUps, total: due.length + newStarts + followUps })
  }
  return out
}

export interface RequiredPace {
  /** 試験までにやる総回数（溜まり＋試験までの復習＋未着手の着手と再演習＋最終確認）。 */
  total: number
  /** 数える日数（今日〜試験前日）。 */
  days: number
  /** 必要ペース（問/日）。実績には依存しない。 */
  perDay: number
  backlog: number
  scheduledReviews: number
  newWork: number
}

export function requiredPace(input: {
  cards: Review[]
  unstarted: number
  attemptsPerMastery: number
  today: string
  examDate: string | null
}): RequiredPace {
  const { cards, unstarted, attemptsPerMastery, today, examDate } = input
  // 試験日が無いときは数える地平が無い。呼び出し側は表示しない前提で 0 を返す。
  if (!examDate) {
    return { total: 0, days: 0, perDay: 0, backlog: 0, scheduledReviews: 0, newWork: 0 }
  }
  const lastDay = addDaysStr(examDate, -LAST_REVIEW_LEAD_DAYS)
  const days = Math.max(1, diffDays(today, lastDay) + 1)

  let backlog = 0
  let scheduled = 0
  for (const r of cards) {
    if (!r.due_date) continue
    let card: Card = r
    let date = r.due_date < today ? today : r.due_date
    if (r.due_date <= today) backlog++
    for (let step = 0; step < MAX_STEPS && date <= lastDay; step++) {
      scheduled++
      const next = advance(card, date, examDate)
      if (!next.due_date || next.due_date <= date) break
      card = next
      date = next.due_date
    }
  }
  // 溜まりは scheduled に1回ずつ含まれている（today へ寄せて数えた）ので、内訳としてだけ別に返す。
  const newWork = Math.round(unstarted * (Math.max(1, attemptsPerMastery) + FINAL_REVIEWS_PER_NEW))
  const total = scheduled + newWork
  return { total, days, perDay: total / days, backlog, scheduledReviews: scheduled, newWork }
}
