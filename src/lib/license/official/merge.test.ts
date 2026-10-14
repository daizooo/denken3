// 書籍の肢との突き合わせ・保存する行・SQL の生成（licensehub-expansion.md §4.1・§14・PR-D）。
import { describe, expect, it } from 'vitest'
import type { OfficialItemRow, OfficialQuestionRow } from './build'
import { formatMatchReport, ITEM_COLUMNS, matchWithExisting, mergeItem } from './merge'
import { sqlLiteral, toCheckSql, toIngestSql } from './sql'

const official = (over: Partial<OfficialItemRow> = {}): OfficialItemRow => ({
  id: 'R99_T_RK_01_A', question_id: 'R99_T_RK_01', label: 'A', label_raw: 'A',
  statement: '公式の原文', origin_statement: '公式の原文', truth: false, truth_source: 'derived',
  explanation: null, explanation_source: 'none', explanation_verified: false, topic_id: null, importance: null,
  law_status: 'unchecked', law_note: null, study_subject: 'rouki', scored_subject: 'RK', ...over,
})

const book = (over: Partial<OfficialItemRow> = {}): OfficialItemRow => official({
  statement: '書籍の改題', origin_statement: null, truth: true, truth_source: 'book',
  explanation: '書籍の解説', explanation_source: 'book', explanation_verified: true, topic_id: '01 総則', importance: 'A',
  law_status: 'ok', study_subject: 'anei', ...over,
})

describe('mergeItem（列ごとの規則）', () => {
  it('既存が無ければ公式の行そのもの', () => {
    expect(mergeItem(undefined, official())).toEqual(official())
  })

  it('書籍の肢: statement・truth・解説・論点・law_status は残し、公式の原文を origin_statement に入れる', () => {
    expect(mergeItem(book(), official())).toEqual(book({ origin_statement: '公式の原文' }))
  })

  it('公式由来の既存行（再実行）: 本文・truth は公式で更新、law_status（PR-K の確認）は据え置く', () => {
    const prev = official({ statement: '古い抽出', truth: null, law_status: 'ok', law_note: '確認済み' })
    expect(mergeItem(prev, official())).toEqual(official({ law_status: 'ok', law_note: '確認済み' }))
  })

  it('問題誤りで除外する肢は、書籍の肢でも excluded にする', () => {
    const merged = mergeItem(book(), official({ law_status: 'excluded', law_note: '除外' }))
    expect(merged).toMatchObject({ law_status: 'excluded', law_note: '除外', statement: '書籍の改題', truth: true })
  })

  it('規則はすべての列に決まっている', () => {
    expect(ITEM_COLUMNS).toEqual(Object.keys(official()))
  })
})

describe('matchWithExisting', () => {
  it('一致・新規・truth と学習科目の食い違い・座標の合わない書籍の肢・個数の不一致を一覧にする', () => {
    const items = [
      official(), official({ id: 'R99_T_RK_01_B', truth: true }), official({ id: 'R99_T_RK_01_C', truth: null }),
      official({ id: 'R99_T_RK_02_A', question_id: 'R99_T_RK_02', truth: null }),
    ]
    const existing = [
      book(), book({ id: 'R99_T_RK_01_B', truth: true, study_subject: 'rouki' }), book({ id: 'R99_T_RK_01_C', truth: false, study_subject: 'rouki' }),
      book({ id: 'R99_T_RK_01_X' as string, study_subject: 'rouki' }),
      ...['A', 'B', 'C', 'D', 'E'].map(l => book({ id: `R99_T_RK_03_${l}`, question_id: 'R99_T_RK_03', truth: l < 'C' })),
    ]
    const r = matchWithExisting(items, existing, [{ questionId: 'R99_T_RK_03', direction: 'right', count: 3 }])
    expect(r).toMatchObject({ officialItems: 4, matchedBook: 3, matchedOfficial: 0, newItems: 1 })
    expect(r.truthConflicts).toEqual([{ id: 'R99_T_RK_01_A', book: true, official: false }])   // null（未導出）は食い違いにしない
    expect(r.studyConflicts).toEqual([{ id: 'R99_T_RK_01_A', book: 'anei', official: 'rouki' }])
    expect(r.unmatchedBook).toEqual(['R99_T_RK_01_X'])
    expect(r.countConflicts).toEqual([{ questionId: 'R99_T_RK_03', expected: 3, bookTrue: 2 }])
    const text = formatMatchReport(r).join('\n')
    expect(text).toContain('R99_T_RK_01_A: 書籍 ○ / 公式から導出 ×')
    expect(text).toContain('R99_T_RK_03: 正答から ○ 3 個 / 書籍 ○ 2 個')
  })

  it('食い違いが無ければそう書く', () => {
    expect(formatMatchReport(matchWithExisting([official()], [])).at(-1)).toContain('食い違いなし')
  })
})

describe('SQL の生成（利用者が SQL エディタで実行する）', () => {
  const q: OfficialQuestionRow = {
    id: 'R99_T_RK_01', year: 'R99', format: 'taku', scored_subject: 'RK', study_subject: 'rouki', q_no: 1,
    stem: "労働者の'引用'を含む問", answer_spec: { kind: 'one', direction: 'wrong', correct: 1 }, source: 'honshiken', holdout_group: null,
  }

  it('値を型つきのリテラルにする（引用符のエスケープ・NULL の型）', () => {
    expect(sqlLiteral("a'b")).toBe("'a''b'::text")
    expect(sqlLiteral(null, 'integer')).toBe('NULL::integer')
    expect(sqlLiteral({ a: "x'y" }, 'jsonb')).toBe(`'{"a":"x''y"}'::jsonb`)
    expect(sqlLiteral(true, 'boolean')).toBe('TRUE')
    expect(() => sqlLiteral(1.5, 'integer')).toThrow()
  })

  it('ingest: トランザクション、利用者の確認、列ごとの ON CONFLICT 規則、件数の確認', () => {
    const sql = toIngestSql([q], [official()], { label: 'R99 択一' })
    expect(sql).toMatch(/^-- 公式PDF/)
    expect(sql).toContain('BEGIN;')
    expect(sql).toContain("RAISE EXCEPTION '利用者が1人ではありません")
    expect(sql).toContain("'労働者の''引用''を含む問'::text")
    expect(sql).toContain("statement = CASE WHEN lic_items.truth_source = 'book' THEN lic_items.statement ELSE EXCLUDED.statement END")
    expect(sql).toContain('origin_statement = EXCLUDED.origin_statement')
    expect(sql).toContain("law_status = CASE WHEN EXCLUDED.law_status = 'excluded' THEN EXCLUDED.law_status ELSE lic_items.law_status END")
    expect(sql).not.toMatch(/explanation = /)
    expect(sql).toContain('stem = EXCLUDED.stem')
    expect(sql).toContain("SELECT 1 AS expected")
  })

  it('--user を与えると UUID を直接使う（形式が不正なら作らない）', () => {
    const sql = toIngestSql([q], [official()], { label: 'x', userId: '11111111-1111-1111-1111-111111111111' })
    expect(sql).not.toContain('RAISE EXCEPTION')
    expect(sql).toContain("'11111111-1111-1111-1111-111111111111'::uuid")
    expect(() => toIngestSql([q], [official()], { label: 'x', userId: 'abc' })).toThrow()
  })

  it('check: 読み出しのみ（INSERT/UPDATE/DELETE を含まない）', () => {
    const sql = toCheckSql([official()], { label: 'R99' })
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/)
    expect(sql).toContain("'truth_conflict'")
    expect(sql).toContain("'unmatched_book'")
  })
})
