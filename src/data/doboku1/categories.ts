// 1級土木 第一次検定の学習分野と、年度ごとの問 → 分野の索引（本文は含まない。docs/design/doboku1-ichiji.md §5）。
// 年度を足すときは YEAR_INDEX の末尾に1行追加する（既存行の並び替え・削除をしない。CLAUDE.md）。
import type { AnswerGroup, Paper } from '../../lib/doboku1/types.ts'

export interface Doboku1Category { id: string; name: string }

// 学習分野（タブの並び＝学習順の既定）。
export const DOBOKU1_CATEGORIES: Doboku1Category[] = [
  { id: 'kiso', name: '基礎（土質・力学・水理）' },
  { id: 'dokou', name: '土工' },
  { id: 'concrete', name: 'コンクリート' },
  { id: 'kisokou', name: '基礎工・土留め' },
  { id: 'kouzou', name: '鋼橋・コンクリート構造物' },
  { id: 'kasen', name: '河川・砂防' },
  { id: 'douro', name: '道路・舗装' },
  { id: 'damtunnel', name: 'ダム・トンネル' },
  { id: 'kaigan', name: '海岸・港湾' },
  { id: 'tetsudou', name: '鉄道・シールド' },
  { id: 'suidou', name: '上下水道・その他' },
  { id: 'houki', name: '法規' },
  { id: 'kyoutsu', name: '共通工学（測量・契約・設計・機械）' },
  { id: 'keikaku', name: '施工計画' },
  { id: 'koutei', name: '工程管理' },
  { id: 'anzen', name: '安全管理' },
  { id: 'hinshitsu', name: '品質管理' },
  { id: 'kankyou', name: '環境保全・建設副産物' },
]

// 令和8年度の出題構成（試験問題・正答肢PDFの注記）。年度で変わりうるため年度ごとに持つ。
const R08_GROUPS: AnswerGroup[] = [
  { paper: 'A', from: 1, to: 5, answerCount: 5, required: true, label: '基礎（必須5問）' },
  { paper: 'A', from: 6, to: 20, answerCount: 12, required: false, label: '土木一般（15問中12問）' },
  { paper: 'A', from: 21, to: 54, answerCount: 10, required: false, label: '専門土木（34問中10問）' },
  { paper: 'A', from: 55, to: 66, answerCount: 8, required: false, label: '法規（12問中8問）' },
  { paper: 'B', from: 1, to: 20, answerCount: 20, required: true, label: '共通・施工管理（必須20問）' },
  { paper: 'B', from: 21, to: 35, answerCount: 15, required: true, label: '施工管理法・応用能力（必須15問）' },
]

// 問番号の範囲 → 分野。[paper, from, to, category]
type Span = [Paper, number, number, string]
const R08_SPANS: Span[] = [
  ['A', 1, 5, 'kiso'], ['A', 6, 10, 'dokou'], ['A', 11, 16, 'concrete'], ['A', 17, 20, 'kisokou'],
  ['A', 21, 25, 'kouzou'], ['A', 26, 31, 'kasen'], ['A', 32, 37, 'douro'], ['A', 38, 41, 'damtunnel'],
  ['A', 42, 45, 'kaigan'], ['A', 46, 49, 'tetsudou'], ['A', 50, 54, 'suidou'], ['A', 55, 66, 'houki'],
  ['B', 1, 4, 'kyoutsu'], ['B', 5, 5, 'keikaku'], ['B', 6, 6, 'koutei'], ['B', 7, 7, 'keikaku'],
  ['B', 8, 13, 'anzen'], ['B', 14, 16, 'hinshitsu'], ['B', 17, 20, 'kankyou'],
  ['B', 21, 24, 'keikaku'], ['B', 25, 27, 'koutei'], ['B', 28, 31, 'anzen'], ['B', 32, 35, 'hinshitsu'],
]

