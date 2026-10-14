// 公式PDFの科目の見出し・並び・問ごとの学習科目（licensehub-expansion.md §4.3・§13・§16・PR-D）。
//
// 科目コードと学習科目の対応は src/data/sharoushi の SHAROUSHI_SCORED_TO_STUDY が正本。
// ここでは PDF 上の見出し（科目名）の読み取りと、採点科目の中で問・空欄をどの学習科目に割り当てるか
// （労基/安衛、労災・雇用/徴収、労一/社一の分割位置）と、その検証に使う語だけを持つ。
import type { ItemLabel, LicFormat } from '../../../domain/license.ts'
import { SHAROUSHI_SCORED_TO_STUDY, SHAROUSHI_SCORING } from '../../../data/sharoushi/index.ts'

const section = (id: LicFormat) => SHAROUSHI_SCORING.sections.find(s => s.id === id)!

// PDF・正答表の科目の並び（ScoringModel の順）と、科目ごとの問数・空欄数
export const TAKU_ORDER: readonly string[] = section('taku').subjects.map(s => s.code)
export const SENTAKU_ORDER: readonly string[] = section('sentaku').subjects.map(s => s.code)
export const TAKU_QUESTIONS_PER_SUBJECT = section('taku').subjects[0].maxPoints     // 10
export const SENTAKU_BLANKS_PER_SUBJECT = section('sentaku').subjects[0].maxPoints  // 5

// 科目名（正式名・略称）→ 採点科目コード。長い名前から順に照合する。
// 「一般常識」は択一では IP（労一・社一の合算）、選択式では RI / SI に分かれる。
const NAMES: { name: string; taku?: string; sentaku?: string; heading?: boolean }[] = [
  { name: '労務管理その他の労働及び社会保険に関する一般常識', taku: 'IP', heading: true },
  { name: '労務管理その他の労働に関する一般常識', taku: 'IP', sentaku: 'RI', heading: true },
  { name: '社会保険に関する一般常識', taku: 'IP', sentaku: 'SI', heading: true },
  { name: '労働基準法及び労働安全衛生法', taku: 'RK', sentaku: 'RK', heading: true },
  { name: '労働者災害補償保険法', taku: 'RS', sentaku: 'RS', heading: true },
  { name: '雇用保険法', taku: 'KY', sentaku: 'KY', heading: true },
  { name: '健康保険法', taku: 'KH', sentaku: 'KH', heading: true },
  { name: '厚生年金保険法', taku: 'KO', sentaku: 'KO', heading: true },
  { name: '国民年金法', taku: 'KN', sentaku: 'KN', heading: true },
  { name: '労一・社一', taku: 'IP' },
  { name: '一般常識', taku: 'IP' },
  { name: '労基・安衛', taku: 'RK', sentaku: 'RK' },
  { name: '労基安衛', taku: 'RK', sentaku: 'RK' },
  { name: '労災', taku: 'RS', sentaku: 'RS' },
  { name: '雇用', taku: 'KY', sentaku: 'KY' },
  { name: '労一', taku: 'IP', sentaku: 'RI' },
  { name: '社一', taku: 'IP', sentaku: 'SI' },
  { name: '健保', taku: 'KH', sentaku: 'KH' },
  { name: '厚年', taku: 'KO', sentaku: 'KO' },
  { name: '国年', taku: 'KN', sentaku: 'KN' },
].sort((a, b) => b.name.length - a.name.length)

// 行頭の科目名を読む（正答表の行見出し用。略称も受け付ける）。rest は科目名より後ろ。
export function subjectAtLineStart(line: string, format: LicFormat): { code: string; rest: string } | null {
  for (const n of NAMES) {
    const code = n[format]
    if (code && line.startsWith(n.name)) return { code, rest: line.slice(n.name.length) }
  }
  return null
}

// 問題PDFの科目の見出し行か（正式名だけ。後ろに続けてよいのは括弧書きだけ。本文の行を見出しと誤認しないため）。
export function headingSubject(line: string, format: LicFormat): string | null {
  const l = line.replace(/\s+/g, '')
  for (const n of NAMES) {
    const code = n[format]
    if (!code || !n.heading || !l.startsWith(n.name)) continue
    const rest = l.slice(n.name.length)
    if (rest === '' || /^[（(][^（()）]*[）)]$/.test(rest)) return code
  }
  return null
}

