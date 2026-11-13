// 2級建設業経理士の解答欄・正答の型（docs/design/kenkei2.md §5）。型だけ（実行時の依存なし）。
// frame（解答欄の定義）と key（正答）は DB の JSONB に入る。画面・採点・取り込みが同じ型を使う。

/** 仕訳の1行。symbol は勘定科目群の記号（A〜X）。 */
export interface JournalLine { symbol: string; amount: number }

/** 仕訳1組の正答。借方・貸方とも複数行あり。 */
export interface JournalKey { debit: JournalLine[]; credit: JournalLine[] }

/** 画面から来る生の入力（未入力は空文字）。 */
export interface JournalInputLine { symbol: string; amount: string }
export interface JournalInput { debit: JournalInputLine[]; credit: JournalInputLine[] }

/**
 * 採点マス1つ。金額（amount）・記号（symbol）・文字（text。第34回の「当期（純利益）」の見出しなど）。
 * group が同じマスは「全部正解で初めて得点」（差異の「金額＋有利/不利の記号」など）。
 */
export interface Cell {
  id: string
  kind: 'amount' | 'symbol' | 'text'
  expected: number | string
  points: number
  group?: string
}

/** 精算表の1行。adj は整理記入の借方・貸方（1つのマスに複数の金額が並ぶので配列）。空は 0 / []。 */
export interface SettlementRow {
  name: string
  tb: [number, number]
  adj: [number[], number[]]
  pl: [number, number]
  bs: [number, number]
}