// 令和元〜2年度（学科試験）: 問題A 61問（選択）、問題B 35問（全問必須。応用能力の区分なし）。
const R01_GROUPS: AnswerGroup[] = [
  { paper: 'A', from: 1, to: 15, answerCount: 12, required: false, label: '土木一般（15問中12問）' },
  { paper: 'A', from: 16, to: 49, answerCount: 10, required: false, label: '専門土木（34問中10問）' },
  { paper: 'A', from: 50, to: 61, answerCount: 8, required: false, label: '法規（12問中8問）' },
  { paper: 'B', from: 1, to: 35, answerCount: 35, required: true, label: '共通・施工管理（必須35問）' },
]
// 令和3〜5年度（第一次検定）: 問題A は令和元年度と同じ。問題B に応用能力（No.21〜35）が入る。
const R03_GROUPS: AnswerGroup[] = [
  ...R01_GROUPS.filter(g => g.paper === 'A'),
  { paper: 'B', from: 1, to: 20, answerCount: 20, required: true, label: '共通・施工管理（必須20問）' },
  { paper: 'B', from: 21, to: 35, answerCount: 15, required: true, label: '施工管理法・応用能力（必須15問）' },
]
const R01_SPANS: Span[] = [
  ['A', 1, 5, 'dokou'], ['A', 6, 11, 'concrete'], ['A', 12, 15, 'kisokou'], ['A', 16, 20, 'kouzou'],
  ['A', 21, 26, 'kasen'], ['A', 27, 32, 'douro'], ['A', 33, 36, 'damtunnel'], ['A', 37, 40, 'kaigan'],
  ['A', 41, 44, 'tetsudou'], ['A', 45, 49, 'suidou'], ['A', 50, 61, 'houki'],
  ['B', 1, 4, 'kyoutsu'], ['B', 5, 9, 'keikaku'], ['B', 10, 13, 'koutei'], ['B', 14, 24, 'anzen'],
  ['B', 25, 31, 'hinshitsu'], ['B', 32, 35, 'kankyou'],
]
// 令和3〜7年度の問題B（令和8年度は B7 が施工計画で異なる）
const R03_B_SPANS: Span[] = [
  ['B', 1, 4, 'kyoutsu'], ['B', 5, 5, 'keikaku'], ['B', 6, 6, 'koutei'], ['B', 7, 13, 'anzen'],
  ['B', 14, 16, 'hinshitsu'], ['B', 17, 20, 'kankyou'],
  ['B', 21, 24, 'keikaku'], ['B', 25, 27, 'koutei'], ['B', 28, 31, 'anzen'], ['B', 32, 35, 'hinshitsu'],
]
const R03_SPANS: Span[] = [...R01_SPANS.filter(s => s[0] === 'A'), ...R03_B_SPANS]
// 令和6〜7年度: 問題A は令和8年度と同じ（基礎5問が必須）
const R06_SPANS: Span[] = [...R08_SPANS.filter(s => s[0] === 'A'), ...R03_B_SPANS]

export interface YearIndex { year: string; total: Record<Paper, number>; groups: AnswerGroup[]; spans: Span[] }

export const YEAR_INDEX: YearIndex[] = [
  { year: 'R08', total: { A: 66, B: 35 }, groups: R08_GROUPS, spans: R08_SPANS },
  { year: 'R07', total: { A: 66, B: 35 }, groups: R08_GROUPS, spans: R06_SPANS },
  { year: 'R06', total: { A: 66, B: 35 }, groups: R08_GROUPS, spans: R06_SPANS },
  { year: 'R05', total: { A: 61, B: 35 }, groups: R03_GROUPS, spans: R03_SPANS },
  { year: 'R04', total: { A: 61, B: 35 }, groups: R03_GROUPS, spans: R03_SPANS },
  { year: 'R03', total: { A: 61, B: 35 }, groups: R03_GROUPS, spans: R03_SPANS },
  { year: 'R02', total: { A: 61, B: 35 }, groups: R01_GROUPS, spans: R01_SPANS },
  { year: 'R01', total: { A: 61, B: 35 }, groups: R01_GROUPS, spans: R01_SPANS },
]

export function yearIndexOf(year: string): YearIndex | undefined {
  return YEAR_INDEX.find(y => y.year === year)
}

export function groupOf(idx: YearIndex, paper: Paper, no: number): AnswerGroup | undefined {
  return idx.groups.find(g => g.paper === paper && no >= g.from && no <= g.to)
}

export function categoryOf(idx: YearIndex, paper: Paper, no: number): string | undefined {
  return idx.spans.find(([p, f, t]) => p === paper && no >= f && no <= t)?.[3]
}

/** 'D1_R08_A_01' */
export function dbkId(year: string, paper: Paper, no: number): string {
  return `D1_${year}_${paper}_${String(no).padStart(2, '0')}`
}