// ---------------------------------------------------------------------------
// 問・空欄 → 学習科目
//
// 既定の分割位置（§4.3）: 労基・安衛は問1〜7が労基・問8〜10が安衛、労災・雇用は問8〜10が徴収法、
// 労一・社一（IP）は問1〜5が労一・問6〜10が社一。選択式の労基・安衛は空欄A〜Cが労基・D〜Eが安衛。
// 年度で違う場合は corrections の studySplit で上書きする（{ RK: 7 } = 問7までが前半の学習科目）。

export type StudySplit = Partial<Record<string, number>>

export const DEFAULT_TAKU_SPLIT: Record<string, number> = { RK: 7, RS: 7, KY: 7, IP: 5 }
export const DEFAULT_SENTAKU_SPLIT: Record<string, number> = { RK: 3 }   // 空欄 A〜C が労基

const SENTAKU_SINGLE: Record<string, string> = {
  RK: 'rouki', RS: 'rousai', KY: 'koyou', RI: 'rouippan', SI: 'shaippan', KH: 'kenpo', KO: 'kounen', KN: 'kokunen',
}

// 採点科目 → [前半の学習科目, 後半の学習科目]（分割の無い科目は1つ）
function pair(code: string): string[] {
  return SHAROUSHI_SCORED_TO_STUDY[code] ?? []
}

export function takuStudySubject(code: string, qNo: number, split: StudySplit = {}): string {
  const subjects = pair(code)
  const at = split[code] ?? DEFAULT_TAKU_SPLIT[code]
  if (subjects.length < 2 || at === undefined) return subjects[0]
  return qNo <= at ? subjects[0] : subjects[1]
}

const LABEL_INDEX: Record<ItemLabel, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }

// 選択式の問（1科目）の学習科目と、空欄ごとの学習科目
export function sentakuStudySubject(code: string): string {
  return SENTAKU_SINGLE[code]
}

export function sentakuBlankStudySubject(code: string, label: ItemLabel, split: StudySplit = {}): string {
  const at = split[code] ?? DEFAULT_SENTAKU_SPLIT[code]
  if (at === undefined) return SENTAKU_SINGLE[code]
  const subjects = pair(code)
  return LABEL_INDEX[label] <= at ? subjects[0] : subjects[1]
}

// ---------------------------------------------------------------------------
// 分割位置の検証に使う語（§16: 労一・社一の分割位置は取り込み時に検証する）
//
// 問の本文（問の文＋肢）に、片方の学習科目の語だけが現れたら、その学習科目と判定する。
// 両方・どちらも現れない問は判定しない（「判定できない」は失敗にしない）。

export const STUDY_KEYWORDS: Record<string, readonly string[]> = {
  rouki: ['労働基準法'],
  anei: ['労働安全衛生法', '安全衛生'],
  rousai: ['労災保険法', '労働者災害補償保険法'],
  koyou: ['雇用保険法'],
  choushu: ['徴収法', '保険料の徴収等に関する法律', '労働保険料', '印紙保険料'],
  rouippan: [
    '労働契約法', '労働組合法', '労働関係調整法', '労働者派遣', '男女雇用機会均等法', '育児介護休業法', '育児・介護休業法',
    '最低賃金法', '職業安定法', '労働施策総合推進法', '障害者雇用促進法', '高年齢者雇用安定法', 'パートタイム',
    '個別労働関係紛争', '次世代育成支援', '女性活躍推進法', '賃金の支払の確保', '職業能力開発促進法', '労働経済',
  ],
  shaippan: [
    '国民健康保険法', '高齢者の医療の確保に関する法律', '高齢者医療確保法', '介護保険法', '船員保険法', '社会保険労務士法',
    '確定給付企業年金法', '確定拠出年金法', '児童手当法', '社会保険審査官及び社会保険審査会法', '国民年金基金',
  ],
}

// 採点科目の中で、本文がどちらの学習科目に当たるか（判定できなければ null）
export function classifyStudy(code: string, text: string): string | null {
  const subjects = pair(code)
  if (subjects.length < 2) return null
  const hits = subjects.filter(s => (STUDY_KEYWORDS[s] ?? []).some(k => text.includes(k)))
  return hits.length === 1 ? hits[0] : null
}
