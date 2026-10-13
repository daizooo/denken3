// 肢モード（一問一答）の自動採点と理解度の写像（licensehub-expansion.md §6.2）。すべて純関数。
//
// | 結果               | 理解度 | FSRS  |
// |--------------------|--------|-------|
// | 正解 かつ 確信     | A      | Easy  |
// | 正解 かつ 迷い     | B      | Good  |
// | 不正解 / 降参      | C      | Again |
//
// 理解度 → FSRS の評価は既存の fsrs.ts（A=Easy, B=Good, C=Again）がそのまま担う。
// ここは「解答の観測値 → 理解度」だけを決める。
import type { Attempt, Confidence } from '../attempt'

export type ItemStatus = 'A' | 'B' | 'C'

/** 肢の ○/× を Attempt.selected の値へ（[1]=○、[2]=×）。 */
export const SELECTED_TRUE = 1
export const SELECTED_FALSE = 2

/**
 * 正誤・確信・降参から理解度を決める。
 * 確信が未選択のまま正解した場合は B（迷い扱い）に倒す ―― 確信を自己申告していない正解を
 * Easy にすると、復習間隔が過大になる（不確実性は「もっとやる」側へ倒す）。
 */
export function statusFromAttempt(
  correct: boolean, confidence: Confidence | undefined, gaveUp: boolean,
): ItemStatus {
  if (gaveUp || !correct) return 'C'
  return confidence === 'sure' ? 'A' : 'B'
}

/** ○/× の解答が肢の truth と一致するか。 */
export function isCorrectAnswer(answerTrue: boolean, truth: boolean): boolean {
  return answerTrue === truth
}

/**
 * 記録に残す Attempt を組み立てる。correct は記録時点の正誤
 * （後で truth が直っても履歴は動かさない・§6.2）。
 */
export function itemAttempt(
  answerTrue: boolean | null, confidence: Confidence | undefined, gaveUp: boolean, truth: boolean,
): Attempt {
  if (gaveUp || answerTrue === null) return { gaveUp: true, correct: false }
  return {
    selected: [answerTrue ? SELECTED_TRUE : SELECTED_FALSE],
    ...(confidence ? { confidence } : {}),
    correct: isCorrectAnswer(answerTrue, truth),
  }
}
