// 解答試行の観測値（docs/design/calculation-active-learning.md §3.2）。すべて純関数。
//
// 「解答を見る前に、選択肢を1つ確定させる」ことで得られる生の事実だけを持つ。
// 判断・採点・スコアリングはここに含めない（それらは status と FSRS 側の役目）。
//
// 保存先は denken_reviews.review_history（JSONB）のエントリに同梱するため、
// DBスキーマの変更は不要。旧エントリには存在しないので、読む側は常に optional として扱う。

/** 選択肢の番号（電験は本試験・分野別ともに5択）。 */
export const CHOICES = [1, 2, 3, 4, 5] as const

export interface Attempt {
  /**
   * 選んだ選択肢（1..5）。B問題は [(a), (b)] の2要素。未選択の要素は 0。
   * 分野別（MasterQuestion）は正答データを持たないため現時点では採点に使わないが、
   * 記録しておくことで、後から正答が判明すれば遡って採点できる（設計 §6）。
   */
  selected?: number[]
  /** 「わからない」で解答を開いたか。true のとき理解度は C を自動記録する。 */
  gaveUp?: boolean
}

/** 小問数ぶんの未選択配列。 */
export function emptySelection(partCount: number): number[] {
  return Array.from({ length: Math.max(1, partCount) }, () => 0)
}

/** すべての小問を選び終えたか。「解答を見る」の活性条件。 */
export function isComplete(selected: number[]): boolean {
  return selected.length > 0 && selected.every(v => v > 0)
}

/** 記録に残す価値がある試行か（未選択のまま閉じた等は残さない）。 */
export function isMeaningful(a: Attempt | undefined): a is Attempt {
  return !!a && (a.gaveUp === true || (a.selected?.some(v => v > 0) ?? false))
}

// 履歴チップ用の丸数字。行を増やさずに選択を1文字で示す（設計 §2.7）。
const CIRCLED = ['⓪', '①', '②', '③', '④', '⑤']

/** [3] → '③' / [3,1] → '③①' / 未選択のみ → '' */
export function formatSelected(selected: number[] | undefined): string {
  if (!selected) return ''
  return selected.map(v => CIRCLED[v] ?? '').join('')
}
