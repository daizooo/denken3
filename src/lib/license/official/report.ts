// 検証ゲートの結果と件数の報告（licensehub-expansion.md §13・§14・PR-D）。純関数。
// 取り込みのたびに、年度・式ごとの合否と、件数（年度別・科目別・温存対象）を出す。
import type { OfficialUnit } from './build.ts'
import type { OfficialIssue } from './types.ts'

const countBy = <T>(xs: T[], key: (x: T) => string): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

const fmt = (r: Record<string, number>) =>
  Object.keys(r).length === 0 ? '0' : Object.entries(r).map(([k, n]) => `${k} ${n}`).join(' / ')

const formatName = (u: Pick<OfficialUnit, 'format'>) => (u.format === 'taku' ? '択一' : '選択式')

export function formatIssues(issues: OfficialIssue[], level: OfficialIssue['level']): string[] {
  return issues.filter(i => i.level === level).map(i => `  ${i.where}: ${i.reason}`)
}

// ゲートの合否（年度 × 式）と、通らなかった理由の一覧
export function formatGate(units: OfficialUnit[]): string[] {
  const lines: string[] = ['検証ゲート（年度ごとに 択一 70問/350肢・選択式 8科目/40空欄・正答の充足率100%・ID重複なし）:']
  for (const u of units) {
    const errors = u.issues.filter(i => i.level === 'error').length
    const warnings = u.issues.filter(i => i.level === 'warning').length
    const status = !u.provided ? '― 未提供（提供され次第取り込む）' : u.passed ? '✓ 合格' : `✗ 不合格（失敗 ${errors} 件。この年度の${formatName(u)}は保存しない）`
    lines.push(`  ${u.year} ${formatName(u)}: ${status}${warnings > 0 ? `（警告 ${warnings} 件）` : ''}`)
  }
  for (const u of units) {
    const errs = formatIssues(u.issues, 'error')
    if (errs.length > 0) lines.push(`✗ ${u.year} ${formatName(u)} の失敗（理由）:`, ...errs)
  }
  for (const u of units) {
    const warns = formatIssues(u.issues, 'warning')
    if (warns.length > 0) lines.push(`⚠ ${u.year} ${formatName(u)} の警告:`, ...warns)
  }
  return lines
}

// 保存する行の件数（ゲートを通った単位だけ）
export function formatCounts(units: OfficialUnit[]): string[] {
  const items = units.flatMap(u => u.items)
  const questions = units.flatMap(u => u.questions)
  const holdoutOf = new Map(questions.map(q => [q.id, q.holdout_group]))
  const held = items.filter(i => holdoutOf.get(i.question_id))
  return [
    `保存対象: lic_questions ${questions.length} 行 / lic_items ${items.length} 行`,
    `  年度・式別:   ${fmt(countBy(items, i => `${i.question_id.slice(0, 3)} ${i.question_id[4] === 'T' ? '択一' : '選択式'}`))}`,
    `  採点科目別:   ${fmt(countBy(items, i => i.scored_subject))}`,
    `  学習科目別:   ${fmt(countBy(items, i => i.study_subject))}`,
    `  温存対象:     ${held.length} 件${held.length > 0 ? `（${fmt(countBy(held, i => holdoutOf.get(i.question_id)!))}）※解放日まで出題しない` : ''}`,
    `  truth 未導出（個数の問・空欄。null）: ${items.filter(i => i.truth === null).length} / excluded: ${items.filter(i => i.law_status === 'excluded').length} / law_status=unchecked: ${items.filter(i => i.law_status === 'unchecked').length}`,
  ]
}
