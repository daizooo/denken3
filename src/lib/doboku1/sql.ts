// dbk_questions への保存SQL（冪等な upsert）。Supabase MCP の execute_sql で流す（CLAUDE.md・licensehub-expansion.md §4.1）。
// 公式由来の列（本文・正答）は上書きし、figure_path は既存値を保つ（図の登録は別手順）。
// explain は新しい値があるときだけ上書きする（NULL で既存の解説を消さない）。
import type { DbkQuestionRow } from './types.ts'

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

const COLS = [
  'id', 'year', 'paper', 'q_no', 'group_label', 'required', 'category', 'topic', 'kind', 'direction',
  'stem', 'statements', 'choice_header', 'choices', 'correct', 'has_figure', 'figure_path', 'explain', 'explain_verified',
] as const

export function toUpsertSql(rows: DbkQuestionRow[], userId: string): string {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error(`user_id が UUID ではない: ${userId}`)
  const values = rows.map(r => `(${lit(userId)}::uuid, ${COLS.map(c => lit(r[c])).join(', ')})`)
  const updates = COLS.filter(c => c !== 'id' && c !== 'figure_path' && c !== 'explain' && c !== 'explain_verified')
    .map(c => `${c} = EXCLUDED.${c}`)
  updates.push('explain = COALESCE(EXCLUDED.explain, denken3.dbk_questions.explain)')
  updates.push('explain_verified = CASE WHEN EXCLUDED.explain IS NULL THEN denken3.dbk_questions.explain_verified ELSE EXCLUDED.explain_verified END')
  return `INSERT INTO denken3.dbk_questions (user_id, ${COLS.join(', ')})
VALUES
${values.join(',\n')}
ON CONFLICT (user_id, id) DO UPDATE SET
  ${updates.join(',\n  ')};`
}

/** 保存後の確認（読み出しのみ）。 */
export function toCheckSql(year: string, userId: string): string {
  return `SELECT paper, count(*) AS questions, count(explain) AS explained, count(*) FILTER (WHERE has_figure) AS figures
FROM denken3.dbk_questions WHERE user_id = ${lit(userId)}::uuid AND year = ${lit(year)}
GROUP BY paper ORDER BY paper;`
}

/** 解説だけを更新する SQL（本文・正答には触れない）。rows は検証済みのものだけ渡す。 */
export function toExplainUpdateSql(items: { id: string; explain: DbkQuestionRow['explain']; verified: boolean }[], userId: string): string {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error(`user_id が UUID ではない: ${userId}`)
  if (items.length === 0) throw new Error('更新する解説がない')
  const values = items.map(r => `(${lit(r.id)}, ${lit(r.explain)}, ${lit(r.verified)})`)
  return `UPDATE denken3.dbk_questions AS q SET explain = v.explain, explain_verified = v.verified
FROM (VALUES
${values.join(',\n')}
) AS v(id, explain, verified)
WHERE q.user_id = ${lit(userId)}::uuid AND q.id = v.id
RETURNING q.id;`
}
