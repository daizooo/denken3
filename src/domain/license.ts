// 社労士のテキスト問題（lic_questions / lic_items）の型と、肢IDの生成・パース（licensehub-expansion.md §4.2・§4.4）。
// DB の行は supabase/migrations/022_lic_questions_items.sql と1対1に対応させる。
//
// ID 規約（§4.2）:
//   択一式の問   {年度}_T_{科目}_{問}        例 R08_T_RK_03
//   択一式の肢   {年度}_T_{科目}_{問}_{肢}   例 R08_T_RK_03_C
//   選択式の問   {年度}_S_{科目}             例 R08_S_RK（1科目＝1問）
//   選択式の空欄 {年度}_S_{科目}_{空欄}      例 R08_S_RK_A
//   年度は元号+2桁（H29〜R08）、科目は採点科目コード（英大文字2字）、問は2桁ゼロ埋め。

export type LicFormat = 'taku' | 'sentaku'
export type LicSource = 'honshiken' | 'ippon'
export type TruthSource = 'book' | 'derived' | 'manual'
export type ExplanationSource = 'book' | 'ai' | 'none'
export type LawStatus = 'ok' | 'unchecked' | 'review' | 'excluded'
export type Importance = 'A' | 'B' | 'C'
export type ItemLabel = 'A' | 'B' | 'C' | 'D' | 'E'

export const ITEM_LABELS: readonly ItemLabel[] = ['A', 'B', 'C', 'D', 'E']

// 正答（lic_questions.answer_spec）。correct は選択肢の番号（1〜5 = A〜E / ア〜オ）。
export type AnswerSpec =
  | { kind: 'one'; direction: 'wrong' | 'right'; correct: number; accepted?: number[] }   // 誤っている／正しいものを1つ選べ
                                                                     // accepted: 問題誤りの公表で複数を正解とした問の正答の全部（correct を含む）
  | { kind: 'combo'; correct: number }                               // 組合せ
  | { kind: 'count'; correct: number }                               // 個数
  | { kind: 'marks'; correct: number }                               // 各肢に ○× を付けた組合せ（肢は2〜5。R6 労基 問2 はア〜ウの3肢）
  | {
      kind: 'sentaku'
      blanks: Partial<Record<ItemLabel, number>>                     // 空欄 → 語群の番号
      wordbank: Record<string, string>                               // 語群の番号 → 語句
      groups?: Partial<Record<ItemLabel, number[]>>                  // 空欄ごとに語群が分かれる年度（R8）: 空欄 → 選べる語群の番号
    }

export interface LicQuestionRow {
  user_id: string
  id: string
  year: string
  format: LicFormat
  scored_subject: string
  study_subject: string
  q_no: number | null
  stem: string | null
  answer_spec: AnswerSpec | null
  source: LicSource
  holdout_group: string | null
  updated_at: string | null
}

export interface LicItemRow {
  user_id: string
  id: string
  question_id: string
  label: ItemLabel
  label_raw: string | null
  statement: string
  origin_statement: string | null
  truth: boolean | null
  truth_source: TruthSource
  explanation: string | null
  explanation_source: ExplanationSource
  explanation_verified: boolean
  topic_id: string | null
  importance: Importance | null
  law_status: LawStatus
  law_note: string | null
  study_subject: string
  scored_subject: string
  updated_at: string | null
}

// ---------------------------------------------------------------------------
// 肢ラベルの正規化

const KANA_LABELS: Record<string, ItemLabel> = { 'ア': 'A', 'イ': 'B', 'ウ': 'C', 'エ': 'D', 'オ': 'E' }

// ア〜オ・A〜E（全角・小文字を含む）を A〜E に正規化する。それ以外は null。
export function normalizeLabel(raw: string): ItemLabel | null {
  const s = raw.trim()
  if (s in KANA_LABELS) return KANA_LABELS[s]
  // 全角英字 → 半角
  const half = s.replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase()
  return (ITEM_LABELS as readonly string[]).includes(half) ? (half as ItemLabel) : null
}

// ---------------------------------------------------------------------------
// ID の生成とパース

const YEAR_RE = /^[HR]\d{2}$/
const SUBJECT_RE = /^[A-Z]{2}$/
const FORMAT_CODE: Record<LicFormat, 'T' | 'S'> = { taku: 'T', sentaku: 'S' }

export interface QuestionCoord {
  year: string            // 'R08'
  format: LicFormat
  scoredSubject: string   // 'RK'
  qNo: number | null      // 択一式は 1〜99、選択式は null
}

export interface ItemCoord extends QuestionCoord {
  label: ItemLabel
}

// 年度の表記（元号+2桁）。formatYear('R', 8) → 'R08'
export function formatYear(era: 'H' | 'R', n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error(`年度が不正です: ${era}${n}`)
  return `${era}${String(n).padStart(2, '0')}`
}

function assertCoord(c: QuestionCoord): void {
  if (!YEAR_RE.test(c.year)) throw new Error(`年度が不正です: ${c.year}`)
  if (!SUBJECT_RE.test(c.scoredSubject)) throw new Error(`科目コードが不正です: ${c.scoredSubject}`)
  if (c.format === 'taku') {
    if (c.qNo == null || !Number.isInteger(c.qNo) || c.qNo < 1 || c.qNo > 99) {
      throw new Error(`問番号が不正です: ${c.qNo}`)
    }
  } else if (c.qNo != null) {
    throw new Error('選択式は問番号を持ちません')
  }
}

export function makeQuestionId(c: QuestionCoord): string {
  assertCoord(c)
  const base = `${c.year}_${FORMAT_CODE[c.format]}_${c.scoredSubject}`
  return c.format === 'taku' ? `${base}_${String(c.qNo).padStart(2, '0')}` : base
}

// label は ア〜オ・A〜E のどちらでも受け付け、A〜E に正規化する。
export function makeItemId(c: QuestionCoord & { label: string }): string {
  const label = normalizeLabel(c.label)
  if (!label) throw new Error(`肢ラベルが不正です: ${c.label}`)
  return `${makeQuestionId(c)}_${label}`
}

const QUESTION_ID_RE = /^([HR]\d{2})_(?:T_([A-Z]{2})_(\d{2})|S_([A-Z]{2}))$/
const ITEM_ID_RE = /^([HR]\d{2})_(?:T_([A-Z]{2})_(\d{2})|S_([A-Z]{2}))_([A-E])$/

function toCoord(m: RegExpMatchArray): QuestionCoord | null {
  const [, year, takuSubject, qNo, sentakuSubject] = m
  if (takuSubject) {
    const n = Number(qNo)
    return n >= 1 ? { year, format: 'taku', scoredSubject: takuSubject, qNo: n } : null
  }
  return { year, format: 'sentaku', scoredSubject: sentakuSubject, qNo: null }
}

export function parseQuestionId(id: string): QuestionCoord | null {
  const m = id.match(QUESTION_ID_RE)
  return m ? toCoord(m) : null
}

export function parseItemId(id: string): ItemCoord | null {
  const m = id.match(ITEM_ID_RE)
  if (!m) return null
  const coord = toCoord(m)
  return coord ? { ...coord, label: m[5] as ItemLabel } : null
}

// 肢ID → 親の問ID。肢IDとして不正なら null。
export function questionIdOfItem(itemId: string): string | null {
  const c = parseItemId(itemId)
  return c ? makeQuestionId(c) : null
}
