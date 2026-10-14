// 利用者が Supabase の SQL エディタで実行する SQL の生成（licensehub-expansion.md §4.1・PR-D）。純関数。
//
// 利用者はローカル環境を持たないため、DB への保存は「スクリプトと同じ検証・変換を通した行」を SQL にして渡す。
// 突き合わせの規則は merge.ts の ITEM_MERGE_POLICY から ON CONFLICT 句を作る（JS の upsert と同じ規則）。
//   ingest SQL: lic_questions / lic_items へ upsert（トランザクション。最後に件数を確認する SELECT）
//   check SQL : 読み出しのみ。書籍の肢との食い違い（truth・学習科目・座標）を一覧にする
import type { OfficialItemRow, OfficialQuestionRow } from './build.ts'
import { ITEM_COLUMNS, ITEM_MERGE_POLICY, QUESTION_COLUMNS } from './merge.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const COLUMN_TYPES: Record<string, string> = {
  q_no: 'integer', answer_spec: 'jsonb', truth: 'boolean', explanation_verified: 'boolean',
}

export function sqlLiteral(v: unknown, type = 'text'): string {
  if (v === null || v === undefined) return `NULL::${type}`
  if (type === 'jsonb') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  if (type === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (type === 'integer') {
    if (!Number.isInteger(v)) throw new Error(`整数でない値: ${String(v)}`)
    return String(v)
  }
  return `'${String(v).replace(/'/g, "''")}'::text`
}

function valuesRows<T>(rows: T[], columns: (keyof T)[]): string {
  return rows.map(r => `  (${columns.map(c => sqlLiteral(r[c], COLUMN_TYPES[c as string])).join(', ')})`).join(',\n')
}

// 書き込み先の利用者: --user の UUID か、Auth の利用者が1人ならその人（resolveUserId と同じ規則）
function userGuard(userId: string | undefined): { guard: string; expr: string } {
  if (userId) {
    if (!UUID_RE.test(userId)) throw new Error(`user_id が UUID の形式ではありません: ${userId}`)
    return { guard: '', expr: `'${userId}'::uuid` }
  }
  return {
    guard: `DO $$ BEGIN
  IF (SELECT count(*) FROM auth.users) <> 1 THEN
    RAISE EXCEPTION '利用者が1人ではありません。--user <uuid> を付けて SQL を作り直してください';
  END IF;
END $$;
`,
    expr: '(SELECT id FROM auth.users)',
  }
}

function itemConflictSet(): string {
  const sets: string[] = []
  for (const col of ITEM_COLUMNS) {
    if (col === 'id') continue
    const p = ITEM_MERGE_POLICY[col]
    if (p === 'official') sets.push(`${col} = EXCLUDED.${col}`)
    else if (p === 'keepIfBook') sets.push(`${col} = CASE WHEN lic_items.truth_source = 'book' THEN lic_items.${col} ELSE EXCLUDED.${col} END`)
    else if (p === 'excludedWins') sets.push(`${col} = CASE WHEN EXCLUDED.law_status = 'excluded' THEN EXCLUDED.${col} ELSE lic_items.${col} END`)
    // keep: 更新しない
  }
  return sets.map(s => `  ${s}`).join(',\n')
}

export interface IngestSqlOptions { userId?: string; label: string }

export function toIngestSql(questions: OfficialQuestionRow[], items: OfficialItemRow[], opts: IngestSqlOptions): string {
  const { guard, expr } = userGuard(opts.userId)
  const qCols = QUESTION_COLUMNS
  const iCols = ITEM_COLUMNS
  const ids = items.map(i => `'${i.id}'`).join(', ')
  return `-- 公式PDF（本試験）の取り込み: ${opts.label}
-- scripts/license/ingest-official.mjs が生成（検証ゲートを通った年度・式だけ）。Supabase の SQL エディタで実行する。
-- 冪等（再実行可）。書籍の肢（truth_source='book'）の statement・truth・解説は上書きせず、公式の原文を origin_statement に入れる。
-- 法改正の確認（law_status・law_note。PR-K）は既存行では据え置く（問題誤りで excluded にする肢を除く）。
-- lic_questions ${questions.length} 行 / lic_items ${items.length} 行
BEGIN;
${guard}
INSERT INTO lic_questions (user_id, ${qCols.join(', ')})
SELECT ${expr}, v.*
FROM (VALUES
${valuesRows(questions, qCols)}
) AS v(${qCols.join(', ')})
ON CONFLICT (user_id, id) DO UPDATE SET
${qCols.filter(c => c !== 'id').map(c => `  ${c} = EXCLUDED.${c}`).join(',\n')};

INSERT INTO lic_items (user_id, ${iCols.join(', ')})
SELECT ${expr}, v.*
FROM (VALUES
${valuesRows(items, iCols)}
) AS v(${iCols.join(', ')})
ON CONFLICT (user_id, id) DO UPDATE SET
${itemConflictSet()};

COMMIT;

-- 確認: 取り込んだ肢がすべて入ったか（expected と stored が一致すること）
SELECT ${items.length} AS expected, count(*) AS stored,
       count(*) FILTER (WHERE truth_source = 'book') AS book_rows_kept,
       count(*) FILTER (WHERE law_status = 'excluded') AS excluded
FROM lic_items
WHERE user_id = ${expr} AND id IN (${ids});
`
}

// 読み出しのみ。保存の前に実行して、書籍の肢との食い違いを確認する。
export function toCheckSql(items: OfficialItemRow[], opts: IngestSqlOptions): string {
  const { expr } = userGuard(opts.userId)
  const cols: (keyof OfficialItemRow)[] = ['id', 'question_id', 'truth', 'study_subject']
  return `-- 公式PDFの取り込み前の突き合わせ（読み出しのみ）: ${opts.label}
-- kind: truth_conflict（書籍と公式の○×が違う）/ study_conflict（学習科目が違う）/ unmatched_book（公式に同じ座標が無い書籍の肢）/ book_match（一致した件数）
WITH v(${cols.join(', ')}) AS (VALUES
${valuesRows(items, cols)}
), book AS (
  SELECT i.* FROM lic_items i
  WHERE i.user_id = ${expr} AND i.truth_source = 'book'
    AND i.question_id IN (SELECT DISTINCT question_id FROM v)
)
SELECT 'truth_conflict' AS kind, b.id, format('書籍 %s / 公式 %s', b.truth, v.truth) AS detail
FROM book b JOIN v ON v.id = b.id
WHERE v.truth IS NOT NULL AND b.truth IS DISTINCT FROM v.truth
UNION ALL
SELECT 'study_conflict', b.id, format('書籍 %s / 公式 %s', b.study_subject, v.study_subject)
FROM book b JOIN v ON v.id = b.id
WHERE b.study_subject <> v.study_subject
UNION ALL
SELECT 'unmatched_book', b.id, '公式に同じ座標の肢が無い'
FROM book b WHERE NOT EXISTS (SELECT 1 FROM v WHERE v.id = b.id)
UNION ALL
SELECT 'book_match', NULL, format('%s 件', count(*))
FROM book b JOIN v ON v.id = b.id
ORDER BY 1, 2;
`
}
