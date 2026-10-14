// 本番形式模試の採点・判定（licensehub-expansion.md §7・§15）。本文は使わない（正答の形だけの架空データ）。
import { describe, expect, it } from 'vitest'
import type { AnswerSpec } from '../../domain/license'
import type { MockAnswer } from '../../domain/types'
import { SHAROUSHI_SCORING, SHAROUSHI_THRESHOLDS } from '../../data/sharoushi/index.ts'
import {
  blankChoices, isPaperReady, isTakuCorrect, isTextAnswered, judgeText, missedItemIds, mockProgress, scoreQuestion, scoreTextPaper,
  takuCorrectLabel,
  type TextMockQuestion,
} from './textMock'

const TAKU = SHAROUSHI_SCORING.sections.find(s => s.id === 'taku')!
const SENTAKU = SHAROUSHI_SCORING.sections.find(s => s.id === 'sentaku')!
const ans = (...selected: number[]): MockAnswer => ({ selected })

const taku = (id: string, scored_subject: string, answer_spec: AnswerSpec | null): TextMockQuestion =>
  ({ id, format: 'taku', scored_subject, answer_spec })

const WORDBANK: Record<string, string> = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => [String(i + 1), `架空語句${i + 1}`]),
)

describe('isTakuCorrect（各問型）', () => {
  it('one: 正答の番号だけが正解', () => {
    const spec: AnswerSpec = { kind: 'one', direction: 'wrong', correct: 3 }
    expect(isTakuCorrect(spec, 3)).toBe(true)
    expect(isTakuCorrect(spec, 2)).toBe(false)
  })
  it('accepted: 公表で複数を正解とした問は、そのいずれも正解', () => {
    const spec: AnswerSpec = { kind: 'one', direction: 'right', correct: 3, accepted: [3, 4] }
    expect(isTakuCorrect(spec, 3)).toBe(true)
    expect(isTakuCorrect(spec, 4)).toBe(true)
    expect(isTakuCorrect(spec, 5)).toBe(false)
  })
  it('combo / count / marks: correct の番号が正解', () => {
    for (const kind of ['combo', 'count', 'marks'] as const) {
      const spec = { kind, correct: 2 } as AnswerSpec
      expect(isTakuCorrect(spec, 2)).toBe(true)
      expect(isTakuCorrect(spec, 1)).toBe(false)
    }
  })
  it('未解答（0）や範囲外は不正解', () => {
    const spec: AnswerSpec = { kind: 'combo', correct: 1 }
    expect(isTakuCorrect(spec, 0)).toBe(false)
    expect(isTakuCorrect(spec, 6)).toBe(false)
  })
})

describe('scoreQuestion', () => {
  it('択一は1問1点。正答の無い問は全員正解（1点）', () => {
    expect(scoreQuestion(taku('R99_T_RK_01', 'RK', { kind: 'count', correct: 4 }), ans(4)).points).toBe(1)
    expect(scoreQuestion(taku('R99_T_RK_01', 'RK', { kind: 'count', correct: 4 }), undefined).points).toBe(0)
    expect(scoreQuestion(taku('R99_T_RK_02', 'RK', null), undefined)).toMatchObject({ points: 1, maxPoints: 1 })
  })
  it('sentaku: 1空欄1点（空欄 A〜E の順に語群の番号）', () => {
    const q: TextMockQuestion = {
      id: 'R99_S_RK', format: 'sentaku', scored_subject: 'RK',
      answer_spec: { kind: 'sentaku', blanks: { A: 1, B: 5, C: 9, D: 13, E: 17 }, wordbank: WORDBANK },
    }
    expect(scoreQuestion(q, ans(1, 5, 9, 13, 17))).toMatchObject({ points: 5, maxPoints: 5 })
    expect(scoreQuestion(q, ans(1, 5, 0, 2, 17)).points).toBe(3)
    expect(scoreQuestion(q, undefined).points).toBe(0)
  })
  it('sentaku: 正答の無い空欄は全員正解', () => {
    const q: TextMockQuestion = {
      id: 'R99_S_KY', format: 'sentaku', scored_subject: 'KY',
      answer_spec: { kind: 'sentaku', blanks: { A: 1, B: 2, C: 3, D: 4 }, wordbank: WORDBANK },
    }
    expect(scoreQuestion(q, ans(1, 0, 0, 0, 0)).points).toBe(2)
  })
})

