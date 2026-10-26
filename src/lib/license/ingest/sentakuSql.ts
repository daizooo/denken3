// 書籍の選択式の保存用 SQL の生成（docs/book-ingest/sentaku-spec.md §3.3）。純関数。
//
// ローカル環境を持たないため、保存は「検証を通した行」を SQL にして、Claude Code が Supabase MCP の execute_sql で実行する
// （official/sql.ts と同じ方式）。削除系（DELETE / DROP / TRUNCATE）は使わない。
//   check SQL : 読み出しのみ。対象の問の既存の answer_spec（公式）を返す。スクリプトの --existing で突合する
//   apply SQL : 問は新規だけ作り（既存は触らない）、空欄は statement・解説・学習科目だけ上書きする。
//               既存の問の answer_spec が書籍と違えば、何も書かずに中止する（トランザクション内の例外）
import { sqlLiteral, userGuard } from '../official/sql.ts'
import { holdoutGroupOf } from './schema.ts'
import type { ValidSentaku } from './sentakuSchema.ts'

export interface SentakuSqlOptions { userId?: string; label: string }

const lit = (v: unknown, type = 'text') => sqlLiteral(v, type)

const QUESTION_COLUMNS = ['id', 'year', 'format', 'scored_subject', 'study_subject', 'q_no', 'stem', 'answer_spec', 'source', 'holdout_group'] as const
const ITEM_COLUMNS = [
  'id', 'question_id', 'label', 'label_raw', 'statement', 'truth', 'truth_source', 'explanation', 'explanation_source',
  'explanation_verified', 'topic_id', 'importance', 'law_status', 'law_note', 'study_subject', 'scored_subject',
] as const

// 既存の空欄で書籍の値に置き換える列（これ以外は据え置く: origin_statement・truth・law_status・law_note など）
const ITEM_UPDATE_COLUMNS = ['statement', 'explanation', 'explanation_source', 'explanation_verified', 'study_subject'] as const

const answerSpec = (v: ValidSentaku) => ({ kind: 'sentaku', blanks: v.blanks, wordbank: v.wordbank })

function questionRow(v: ValidSentaku): string {
  return `  (${[
    lit(v.questionId), lit(v.year), lit('sentaku'), lit(v.scoredSubject), lit(v.studySubject), lit(null, 'integer'), lit(null),
    lit(answerSpec(v), 'jsonb'), lit('ippon'), lit(holdoutGroupOf(v.year, '')),
  ].join(', ')})`
}

function itemRows(valid: ValidSentaku[]): string {
  return valid.flatMap(v => v.items.map(it => `  (${[
    lit(it.itemId), lit(v.questionId), lit(it.label), lit(it.label), lit(it.statement), lit(null, 'boolean'), lit('book'),
    lit(it.explanation), lit(it.explanation ? 'book' : 'none'), lit(!!it.explanation, 'boolean'),
    lit(null), lit(null), lit('ok'), lit(null), lit(it.studySubject), lit(v.scoredSubject),
  ].join(', ')})`)).join(',\n')
}

/** 読み出しのみ。対象の問の既存の answer_spec を返す（結果を JSON にして --existing に渡す）。 */
export function toSentakuCheckSql(valid: ValidSentaku[], opts: SentakuSqlOptions): string {
  const { expr } = userGuard(opts.userId)
  return `-- 選択式（書籍）の取り込み前の突き合わせ（読み出しのみ）: ${opts.label}
-- 既存の問（公式PDF由来）の answer_spec。結果を JSON にして ingest-sentaku.mjs の --existing に渡す。
SELECT id, answer_spec FROM lic_questions
WHERE user_id = ${expr} AND format = 'sentaku' AND id IN (${valid.map(v => lit(v.questionId)).join(', ')})
ORDER BY id;
`
}

/** 保存用。冪等（再実行可）。既存の問の answer_spec が書籍と違えば中止する。 */
export function toSentakuApplySql(valid: ValidSentaku[], opts: SentakuSqlOptions): string {
  const { guard, expr } = userGuard(opts.userId)
  const ids = valid.flatMap(v => v.items.map(it => lit(it.itemId))).join(', ')
  const book = valid.map(v => `  (${lit(v.questionId)}, ${lit(v.blanks, 'jsonb')}, ${lit(v.wordbank, 'jsonb')})`).join(',\n')
  const blanksTotal = valid.reduce((n, v) => n + v.items.length, 0)
  return `-- 選択式（書籍）の取り込み: ${opts.label}
-- scripts/license/ingest-sentaku.mjs が生成（検証を通した問だけ）。execute_sql で実行する。
-- 冪等（再実行可）。lic_questions は新規の問だけ作る（公式の stem・answer_spec は更新しない）。
-- lic_items は ${ITEM_UPDATE_COLUMNS.join('・')} だけ上書きし、origin_statement・truth・law_status・law_note は据え置く。
-- lic_questions ${valid.length} 問 / lic_items ${blanksTotal} 空欄
BEGIN;
${guard}
DO $sentaku$ BEGIN
  IF EXISTS (
    WITH book(id, blanks, wordbank) AS (VALUES
${book.replace(/^/gm, '  ')}
    )
    SELECT 1 FROM book b JOIN lic_questions q ON q.user_id = ${expr} AND q.id = b.id
    WHERE q.answer_spec->>'kind' IS DISTINCT FROM 'sentaku'
       OR q.answer_spec->'blanks' IS DISTINCT FROM b.blanks
       OR q.answer_spec->'wordbank' IS DISTINCT FROM b.wordbank
  ) THEN
    RAISE EXCEPTION '既存の answer_spec が書籍と食い違う問があります。何も保存しません（ingest-sentaku.mjs --existing で突合する）';
  END IF;
END $sentaku$;

INSERT INTO lic_questions (user_id, ${QUESTION_COLUMNS.join(', ')})
SELECT ${expr}, v.*
FROM (VALUES
${valid.map(questionRow).join(',\n')}
) AS v(${QUESTION_COLUMNS.join(', ')})
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO lic_items (user_id, ${ITEM_COLUMNS.join(', ')})
SELECT ${expr}, v.*
FROM (VALUES
${itemRows(valid)}
) AS v(${ITEM_COLUMNS.join(', ')})
ON CONFLICT (user_id, id) DO UPDATE SET
${ITEM_UPDATE_COLUMNS.map(c => `  ${c} = EXCLUDED.${c}`).join(',\n')};

COMMIT;

-- 確認: 取り込んだ空欄がすべて入ったか（expected と stored が一致すること）
SELECT ${blanksTotal} AS expected, count(*) AS stored,
       count(*) FILTER (WHERE truth_source = 'book') AS book_rows,
       count(*) FILTER (WHERE law_status <> 'ok') AS law_flagged
FROM lic_items
WHERE user_id = ${expr} AND id IN (${ids});
`
}
