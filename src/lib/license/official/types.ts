// 公式PDF（本試験）の構造化データの型（licensehub-expansion.md §4.2・§4.4・§13・PR-D）。
// 抽出テキスト → この形（中間JSON。--dump-json で書き出し、手で直して --json で読み戻せる）→ 検証ゲート → DB 行。
import type { ItemLabel } from '../../../domain/license.ts'

export type TakuKind = 'one' | 'combo' | 'count'
export type Direction = 'wrong' | 'right'

export interface OfficialTakuItem {
  labelRaw: string        // PDF の表記（'A' / 'ア'）。全角は半角に直す
  label: ItemLabel        // A〜E
  text: string
}

// 択一式の1問
export interface OfficialTakuQuestion {
  scoredSubject: string   // 'RK'
  qNo: number             // 科目内の問番号 1〜10
  kind: TakuKind | null   // 問型（判定できなければ null → ゲートで失敗）
  direction: Direction | null
  lead: string            // 問の文（肢より前）
  items: OfficialTakuItem[]
  choices: string[]       // 組合せ・個数の選択肢 A〜E の表記（'アとイ' / '三つ'）。1つ選ぶ問は []
  comboPairs: ItemLabel[][] | null   // 組合せ: 選択肢 → 肢（A〜E に正規化）
  countOptions: number[] | null      // 個数: 選択肢 → 個数
}

// 選択式の1問（1科目）
export interface OfficialSentakuQuestion {
  scoredSubject: string   // 'RK'
  stem: string            // 空欄を ［A］ の形にした本文
  blanks: ItemLabel[]     // 本文に現れた順の空欄
  wordbank: Record<string, string>   // 語群の番号（'1'〜'20'）→ 語句
  // 空欄ごとに語群が分かれる書式（「Ａ ①… ④…」）: 空欄 → その空欄の語群（wordbank の通し番号。正答表の ①〜④ はこの順の位置）
  groups?: Partial<Record<ItemLabel, number[]>>
}

// 正答。択一は科目 → 問1〜10 の選択肢（null は読めなかった）、選択式は科目 → 空欄 → 語群の番号。
export interface OfficialAnswers {
  taku: Record<string, (ItemLabel | null)[]>
  sentaku: Record<string, Partial<Record<ItemLabel, number | null>>>
}

// 問題誤りの公表などによる補正（R6。利用者の判断で書く。§13）。
//   excluded: 出題から外す（肢は law_status='excluded'、正答が読めなくてもゲートを通す）
//   correct:  公表どおりの正答に置き換える（択一は 'A'〜'E'）
//   multi:    公表で複数の選択肢を正解とした択一の「1つ選ぶ」問（correct: ['C', 'D']。先頭を本来の正答とする）
export interface OfficialCorrection {
  action: 'excluded' | 'correct' | 'multi'
  correct?: string | string[]
  note: string
}

export interface OfficialCorrections {
  studySplit?: Partial<Record<string, number>>            // 択一の分割位置の上書き（{ IP: 5 }）
  questions?: Record<string, OfficialCorrection>          // 問ID（'R06_T_KY_05'）→ 補正
}

// 1年度ぶんの構造化データ（中間JSON）
export interface OfficialYear {
  year: string                                  // 'R08'
  taku: OfficialTakuQuestion[] | null           // 未提供は null
  sentaku: OfficialSentakuQuestion[] | null
  answers: OfficialAnswers | null
}

// 抽出・ゲートの指摘。error はゲートの失敗（その式の年度ごと保存しない）、warning は保存するが一覧に出す。
export interface OfficialIssue {
  level: 'error' | 'warning'
  where: string           // 'R08 択一 RK 問3' など
  reason: string
}
