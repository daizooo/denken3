// 採用した w[] で、そのユーザーの全カードのスケジュールを引き直す。純関数。
//
// ■ なぜ「履歴に版を刻む」形にするのか
// 単に新しい w で計算し直すだけだと、次に誰かが deriveFromHistory を回したとき
// （＝記録・取消・再読込のたび）に、履歴には版が書かれていないので既定パラメータへ
// 戻ってしまい、DBの予定日と再生結果が食い違う。まさに prev スナップショットで
// 起きていた不整合（migration 017）と同じ形になる。
//
// そこで再計算では、各履歴エントリへ採用した版を **書き込んでから** 再生する。
// こうすると「この記録は版Nのパラメータでスケジュールされている」が履歴自身に残り、
// 以後どの経路から再生しても同じ予定日になる。
//
// 過去に画面へ出ていた予定日はこの操作で書き換わる。それは利用者が最適化を明示的に
// 採用したときにだけ起きる、版番号の付いた1回の変更であって、毎日勝手に動くのとは違う。

import type { Review, ReviewHistoryEntry } from '../../src/domain/types.js'
import { deriveFromHistory, registerParams, resetParams, retentionFor } from '../../src/lib/fsrs.js'

export interface RescheduleRow {
  question_id: string
  review_history: ReviewHistoryEntry[] | null
}

/** denken_reviews へ upsert する行（変更するフィールドだけ）。 */
export interface RescheduledRow {
  user_id: string
  exam_id: string
  question_id: string
  status: Review['status']
  stability: number
  difficulty_fsrs: number
  repetitions: number
  lapses: number
  due_date: string | null
  last_reviewed: string | null
  fsrs_state: number
  review_history: ReviewHistoryEntry[]
  first_reviewed: string | null
}

export function reschedule(params: {
  rows: RescheduleRow[]
  userId: string
  examId: string
  examDate: string | null
  version: number
  w: number[]
}): RescheduledRow[] {
  const { rows, userId, examId, examDate, version, w } = params
  // サーバレスのコンテナは暖まったまま別の利用者・別の資格のリクエストを続けて処理する。
  // 版番号は (user_id, exam_id) ごとに1から振られるので、前の呼び出しの登録が残っていると
  // 同じ番号で別の w を引きうる。呼び出しごとに登録簿を作り直して切り離す。
  resetParams()
  registerParams({ version, w })

  const out: RescheduledRow[] = []
  for (const row of rows) {
    const history = Array.isArray(row.review_history) ? row.review_history : []
    if (history.length === 0) continue
    // 各エントリへ採用版を刻む。変えるのは w[] だけ。
    // 保持率は、記録時の値があればそれを、無ければ**再生が使っていたのと同じ従来式の値**を
    // 明示的に書き込む。ここで既定値（0 など）を入れると保持率まで書き換わってしまう。
    const stamped = history.map<ReviewHistoryEntry>(e => ({
      ...e,
      policy: {
        retention: e.policy?.retention ?? retentionFor(e.date, examDate),
        w_version: version,
      },
    }))
    const derived = deriveFromHistory(stamped, examDate)
    out.push({
      user_id: userId,
      exam_id: examId,
      question_id: row.question_id,
      status: derived.status,
      stability: derived.stability,
      difficulty_fsrs: derived.difficulty_fsrs,
      repetitions: derived.repetitions,
      lapses: derived.lapses,
      due_date: derived.due_date,
      last_reviewed: derived.last_reviewed,
      fsrs_state: derived.fsrs_state,
      review_history: derived.review_history,
      first_reviewed: derived.first_reviewed,
    })
  }
  return out
}
