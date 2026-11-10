// 構造化した問 + 正答 + 索引 → DB 行。検証ゲートを通らない年度は保存しない（docs/design/doboku1-ichiji.md §6 T2）。
import type { DbkQuestionRow, Explain, Paper, ParsedQuestion } from './types.ts'
import { categoryOf, dbkId, groupOf, type YearIndex } from '../../data/doboku1/categories.ts'
import { explainProblems } from './explain.ts'

/** 書き起こしの補正（式・図を含む問）。キーは 'A01' の形。指定した項目だけ上書きする。 */
export type Overrides = Record<string, Partial<Pick<ParsedQuestion, 'stem' | 'statements' | 'choiceHeader' | 'choices' | 'kind' | 'direction' | 'hasFigure'>>>
/** 解説。キーは 'A01' の形。 */
export type Explains = Record<string, { explain: Explain; verified?: boolean }>

export const overrideKey = (paper: Paper, no: number) => `${paper}${String(no).padStart(2, '0')}`

/** 「〜に関する記述のうち」の手前を論点名にする。 */
export function topicOf(stem: string): string {
  const first = stem.split('\n')[0]
  const m = first.match(/^(.+?)(に関する|について|の組合せ|を求める|として)/)
  const t = (m ? m[1] : first).replace(/^(労働基準法|労働安全衛生法|建設業法|道路法|河川法|建築基準法|騒音規制法|振動規制法|港則法)令上，/, '$1：')
  return t.length > 40 ? t.slice(0, 40) + '…' : t
}

// 文字化けの検出（私用領域・置換文字・cid）。下付き・上付き数字は extract.py が意図して出す（Na₂O・m²）
const GARBLED = /[-�]|\(cid:\d+\)/

export interface BuildResult { rows: DbkQuestionRow[]; errors: string[]; warnings: string[] }

export function buildYear(
  idx: YearIndex,
  parsed: Record<Paper, ParsedQuestion[]>,
  key: Record<Paper, Map<number, number>>,
  overrides: Overrides = {},
  explains: Explains = {},
): BuildResult {
  const errors: string[] = []
  const warnings: string[] = []
  const rows: DbkQuestionRow[] = []
  for (const paper of ['A', 'B'] as Paper[]) {
    const qs = parsed[paper]
    if (qs.length !== idx.total[paper]) errors.push(`${paper}: 問数 ${qs.length}（期待 ${idx.total[paper]}）`)
    if (key[paper].size !== idx.total[paper]) errors.push(`${paper}: 正答 ${key[paper].size} 件（期待 ${idx.total[paper]}）`)
    const seen = new Set<number>()
    for (const raw of qs) {
      const k = overrideKey(paper, raw.no)
      const q = { ...raw, ...overrides[k] }
      if (seen.has(q.no)) errors.push(`${k}: 問番号の重複`)
      seen.add(q.no)
      const correct = key[paper].get(q.no)
      const group = groupOf(idx, paper, q.no)
      const category = categoryOf(idx, paper, q.no)
      if (!correct) errors.push(`${k}: 正答がない`)
      if (!group) errors.push(`${k}: 選択解答のグループがない`)
      if (!category) errors.push(`${k}: 学習分野がない`)
      if (q.choices.length !== 4) errors.push(`${k}: 選択肢が ${q.choices.length} 個（期待 4）`)
      if (q.choiceHeader.length >= 2 && q.choices.some(c => c.length !== q.choiceHeader.length)) {
        errors.push(`${k}: 表形式の列数が見出し（${q.choiceHeader.length}列）と合わない`)
      }
      if (q.kind === 'statements' && q.statements.length !== 4) errors.push(`${k}: ①〜④が ${q.statements.length} 個`)
      const text = [q.stem, ...q.statements, ...q.choices.flat()].join('\n')
      if (GARBLED.test(text)) errors.push(`${k}: 文字化けの疑い`)
      if (q.choices.some(c => c.join('').trim() === '')) errors.push(`${k}: 空の選択肢`)
      // 問いの文末（〜はどれか。）が欠けると向き（適当／適当でない）を取り違える（R08 B10 で確認）
      if (!/どれか/.test(q.stem)) errors.push(`${k}: 問題文に「どれか」がない（文末の欠落の疑い）`)
      // 式の上付き・添字・√が抜けると選択肢が同じになる（R08 A03・A05 で確認）
      const norm = q.choices.map(c => c.join('|').replace(/[\s　]/g, ''))
      if (new Set(norm).size !== norm.length) errors.push(`${k}: 同じ内容の選択肢がある（式の崩れの疑い）`)
      const ex = explains[k]
      if (ex && correct) {
        for (const e of explainProblems(ex.explain, { ...q, correct })) errors.push(`${k}: 解説 ${e}`)
      }
      if (q.hasFigure) warnings.push(`${k}: 図あり（図の登録が必要）`)
      rows.push({
        id: dbkId(idx.year, paper, q.no),
        year: idx.year, paper, q_no: q.no,
        group_label: group?.label ?? '',
        required: group?.required ?? false,
        category: category ?? '',
        topic: topicOf(q.stem),
        kind: q.kind, direction: q.direction,
        stem: q.stem, statements: q.statements, choice_header: q.choiceHeader, choices: q.choices,
        correct: correct ?? 0,
        has_figure: q.hasFigure, figure_path: null,
        explain: ex?.explain ?? null,
        explain_verified: ex?.verified ?? false,
      })
    }
  }
  return { rows, errors, warnings }
}
