// 法改正の確認待ち（unchecked / review）の肢を、復習キュー・肢モード・一括コピー・集計に入れない（§9・§15 の12）。
import { describe, expect, it } from 'vitest'
import type { LawStatus } from '../../domain/license'
import { isAskableItem, type ItemBody } from './itemBody'
import { pickBatch } from './batchGrade'
import { buildSubjectChapters } from './ingest/master'
import {
  LAW_DECISIONS, PENDING_LAW_STATUSES, filterLawCleared, groupPending, isLawCleared, isLawPending, lawDecisionNote, lawStatusLabel,
} from './lawStatus'

const ALL: LawStatus[] = ['ok', 'unchecked', 'review', 'excluded']

const body = (id: string, law_status: LawStatus): ItemBody => ({
  id, question_id: id.slice(0, -2), label: 'A', statement: `架空の本文 ${id}`, truth: true,
  explanation: null, explanation_source: 'none', law_status, study_subject: 'rouki', scored_subject: 'RK',
})

describe('isLawCleared / isLawPending', () => {
  it('ok だけが出題・集計の対象', () => {
    expect(ALL.filter(isLawCleared)).toEqual(['ok'])
    expect(isLawCleared(null)).toBe(false)
    expect(isLawCleared(undefined)).toBe(false)
  })
  it('unchecked / review が確認待ち（要確認一覧）', () => {
    expect(ALL.filter(isLawPending)).toEqual(['unchecked', 'review'])
    expect(PENDING_LAW_STATUSES).toEqual(['unchecked', 'review'])
    expect(LAW_DECISIONS).toEqual(['ok', 'review', 'excluded'])
  })
})

describe('確認待ちの肢を出題・集計に入れない', () => {
  const ids = ALL.map((_, i) => `R97_T_RK_0${i + 1}_A`)
  const bodies = Object.fromEntries(ids.map((id, i) => [id, body(id, ALL[i])]))

  it('肢モード: ok 以外は出題しない', () => {
    expect(ids.filter(id => isAskableItem(bodies[id]))).toEqual([ids[0]])
  })
  it('一括コピー: ok 以外は選ばない', () => {
    expect(pickBatch(ids, bodies, 10)).toEqual([ids[0]])
  })
  it('復習キュー・集計: マスター索引に ok 以外を載せない', () => {
    const rows = ids.map((id, i) => ({ id, topic_id: '架空の論点', importance: null, law_status: ALL[i] }))
    const { kept, dropped } = filterLawCleared(rows)
    expect(kept.map(r => r.id)).toEqual([ids[0]])
    expect(dropped.map(r => r.law_status)).toEqual(['unchecked', 'review', 'excluded'])
    const chapters = buildSubjectChapters(kept, { id: 'rouki', name: '労基' })
    expect(chapters.flatMap(c => c.questions.map(q => q.id))).toEqual([ids[0]])
    expect(chapters.reduce((a, c) => a + c.totalCount, 0)).toBe(1)
  })
  it('law_status の無い行（取得列の漏れ）は載せない側に倒す', () => {
    expect(filterLawCleared<{ id: string; law_status?: string }>([{ id: 'x' }]).kept).toEqual([])
  })
})

describe('lawDecisionNote', () => {
  it('判定日・基準日・判定を1行にまとめる（改行は空白に）', () => {
    expect(lawDecisionNote('ok', ' 架空法 第1条を確認\n改正なし ', '2026-04-10', '2026-10-14'))
      .toBe('[判定 2026-10-14 基準日 2026-04-10] 確認済み: 架空法 第1条を確認 改正なし')
    expect(lawDecisionNote('excluded', '', '2026-04-10', '2026-10-14')).toBe('[判定 2026-10-14 基準日 2026-04-10] 除外')
    expect(lawStatusLabel('review')).toBe('要確認')
  })
})

describe('groupPending', () => {
  it('確認待ちだけを年度（新しい順）・科目別に数える', () => {
    const rows = [
      { year: 'R07', subject: 'RK', law_status: 'review' },
      { year: 'R08', subject: 'RS', law_status: 'unchecked' },
      { year: 'R08', subject: 'KH', law_status: 'review' },
      { year: 'R08', subject: 'KH', law_status: 'unchecked' },
      { year: 'R08', subject: 'KH', law_status: 'ok' },
      { year: 'R07', subject: 'RK', law_status: 'excluded' },
    ]
    expect(groupPending(rows)).toEqual([
      { year: 'R08', subject: 'KH', unchecked: 1, review: 1 },
      { year: 'R08', subject: 'RS', unchecked: 1, review: 0 },
      { year: 'R07', subject: 'RK', unchecked: 0, review: 1 },
    ])
  })
})
