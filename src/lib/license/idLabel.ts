// 肢ID・問ID・年度コードの日本語表記（画面表示用。DB の ID は変えない）。純関数。
//   R06_S_KN_B     → 令和6年度 国民年金法 選択式 空欄B
//   R06_T_RK_04_C  → 令和6年度 労働基準法及び労働安全衛生法 択一式 問4 肢C
//   R06_T_RK_04    → 令和6年度 労働基準法及び労働安全衛生法 択一式 問4
//   R01 / H29      → 令和元年度 / 平成29年度
import { parseItemId, parseQuestionId, type QuestionCoord } from '../../domain/license'

// 採点科目コード → 科目名（src/data/sharoushi/index.ts の SCORED_NAMES と同じ。あちらは非公開なので写している）。
export const SCORED_SUBJECT_NAMES: Record<string, string> = {
  RK: '労働基準法及び労働安全衛生法',
  RS: '労働者災害補償保険法',
  KY: '雇用保険法',
  RI: '労務管理その他の労働に関する一般常識',
  SI: '社会保険に関する一般常識',
  IP: '労一・社一',
  KH: '健康保険法',
  KO: '厚生年金保険法',
  KN: '国民年金法',
}

// 一覧の見出しなど狭い所向けの短い科目名。
export const SCORED_SUBJECT_SHORT: Record<string, string> = {
  RK: '労基・安衛',
  RS: '労災',
  KY: '雇用',
  RI: '労一',
  SI: '社一',
  IP: '労一・社一',
  KH: '健保',
  KO: '厚年',
  KN: '国年',
}

const ERA: Record<string, string> = { H: '平成', R: '令和' }

// 'R06' → '令和6年度'、'R01' → '令和元年度'。読めない値はそのまま返す。
export function yearLabelJa(year: string): string {
  const m = year.match(/^([HR])(\d{2})$/)
  if (!m) return year
  const n = Number(m[2])
  return `${ERA[m[1]]}${n === 1 ? '元' : n}年度`
}

export function subjectNameJa(code: string, short = false): string {
  return (short ? SCORED_SUBJECT_SHORT : SCORED_SUBJECT_NAMES)[code] ?? code
}

function questionLabel(c: QuestionCoord, short: boolean): string {
  const base = `${yearLabelJa(c.year)} ${subjectNameJa(c.scoredSubject, short)}`
  return c.format === 'taku' ? `${base} 択一式 問${c.qNo}` : `${base} 選択式`
}

// 問ID → 日本語表記。ID として読めなければ元の文字列を返す。
export function questionIdLabelJa(id: string, short = false): string {
  const c = parseQuestionId(id)
  return c ? questionLabel(c, short) : id
}

// 肢ID → 日本語表記（択一式は「肢C」、選択式は「空欄B」）。ID として読めなければ元の文字列を返す。
export function itemIdLabelJa(id: string, short = false): string {
  const c = parseItemId(id)
  if (!c) return id
  return `${questionLabel(c, short)} ${c.format === 'taku' ? '肢' : '空欄'}${c.label}`
}

// 索引の表題の末尾「（R06 問1 A）」を「（令和6年度 問1 肢A）」に直す（画面表示用。索引は変えない）。
// 電験など別形式の表題（'抵抗直列回路（H10-A5）'）には当てはまらず、そのまま返す。
const TITLE_COORD_RE = /（([HR]\d{2}) 問(\d+) ([A-E])）$/
export function titleJa(title: string): string {
  return title.replace(TITLE_COORD_RE, (_, y: string, q: string, l: string) => `（${yearLabelJa(y)} 問${q} 肢${l}）`)
}