describe('blankChoices', () => {
  it('空欄ごとの語群がある年度は、その語群だけ', () => {
    const spec: AnswerSpec = { kind: 'sentaku', blanks: { A: 2 }, wordbank: WORDBANK, groups: { A: [1, 2, 3, 4], B: [5, 6, 7, 8] } }
    expect(blankChoices(spec, 'A')).toEqual([1, 2, 3, 4])
    expect(blankChoices(spec, 'B')).toEqual([5, 6, 7, 8])
  })
  it('語群が共通の年度は全語（番号順）', () => {
    const spec: AnswerSpec = { kind: 'sentaku', blanks: { A: 2 }, wordbank: { '10': 'x', '2': 'y', '1': 'z' } }
    expect(blankChoices(spec, 'C')).toEqual([1, 2, 10])
    expect(blankChoices(null, 'A')).toEqual([])
  })
})

describe('judgeText（足切り・2段の判定）', () => {
  const takuScores = (each: number, over: Record<string, number> = {}) =>
    ({ ...Object.fromEntries(TAKU.subjects.map(s => [s.code, each])), ...over })

  it('閾値は SHAROUSHI_THRESHOLDS から来る（択一 47/50・足切り4、選択式 25/30・足切り3）', () => {
    expect(TAKU.passTotal).toBe(SHAROUSHI_THRESHOLDS.taku.passTotal)
    expect(TAKU.targetTotal).toBe(SHAROUSHI_THRESHOLDS.taku.targetTotal)
    expect(TAKU.subjects.every(s => s.floor === SHAROUSHI_THRESHOLDS.taku.floor)).toBe(true)
    expect(SENTAKU.subjects.every(s => s.floor === SHAROUSHI_THRESHOLDS.sentaku.floor)).toBe(true)
  })
  it('択一: 目標以上で足切りなし → 合格圏', () => {
    const j = judgeText(TAKU, takuScores(8))   // 56点
    expect(j.verdict).toBe('safe')
    expect(j.toPass).toBe(0)
    expect(j.toTarget).toBe(0)
  })
  it('択一: 合格基準以上・目標未満 → ボーダー（目標までの差）', () => {
    const j = judgeText(TAKU, takuScores(7, { RK: 6 }))   // 48点
    expect(j.judgement.total).toBe(48)
    expect(j.verdict).toBe('border')
    expect(j.toPass).toBe(0)
    expect(j.toTarget).toBe(2)
  })
  it('択一: 合格基準未満 → 不足（合格基準・目標までの差）', () => {
    const j = judgeText(TAKU, takuScores(6))   // 42点
    expect(j.verdict).toBe('short')
    expect(j.toPass).toBe(5)
    expect(j.toTarget).toBe(8)
  })
  it('択一: 総得点が目標以上でも、足切り（4点未満）が1科目あれば不足。IP は1科目', () => {
    const j = judgeText(TAKU, takuScores(9, { IP: 3 }))   // 57点
    expect(j.judgement.total).toBe(57)
    expect(j.judgement.floorFailures).toEqual(['IP'])
    expect(j.verdict).toBe('short')
  })
  it('択一: ちょうど4点は足切りにならない', () => {
    expect(judgeText(TAKU, takuScores(9, { KN: 4 })).judgement.floorFailures).toEqual([])
  })
  it('選択式: RI・SI は別々に判定する（3点未満で足切り）', () => {
    const scores = { ...Object.fromEntries(SENTAKU.subjects.map(s => [s.code, 5])), RI: 2, SI: 3 }
    const j = judgeText(SENTAKU, scores)
    expect(j.judgement.floorFailures).toEqual(['RI'])
    expect(j.verdict).toBe('short')
  })
  it('選択式: 25点以上30点未満 → ボーダー、30点以上 → 合格圏', () => {
    const base = Object.fromEntries(SENTAKU.subjects.map(s => [s.code, 3]))   // 24点
    expect(judgeText(SENTAKU, base).verdict).toBe('short')
    expect(judgeText(SENTAKU, { ...base, RK: 4 }).verdict).toBe('border')     // 25点
    expect(judgeText(SENTAKU, { ...base, RK: 5, RS: 5, KY: 5, KH: 5 }).verdict).toBe('safe')   // 32点
  })
})

