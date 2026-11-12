// 2級建設業経理士の演習の記録（denken_reviews に exam_id='kenkei2'）。社労士・1級土木の画面・集計には混ぜない。
// 記録の純関数（FSRS 再生・取り消し）は1級土木と同じものを使う（重複実装しない）。
import type { Attempt, Confidence } from '../attempt.ts'

export { recordAnswer, statusOfAttempt, undoLast } from '../doboku1/record.ts'

export const KENKEI2_EXAM_ID = 'kenkei2'

/** 精算表のように満点が厳しい設問で「正解」とみなす得点率（docs/design/kenkei2.md §4.2。要調整）。 */
export const SETTLEMENT_PASS_RATE = 0.8

/**
 * 採点結果から Attempt を作る。passRate 以上の得点率を「正解」とする（既定は満点のみ）。
 * 「わからない」は降参（理解度 C）。確信は未申告なら付けない（正解でも B に倒れる）。
 */
export function scoredAttempt(
  rate: number, confidence: Confidence | undefined, opts: { passRate?: number; gaveUp?: boolean } = {},
): Attempt {
  if (opts.gaveUp) return { gaveUp: true, correct: false }
  const passRate = opts.passRate ?? 1
  return { ...(confidence ? { confidence } : {}), correct: rate >= passRate }
}
