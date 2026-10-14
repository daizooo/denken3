// 書籍（J1b）が先に入れた同じ座標の肢との突き合わせと、保存する行の決め方（licensehub-expansion.md §14・PR-D）。純関数。
//
// 規則（列ごとの方針。JS の upsert と SQL の ON CONFLICT の両方をこの表から作る）:
//   - 書籍の肢（truth_source='book'）の statement・truth・explanation などは上書きしない。公式の原文は origin_statement に入れる。
//   - 公式由来の既存行（再実行）は、本文・truth を公式で更新し、法改正の確認（law_status・law_note。PR-K）は据え置く。
//   - 問題誤りで除外した肢（law_status='excluded'）だけは、既存行でも excluded にする。
//   - lic_questions は公式を正本とし、stem・answer_spec ほか全列を公式で上書きする（source='honshiken'）。
import type { LicItemRow } from '../../../domain/license.ts'
import type { CountCheck, OfficialItemRow, OfficialQuestionRow } from './build.ts'

export type MergePolicy = 'official' | 'keepIfBook' | 'keep' | 'excludedWins'

export const ITEM_MERGE_POLICY: Record<keyof OfficialItemRow, MergePolicy> = {
  id: 'official',
  question_id: 'official',
  label: 'official',
  label_raw: 'official',
  statement: 'keepIfBook',
  origin_statement: 'official',
  truth: 'keepIfBook',
  truth_source: 'keepIfBook',
  explanation: 'keep',
  explanation_source: 'keep',
  explanation_verified: 'keep',
  topic_id: 'keep',
  importance: 'keep',
  law_status: 'excludedWins',
  law_note: 'excludedWins',
  study_subject: 'keepIfBook',
  scored_subject: 'official',
}

export const ITEM_COLUMNS = Object.keys(ITEM_MERGE_POLICY) as (keyof OfficialItemRow)[]
export const QUESTION_COLUMNS: (keyof OfficialQuestionRow)[] = [
  'id', 'year', 'format', 'scored_subject', 'study_subject', 'q_no', 'stem', 'answer_spec', 'source', 'holdout_group',
]

export const isBookRow = (r: Pick<LicItemRow, 'truth_source'>) => r.truth_source === 'book'

// 既存行（無ければ undefined）と公式の行から、保存する行を決める
export function mergeItem(existing: OfficialItemRow | undefined, official: OfficialItemRow): OfficialItemRow {
  if (!existing) return official
  const book = isBookRow(existing)
  const out = { ...official } as Record<string, unknown>
  const ex = existing as unknown as Record<string, unknown>
  for (const col of ITEM_COLUMNS) {
    switch (ITEM_MERGE_POLICY[col]) {
      case 'official': break
      case 'keepIfBook': if (book) out[col] = ex[col]; break
      case 'keep': out[col] = ex[col]; break
      case 'excludedWins': if (official.law_status !== 'excluded') out[col] = ex[col]; break
    }
  }
  return out as unknown as OfficialItemRow
}

// ---------------------------------------------------------------------------
// 突き合わせの結果（取り込みのたびに一覧にする）

export type ExistingItem = Pick<LicItemRow, 'id' | 'question_id' | 'truth' | 'truth_source' | 'study_subject'>

export interface MatchReport {
  officialItems: number
  matchedBook: number          // 同じ座標の書籍の肢
  matchedOfficial: number      // 既に公式で入っていた肢（再実行）
  newItems: number
  truthConflicts: { id: string; book: boolean | null; official: boolean }[]
  studyConflicts: { id: string; book: string; official: string }[]
  countConflicts: { questionId: string; expected: number; bookTrue: number }[]
  unmatchedBook: string[]      // 取り込んだ問に属するのに、公式に同じ座標が無い書籍の肢
}

export function matchWithExisting(
  official: OfficialItemRow[], existing: ExistingItem[], counts: CountCheck[] = [],
): MatchReport {
  const byId = new Map(existing.map(e => [e.id, e]))
  const officialIds = new Set(official.map(o => o.id))
  const questionIds = new Set(official.map(o => o.question_id))
  const r: MatchReport = {
    officialItems: official.length, matchedBook: 0, matchedOfficial: 0, newItems: 0,
    truthConflicts: [], studyConflicts: [], countConflicts: [], unmatchedBook: [],
  }
  for (const o of official) {
    const e = byId.get(o.id)
    if (!e) { r.newItems++; continue }
    if (!isBookRow(e)) { r.matchedOfficial++; continue }
    r.matchedBook++
    if (o.truth !== null && e.truth !== o.truth) r.truthConflicts.push({ id: o.id, book: e.truth, official: o.truth })
    if (e.study_subject !== o.study_subject) r.studyConflicts.push({ id: o.id, book: e.study_subject, official: o.study_subject })
  }
  for (const c of counts) {
    const book = existing.filter(e => e.question_id === c.questionId && isBookRow(e))
    if (book.length !== 5 || book.some(e => e.truth === null)) continue
    const nTrue = book.filter(e => e.truth).length
    const expected = c.direction === 'right' ? c.count : 5 - c.count
    if (nTrue !== expected) r.countConflicts.push({ questionId: c.questionId, expected, bookTrue: nTrue })
  }
  r.unmatchedBook = existing.filter(e => isBookRow(e) && questionIds.has(e.question_id) && !officialIds.has(e.id)).map(e => e.id).sort()
  return r
}

const mark = (t: boolean | null) => (t === null ? '?' : t ? '○' : '×')

export function formatMatchReport(r: MatchReport): string[] {
  const lines = [
    `突き合わせ: 公式の肢 ${r.officialItems} 件 → 書籍の肢と一致 ${r.matchedBook} / 公式で取り込み済み ${r.matchedOfficial} / 新規 ${r.newItems}`,
    `  書籍の statement・truth・解説は上書きせず、公式の原文を origin_statement に入れる（${r.matchedBook} 件）`,
  ]
  if (r.truthConflicts.length > 0) {
    lines.push(`⚠ truth の食い違い ${r.truthConflicts.length} 件（書籍の値を残す。どちらが正しいか確認する）:`)
    for (const c of r.truthConflicts) lines.push(`  ${c.id}: 書籍 ${mark(c.book)} / 公式から導出 ${mark(c.official)}`)
  }
  if (r.countConflicts.length > 0) {
    lines.push(`⚠ 個数の問で書籍の ○ の数が正答と合わない ${r.countConflicts.length} 件:`)
    for (const c of r.countConflicts) lines.push(`  ${c.questionId}: 正答から ○ ${c.expected} 個 / 書籍 ○ ${c.bookTrue} 個`)
  }
  if (r.studyConflicts.length > 0) {
    lines.push(`⚠ 学習科目の食い違い ${r.studyConflicts.length} 件（書籍の値を残す）:`)
    for (const c of r.studyConflicts) lines.push(`  ${c.id}: 書籍 ${c.book} / 公式の分割 ${c.official}`)
  }
  if (r.unmatchedBook.length > 0) {
    lines.push(`⚠ 座標が公式と合わない書籍の肢 ${r.unmatchedBook.length} 件（手動で確認）: ${r.unmatchedBook.join(', ')}`)
  }
  if (r.truthConflicts.length + r.countConflicts.length + r.studyConflicts.length + r.unmatchedBook.length === 0) {
    lines.push('  食い違いなし')
  }
  return lines
}
