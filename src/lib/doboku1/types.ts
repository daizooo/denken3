// 1級土木施工管理技士 第一次検定の問題データ（docs/design/doboku1-ichiji.md §5・§6.5）。
// 社労士の lic_* とは別テーブル（denken3.dbk_questions）に持ち、社労士の画面・集計に混ざらないようにする。
// FSRS のカード単位は「問」（四肢択一を1問まるごと解く）。肢ごとの ○× は解説の「肢チェック」で示す。

/** 試験問題A（午前）／B（午後）。 */
export type Paper = 'A' | 'B'

/**
 * 問の形式。
 * - single:     4つの記述から適当な（でない）ものを1つ選ぶ。肢ごとの ○× を導出できる
 * - statements: ①〜④の記述のうち適当なものの組合せ（選択肢は ①② などの組）。①〜④の ○× を導出できる
 * - fill:       文章の空欄（イ〜ニ）に当てはまる語句の組合せ
 * - calc:       式・数値・順序を選ぶ（図や式を伴うことが多い）
 */
export type QuestionKind = 'single' | 'statements' | 'fill' | 'calc'

/** 選べという向き。適当なもの・正しいもの＝right、適当でないもの＝wrong。組合せは right 扱い。 */
export type Direction = 'right' | 'wrong'

/** 抽出・構造化した1問（公式PDFが正本）。 */
export interface ParsedQuestion {
  paper: Paper
  no: number
  stem: string             // 問題文（空欄は ［イ］ の形）
  statements: string[]     // ①〜④（statements 形式のときだけ）
  choiceHeader: string[]   // 表形式の選択肢の見出し（例: イ・ロ・ハ・ニ）。無ければ空
  choices: string[][]      // ⑴〜⑷。表形式は列ごとに分割（1列なら要素1つ）
  direction: Direction
  kind: QuestionKind
  hasFigure: boolean       // 問題文が図を参照する（図は非公開ストレージに置く）
}

/** 選択解答のグループ（例: A の No.6〜20 から12問）。 */
export interface AnswerGroup {
  paper: Paper
  from: number
  to: number
  answerCount: number      // 解答する問数（必須なら to-from+1）
  required: boolean
  label: string            // '土木一般（選択）' など
}

/** 図解解説の部品（§6.5。初学者向けにシンプルに）。 */
export type ExplainFigure =
  | { type: 'rule'; title: string; rows: { label: string; value: string; trap?: string }[] }
  | { type: 'flow'; title: string; steps: string[]; branches?: { from: number; label: string; to: string; bad?: boolean }[] }
  | { type: 'compare'; title: string; columns: string[]; rows: { label: string; cells: string[] }[] }
  | { type: 'svg'; title: string; svg: string; alt: string }

/** 問ごとの解説（dbk_questions.explain）。 */
export interface Explain {
  point: string                                           // 論点を1〜2文で
  figures: ExplainFigure[]                                 // 0〜2枚
  checks: { label: string; ok: boolean; note: string }[]   // 肢チェック（⑴〜⑷ または ①〜④）
  basis?: string                                           // 根拠（示方書・法令・約款など）
}

/** DB の1行（dbk_questions）。 */
export interface DbkQuestionRow {
  id: string               // 'D1_R08_A_01'
  year: string             // 'R08'
  paper: Paper
  q_no: number
  group_label: string
  required: boolean
  category: string         // 学習分野ID（src/data/doboku1 の DOBOKU1_CATEGORIES）
  topic: string            // 論点名（短い見出し）
  kind: QuestionKind
  direction: Direction
  stem: string
  statements: string[]
  choice_header: string[]
  choices: string[][]
  correct: number          // 1〜4（公式の正答肢）
  has_figure: boolean
  figure_path: string | null
  explain: Explain | null
  explain_verified: boolean
}