describe('scoreTextPaper', () => {
  it('択一70問を科目別に集計し、判定まで出す', () => {
    const questions: TextMockQuestion[] = []
    const answers: Record<string, MockAnswer> = {}
    for (const s of TAKU.subjects) {
      for (let n = 1; n <= 10; n++) {
        const id = `R99_T_${s.code}_${String(n).padStart(2, '0')}`
        questions.push(taku(id, s.code, { kind: 'one', direction: 'wrong', correct: 1 }))
        // RK は3問だけ正解（足切り）、他は8問正解
        const ok = s.code === 'RK' ? n <= 3 : n <= 8
        answers[id] = ans(ok ? 1 : 2)
      }
    }
    const r = scoreTextPaper(TAKU, questions, answers)
    expect(r.subjectScores).toEqual({ RK: 3, RS: 8, KY: 8, IP: 8, KH: 8, KO: 8, KN: 8 })
    expect(r.total).toBe(51)
    expect(r.judgement.floorFailures).toEqual(['RK'])
    expect(r.verdict).toBe('short')
    expect(r.perQuestion).toHaveLength(70)
  })
  it('問が無い科目も0点として並べる', () => {
    const r = scoreTextPaper(SENTAKU, [], {})
    expect(Object.keys(r.subjectScores)).toEqual(SENTAKU.subjects.map(s => s.code))
    expect(r.total).toBe(0)
    expect(r.judgement.floorFailures).toHaveLength(8)
  })
})

describe('表示用', () => {
  it('isTextAnswered', () => {
    expect(isTextAnswered(undefined)).toBe(false)
    expect(isTextAnswered(ans(0, 0))).toBe(false)
    expect(isTextAnswered(ans(0, 3))).toBe(true)
  })
  it('takuCorrectLabel', () => {
    expect(takuCorrectLabel({ kind: 'one', direction: 'wrong', correct: 3 })).toBe('C')
    expect(takuCorrectLabel({ kind: 'one', direction: 'wrong', correct: 3, accepted: [3, 4] })).toBe('C・D')
    expect(takuCorrectLabel({ kind: 'marks', correct: 5 })).toBe('E')
    expect(takuCorrectLabel(null)).toBe('全員正解')
  })
})

describe('模試の年度と最終期限', () => {
  it('問が揃っていれば年度を問わず解ける（択一70問・選択式8問）', () => {
    expect(isPaperReady(TAKU, 70)).toBe(true)
    expect(isPaperReady(TAKU, 69)).toBe(false)
    expect(isPaperReady(SENTAKU, 8)).toBe(true)
    expect(isPaperReady(SENTAKU, 7)).toBe(false)
  })

  const papers = ['R06', 'R07', 'R08', 'R99'].flatMap(year => (['taku', 'sentaku'] as const).map(format => ({ year, format })))
  it('未受験の年度×式と期限までの日数。フィクスチャは数えない', () => {
    const p = mockProgress(papers, [{ paper_id: 'R07', subject_id: 'taku' }, { paper_id: 'R99', subject_id: 'sentaku' }], '2027-05-31', '2027-05-01')
    expect(p.daysLeft).toBe(30)
    expect(p.done).toEqual([{ year: 'R07', format: 'taku' }])
    expect(p.remaining).toHaveLength(5)
    expect(p.overdue).toBe(false)
  })
  it('期限を過ぎて未受験が残れば overdue。すべて済めば過ぎても overdue でない', () => {
    expect(mockProgress(papers, [], '2027-05-31', '2027-06-01').overdue).toBe(true)
    const all = papers.map(p => ({ paper_id: p.year, subject_id: p.format }))
    expect(mockProgress(papers, all, '2027-05-31', '2027-06-01').overdue).toBe(false)
    expect(mockProgress(papers, [], '2027-05-31', '2027-05-31').daysLeft).toBe(0)
  })
})

describe('missedItemIds（誤答の復習）', () => {
  const wq: TextMockQuestion & { items?: { label: string }[] } = {
    id: 'R99_T_RK_02', format: 'taku', scored_subject: 'RK', answer_spec: { kind: 'marks', correct: 2 },
    items: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
  }
  const sq: TextMockQuestion = {
    id: 'R99_S_RK', format: 'sentaku', scored_subject: 'RK',
    answer_spec: { kind: 'sentaku', blanks: { A: 1, B: 5, C: 9, D: 13 }, wordbank: WORDBANK },
  }
  it('択一は誤答した問の肢すべて（肢が3つの問は3つ）、正解した問は出さない', () => {
    expect(missedItemIds([wq], { [wq.id]: ans(1) })).toEqual(['R99_T_RK_02_A', 'R99_T_RK_02_B', 'R99_T_RK_02_C'])
    expect(missedItemIds([wq], { [wq.id]: ans(2) })).toEqual([])
    expect(missedItemIds([{ ...wq, items: undefined }], {})).toHaveLength(5)
  })
  it('選択式は誤答した空欄だけ。正答の無い空欄（全員正解）は出さない', () => {
    expect(missedItemIds([sq], { [sq.id]: ans(1, 2, 9, 0, 7) })).toEqual(['R99_S_RK_B', 'R99_S_RK_D'])
  })
  it('正答の無い問（全員正解）は出さない', () => {
    expect(missedItemIds([{ ...wq, answer_spec: null }], {})).toEqual([])
  })
})
