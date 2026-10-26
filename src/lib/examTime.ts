// 本番の1問（択一式の肢・選択式の空欄）あたりの持ち時間。
// 「速い/遅い」の判定基準に使う（study-time-scarcity.md 課題12）。
//
// 従来は「同難易度帯の中央値超え」で遅いと判定していたが、中央値は定義上つねに約半数を
// 「遅い」側に落とすため、本番の時間に収まっていても警告が出ていた。
// 表示文言が元々意図していた「本番で失点しやすい」に実装を合わせる。
//
// 試験時間からの逆算（licensehub-expansion.md §4.3）。見直しに全体の1割を残して割る:
//   択一式: 210分・70問（1問5肢）→ 210×0.9÷70÷5 ≒ 32秒 / 肢
//   選択式:  80分・8科目×5空欄 = 40空欄 → 80×0.9÷40 = 108秒 / 空欄
// 肢は「問題文を読んで○×を決める」までの時間で、解説を読む時間は含まない
// （記録は解答の確定時に行うため、計測もそこまで）。
import { parseItemId } from '../domain/license'

export const TAKU_ITEM_LIMIT_SECONDS = 32
export const SENTAKU_BLANK_LIMIT_SECONDS = 108

// 問題ID（肢ID・空欄ID）から持ち時間を返す。読めないIDは、数の多い択一式の肢として扱う。
export function examTimeLimitSeconds(id: string): number {
  return parseItemId(id)?.format === 'sentaku' ? SENTAKU_BLANK_LIMIT_SECONDS : TAKU_ITEM_LIMIT_SECONDS
}
