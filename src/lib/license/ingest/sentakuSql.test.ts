// 書籍の選択式の保存用 SQL（docs/book-ingest/sentaku-spec.md §3.3）。
import { describe, expect, it } from 'vitest'
import { validateSentaku } from './sentakuSchema'
import { toSentakuApplySql, toSentakuCheckSql } from './sentakuSql'

const wordbank = () => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), `語${i + 1}`]))
const LABELS = ['A', 'B', 'C', 'D', 'E']
const USER = '11111111-2222-3333-4444-555555555555'

const question = (over: Record<string, unknown> = {}) => ({
  question_id: 'R03_S_RK',
  wordbank: wordbank(),
  blanks: { A: 3, B: 7, C: 11, D: 16, E: 20 },
  items: LABELS.map((l, i) => ({
    label: l, statement: `段落${i + 1}［${l}］を補う。`, explanation: i === 1 ? '（法21条）' : null,
    study_subject: 'ABC'.includes(l) ? 'rouki' : 'anei',
  })),
  ...over,
})

const valid = (...qs: unknown[]) => {
  const r = validateSentaku(qs)
  expect(r.errors).toEqual([])
  return r.valid
}

describe('toSentakuCheckSql', () => {
  it('対象の問の既存の answer_spec を読むだけ（書き込み文を含まない）', () => {
    const sql = toSentakuCheckSql(valid(question(), question({ question_id: 'H29_S_RS', items: LABELS.map(l => ({ label: l, statement: `［${l}］` })) })), { userId: USER, label: 'x.json' })
    expect(sql).toContain(`user_id = '${USER}'::uuid`)
    expect(sql).toContain(`id IN ('R03_S_RK'::text, 'H29_S_RS'::text)`)
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/)
  })
})

describe('toSentakuApplySql', () => {
  const sql = toSentakuApplySql(valid(question()), { userId: USER, label: 'x.json' })

  it('問は新規だけ作り、既存は触らない（DO NOTHING）', () => {
    expect(sql).toContain('INSERT INTO lic_questions')
    expect(sql).toContain('ON CONFLICT (user_id, id) DO NOTHING;')
    expect(sql).toContain(`('R03_S_RK'::text, 'R03'::text, 'sentaku'::text, 'RK'::text, 'rouki'::text, NULL::integer, NULL::text,`)
    expect(sql).toContain(`'ippon'::text, NULL::text)`)
  })

  it('空欄は6列だけ上書きし（truth_source は book にして公式の再取り込みから守る）、origin_statement・truth・law_status・law_note は更新しない', () => {
    const set = sql.slice(sql.indexOf('INSERT INTO lic_items'))
    const update = set.slice(set.indexOf('DO UPDATE SET'), set.indexOf('COMMIT'))
    expect(update).toContain('statement = EXCLUDED.statement')
    expect(update).toContain('explanation = EXCLUDED.explanation')
    expect(update).toContain('explanation_source = EXCLUDED.explanation_source')
    expect(update).toContain('explanation_verified = EXCLUDED.explanation_verified')
    expect(update).toContain('study_subject = EXCLUDED.study_subject')
    expect(update).toContain('truth_source = EXCLUDED.truth_source')
    for (const col of ['origin_statement', 'truth', 'law_status', 'law_note', 'topic_id', 'importance']) {
      expect(update).not.toContain(`${col} =`)
    }
    expect(sql.split('\n').filter(l => !l.startsWith('--')).join('\n')).not.toContain('origin_statement')
  })

  it('新規の空欄は truth=NULL・law_status=ok・論点と重要度なし、解説の有無で explanation_source が変わる', () => {
    expect(sql).toContain(`('R03_S_RK_B'::text, 'R03_S_RK'::text, 'B'::text, 'B'::text, '段落2［B］を補う。'::text, NULL::boolean, 'book'::text, '（法21条）'::text, 'book'::text, TRUE, NULL::text, NULL::text, 'ok'::text, NULL::text, 'rouki'::text, 'RK'::text)`)
    expect(sql).toContain(`('R03_S_RK_D'::text, 'R03_S_RK'::text, 'D'::text, 'D'::text, '段落4［D］を補う。'::text, NULL::boolean, 'book'::text, NULL::text, 'none'::text, FALSE, NULL::text, NULL::text, 'ok'::text, NULL::text, 'anei'::text, 'RK'::text)`)
  })

  it('既存の answer_spec が書籍と違えば中止する（トランザクション内の例外）', () => {
    expect(sql).toContain('BEGIN;')
    expect(sql).toContain('RAISE EXCEPTION')
    expect(sql).toContain('IS DISTINCT FROM b.blanks')
    expect(sql).toContain(`q.answer_spec->'blanks' IS DISTINCT FROM b.blanks`)
    expect(sql.indexOf('RAISE EXCEPTION')).toBeLessThan(sql.indexOf('INSERT INTO lic_questions'))
  })

  it('中止条件は語句を NFKC 正規化して空白を除いて比べ、空欄ごとの語群も見る', () => {
    expect(sql).toContain(`regexp_replace(normalize(t.v, NFKC), '\\s', '', 'g')`)
    expect(sql).toContain(`FROM jsonb_each_text(q.answer_spec->'wordbank') AS t(k, v)`)
    expect(sql).toContain(`FROM jsonb_each_text(b.wordbank) AS t(k, v)`)
    expect(sql).toContain(`q.answer_spec->'groups' IS DISTINCT FROM b.groups`)
  })

  it('空欄ごとの語群がある問は answer_spec と中止条件に groups を入れる。無い問は NULL', () => {
    const groups = { A: [1, 2, 3, 4], B: [5, 6, 7, 8], C: [9, 10, 11, 12], D: [13, 14, 15, 16], E: [17, 18, 19, 20] }
    const g = toSentakuApplySql(valid(question({ blanks: { A: 3, B: 6, C: 12, D: 13, E: 19 }, groups })), { userId: USER, label: 'x' })
    expect(g).toContain(`"groups":{"A":[1,2,3,4],"B":[5,6,7,8],"C":[9,10,11,12],"D":[13,14,15,16],"E":[17,18,19,20]}`)
    expect(g).toContain(`'{"A":[1,2,3,4],"B":[5,6,7,8],"C":[9,10,11,12],"D":[13,14,15,16],"E":[17,18,19,20]}'::jsonb)\n    )`)
    expect(sql).not.toContain('"groups"')
    expect(sql).toContain('NULL::jsonb)\n    )')
  })

  it('削除系の文を含まず、最後に件数の確認がある', () => {
    expect(sql).not.toMatch(/\b(DELETE|DROP|TRUNCATE)\b/)
    expect(sql).toContain('SELECT 5 AS expected, count(*) AS stored')
  })

  it("本文中の ' は二重にする", () => {
    const items = LABELS.map(l => ({ label: l, statement: `it's［${l}］`, study_subject: 'rousai' }))
    const out = toSentakuApplySql(valid(question({ question_id: 'R03_S_RS', items })), { userId: USER, label: 'x' })
    expect(out).toContain(`'it''s［A］'::text`)
  })

  it('user を省略すると利用者が1人かを確かめるガードが入る', () => {
    const out = toSentakuApplySql(valid(question()), { label: 'x' })
    expect(out).toContain('SELECT count(*) FROM auth.users')
    expect(out).toContain('(SELECT id FROM auth.users)')
  })
})
