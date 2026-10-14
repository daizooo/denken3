// 法改正フラグ（PR-K）の SQL 生成。利用者が Supabase の SQL エディタで実行する。純関数。
//
// 利用者はローカル環境を持たないため、判定は DB 上の本文に対して SQL で行う。規則は lawRisk.ts の
// LAW_RISK_RULES をそのまま VALUES に埋め込む（JS と PostgreSQL で同じ正規表現。判定の正本は lawRisk.ts）。
//   check    : 読み出しのみ。候補の件数（年度・科目・規則別）と一覧
//   apply    : unchecked のうち候補の肢を review にし、law_note に追記する（既存の注記は残す）。冪等
//   rollback : apply で review にした肢（自動判定の注記があり、まだ review のもの）を unchecked に戻し、注記の行を消す
import { FIXTURE_YEARS } from './ingest/schema.ts'
import { LAW_RISK_MARKER, LAW_RISK_RULES } from './lawRisk.ts'
import { userGuard } from './official/sql.ts'

export interface LawRiskSqlOptions {
  /** 法令基準日（YYYY-MM-DD）。 */
  baseDate: string
  /** 対象の利用者（省略時は Auth の利用者が1人ならその人）。 */
  userId?: string
  /** フィクスチャ（R98・R99）も対象にする（ローカルの通し確認用）。 */
  includeFixture?: boolean
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const q = (s: string) => `'${s.replace(/'/g, "''")}'`

function assertDate(d: string): void {
  if (!DATE_RE.test(d) || Number.isNaN(Date.parse(d))) throw new Error(`法令基準日が YYYY-MM-DD ではありません: ${d}`)
}

function rulesCte(): string {
  const rows = LAW_RISK_RULES.map((r, i) => `    (${i + 1}, ${q(r.label)}, ${q(r.pattern)})`).join(',\n')
  return `rules(ord, label, pattern) AS (VALUES\n${rows}\n  )`
}

// 対象の肢（公式PDF由来・unchecked）と判定に使う本文。選択式の空欄は正答の語句を足す（lawRiskText と同じ）。
function targetCte(expr: string, includeFixture: boolean): string {
  const fixture = includeFixture ? '' : `\n      AND q.year NOT IN (${FIXTURE_YEARS.map(q).join(', ')})`
  return `target AS (
    SELECT i.user_id, i.id, q.year, i.scored_subject, i.law_note, i.statement,
           i.statement || CASE WHEN q.answer_spec->>'kind' = 'sentaku'
             THEN ' ' || COALESCE(q.answer_spec->'wordbank'->>(q.answer_spec->'blanks'->>i.label), '')
             ELSE '' END AS body
    FROM lic_items i
    JOIN lic_questions q ON q.user_id = i.user_id AND q.id = i.question_id
    WHERE i.user_id = ${expr}
      AND i.law_status = 'unchecked'
      AND q.source = 'honshiken'${fixture}
  )`
}

const candCte = `cand AS (
    SELECT t.id, string_agg(r.label, '・' ORDER BY r.ord) AS reasons
    FROM target t JOIN rules r ON t.body ~ r.pattern
    GROUP BY t.id
  )`

/** 読み出しのみ。候補の件数と一覧。 */
export function toLawRiskCheckSql(opts: LawRiskSqlOptions): string {
  assertDate(opts.baseDate)
  const { expr } = userGuard(opts.userId)
  return `-- 法改正フラグ（PR-K）の確認: 読み出しのみ（DB は変わらない）。法令基準日 ${opts.baseDate}
-- scripts/license/flag-law-risk.mjs が生成。結果1: 年度・科目別の件数 / 結果2: 候補の一覧（この順に2回に分けて実行してもよい）
WITH ${rulesCte()},
  ${targetCte(expr, !!opts.includeFixture)},
  ${candCte}
SELECT t.year, t.scored_subject,
       count(*) AS unchecked,
       count(c.id) AS review_candidates
FROM target t LEFT JOIN cand c ON c.id = t.id
GROUP BY ROLLUP (t.year, t.scored_subject)
ORDER BY t.year NULLS LAST, t.scored_subject NULLS LAST;

WITH ${rulesCte()},
  ${targetCte(expr, !!opts.includeFixture)},
  ${candCte}
SELECT t.id, c.reasons, left(t.statement, 80) AS statement_head
FROM target t JOIN cand c ON c.id = t.id
ORDER BY t.id;
`
}

/** 本体。unchecked の候補を review にし、law_note に追記する。冪等（2回目は 0 行）。 */
export function toLawRiskApplySql(opts: LawRiskSqlOptions): string {
  assertDate(opts.baseDate)
  const { guard, expr } = userGuard(opts.userId)
  const note = `${q(`${LAW_RISK_MARKER} 法令基準日 ${opts.baseDate} 時点で要確認（`)} || c.reasons || '）'`
  return `-- 法改正フラグ（PR-K）の適用。法令基準日 ${opts.baseDate}
-- scripts/license/flag-law-risk.mjs が生成。先に *.check.sql で件数と一覧を確認してから実行する。
-- 公式PDF由来で law_status='unchecked' の肢のうち、数値・期間・金額などを含むものを 'review' にする。
-- law_note は追記のみ（問題誤りの公表などの既存の注記は消さない）。ok・review・excluded の肢は触らない（冪等）。
-- 戻すときは *.rollback.sql。
BEGIN;
${guard}
WITH ${rulesCte()},
  ${targetCte(expr, !!opts.includeFixture)},
  ${candCte}
UPDATE lic_items i
SET law_status = 'review',
    law_note = CASE
      WHEN position(${q(LAW_RISK_MARKER)} IN COALESCE(i.law_note, '')) > 0 THEN i.law_note
      WHEN COALESCE(btrim(i.law_note, E' \\n'), '') = '' THEN ${note}
      ELSE btrim(i.law_note, E' \\n') || E'\\n' || ${note}
    END
FROM cand c
WHERE i.user_id = ${expr} AND i.id = c.id AND i.law_status = 'unchecked';

COMMIT;

-- 確認: 公式PDF由来の肢の law_status の内訳（unchecked + review + ok + excluded = 全件）
SELECT i.law_status, count(*) AS items,
       count(*) FILTER (WHERE position(${q(LAW_RISK_MARKER)} IN COALESCE(i.law_note, '')) > 0) AS auto_flagged
FROM lic_items i
JOIN lic_questions q ON q.user_id = i.user_id AND q.id = i.question_id
WHERE i.user_id = ${expr} AND q.source = 'honshiken'
GROUP BY i.law_status
ORDER BY i.law_status;
`
}

/** ロールバック。apply が review にした肢のうち、まだ review のものだけを unchecked に戻す。 */
export function toLawRiskRollbackSql(opts: Pick<LawRiskSqlOptions, 'userId'>): string {
  const { guard, expr } = userGuard(opts.userId)
  // 自動判定の行（見出しで始まる行）だけを消す。他の注記は残す。
  const markerRe = `\\n?${LAW_RISK_MARKER.replace(/[[\]]/g, c => `\\${c}`)}[^\\n]*`
  return `-- 法改正フラグ（PR-K）のロールバック。
-- 自動判定で review にした肢（自動判定の注記があり、まだ review のもの）を unchecked に戻し、自動判定の注記の行だけを消す。
-- 要確認一覧で ok・excluded に更新済みの肢は触らない。冪等。
BEGIN;
${guard}
UPDATE lic_items i
SET law_status = 'unchecked',
    law_note = NULLIF(btrim(regexp_replace(i.law_note, ${q(markerRe)}, '', 'g'), E' \\n'), '')
WHERE i.user_id = ${expr}
  AND i.law_status = 'review'
  AND position(${q(LAW_RISK_MARKER)} IN COALESCE(i.law_note, '')) > 0;

COMMIT;

SELECT law_status, count(*) AS items
FROM lic_items
WHERE user_id = ${expr}
GROUP BY law_status
ORDER BY law_status;
`
}
