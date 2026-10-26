// 書籍の選択式（空欄補充）の検証・公式との突合（docs/book-ingest/sentaku-spec.md）。
import { describe, expect, it } from 'vitest'
import {
  compareWithOfficial, formatSentakuSummary, missingQuestionIds, summarizeSentaku, validateSentaku,
} from './sentakuSchema'
import type { ValidSentaku } from './sentakuSchema'
import fixtureRaw from '../../../../scripts/license/fixtures/ippon-sentaku-fixture.json?raw'

const wordbank = () => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), `語${i + 1}`]))
const LABELS = ['A', 'B', 'C', 'D', 'E']

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

const reasonsOf = (input: unknown[], opts = {}) => validateSentaku(input, opts).errors.flatMap(e => e.reasons)

describe('validateSentaku', () => {
  it('正しい問から問ID・空欄IDを作る（労基安衛は空欄ごとの学習科目、問は rouki）', () => {
    const { valid, errors } = validateSentaku([question()])
    expect(errors).toEqual([])
    expect(valid[0]).toMatchObject({ questionId: 'R03_S_RK', year: 'R03', scoredSubject: 'RK', studySubject: 'rouki' })
    expect(valid[0].items.map(i => i.itemId)).toEqual(['R03_S_RK_A', 'R03_S_RK_B', 'R03_S_RK_C', 'R03_S_RK_D', 'R03_S_RK_E'])
    expect(valid[0].items.map(i => i.studySubject)).toEqual(['rouki', 'rouki', 'rouki', 'anei', 'anei'])
    expect(valid[0].items[1].explanation).toBe('（法21条）')
    expect(valid[0].items[0].explanation).toBeNull()
  })

  it('労災は study_subject を省略でき、rousai になる', () => {
    const items = LABELS.map(l => ({ label: l, statement: `［${l}］` }))
    const { valid, errors } = validateSentaku([question({ question_id: 'H29_S_RS', items })])
    expect(errors).toEqual([])
    expect(valid[0].studySubject).toBe('rousai')
    expect(valid[0].items.every(i => i.studySubject === 'rousai')).toBe(true)
  })

  it('労基安衛は空欄ごとの study_subject を省略できない', () => {
    const items = LABELS.map(l => ({ label: l, statement: `［${l}］` }))
    expect(reasonsOf([question({ items })])).toHaveLength(5)
    expect(reasonsOf([question({ items })]).join()).toContain('study_subject が無い')
  })

  it('本書に無い科目・択一式のID・形式の誤りを失敗にする', () => {
    expect(reasonsOf([question({ question_id: 'R03_S_KY' })]).join()).toContain('RK / RS のみ')
    expect(reasonsOf([question({ question_id: 'R03_T_RK_01' })]).join()).toContain('question_id の形式が不正')
    expect(reasonsOf([question({ question_id: 'R3_S_RK' })]).join()).toContain('question_id の形式が不正')
    expect(reasonsOf([question({ question_id: undefined })])).toContain('question_id が無い・空')
  })

  it('学習科目が選択式の科目に含まれないものを失敗にする', () => {
    const items = LABELS.map(l => ({ label: l, statement: `［${l}］`, study_subject: 'anei' }))
    expect(reasonsOf([question({ question_id: 'R03_S_RS', items })]).join()).toContain('学習科目 anei は RS の選択式に含まれない')
    expect(reasonsOf([question({ items: [{ ...question().items[0], study_subject: 'kenpo' }, ...question().items.slice(1)] })]).join())
      .toContain('学習科目 kenpo は RK の選択式に含まれない')
  })

  it('語群は20語そろい、語句が空でないこと', () => {
    const short = wordbank()
    delete (short as Record<string, string>)['13']
    expect(reasonsOf([question({ wordbank: short })]).join()).toContain('足りない番号: 13')
    expect(reasonsOf([question({ wordbank: { ...wordbank(), '21': '余分' } })]).join()).toContain('範囲外の番号: 21')
    expect(reasonsOf([question({ wordbank: { ...wordbank(), '5': ' ' } })]).join()).toContain('語群 5 の語句が空')
    expect(reasonsOf([question({ wordbank: undefined })])).toContain('wordbank が無い・オブジェクトでない')
  })

  it('解答は A〜E の5件で、値が語群の番号であること', () => {
    expect(reasonsOf([question({ blanks: { A: 3, B: 7, C: 11, D: 16 } })])).toEqual(['blanks に空欄 E が無い'])
    expect(reasonsOf([question({ blanks: { A: 3, B: 7, C: 11, D: 16, E: 21 } })]).join()).toContain('blanks.E が語群の番号')
    expect(reasonsOf([question({ blanks: { A: 3, B: 7, C: 11, D: 16, E: '20' } })]).join()).toContain('blanks.E が語群の番号')
    expect(reasonsOf([question({ blanks: { A: 3, B: 7, C: 11, D: 16, E: 20, F: 1 } })])).toEqual(['blanks に A〜E 以外の空欄: F'])
  })

  it('空欄ごとの本文: 5件そろい、重複なし、自分の ［X］ を含むこと', () => {
    const items = question().items
    expect(reasonsOf([question({ items: items.slice(0, 4) })])).toEqual(['items に空欄 E が無い（A〜E の5件が必要）'])
    expect(reasonsOf([question({ items: [...items, items[0]] })])).toEqual(['空欄 A が重複'])
    expect(reasonsOf([question({ items: [{ ...items[0], statement: '空欄の印が無い' }, ...items.slice(1)] })]).join())
      .toContain('statement に ［A］ が無い')
    expect(reasonsOf([question({ items: [{ ...items[0], statement: '半角[A]では不可' }, ...items.slice(1)] })]).join())
      .toContain('全角の ［A］ に統一')
    expect(reasonsOf([question({ items: [{ ...items[0], label: 'F' }, ...items.slice(1)] })]).join()).toContain('label が A〜E でない')
  })

  it('不明な項目（綴りの誤り）を失敗にする。_meta は許す', () => {
    expect(reasonsOf([question({ wordbnak: {} })]).join()).toContain('不明な項目（綴りの誤り？）: wordbnak')
    expect(reasonsOf([question({ _meta: { page: 404 } })])).toEqual([])
    expect(reasonsOf([question({ items: [{ ...question().items[0], truth: true }, ...question().items.slice(1)] })]).join())
      .toContain('items[0] に不明な項目: truth')
  })

  it('問IDの重複は該当の全問を失敗にする', () => {
    const { valid, errors } = validateSentaku([question(), question(), question({ question_id: 'R04_S_RK' })])
    expect(valid.map(v => v.questionId)).toEqual(['R04_S_RK'])
    expect(errors.map(e => e.index)).toEqual([0, 1])
    expect(errors[0].reasons[0]).toContain('問IDが重複: R03_S_RK')
  })

  it('配列でない入力・オブジェクトでない問を失敗にする', () => {
    expect(validateSentaku({}).errors[0].reasons).toEqual(['JSON の最上位が問の配列でない'])
    expect(validateSentaku([3]).errors[0].reasons).toEqual(['問がオブジェクトでない'])
  })

  it('フィクスチャ年度（R98・R99）は --fixture のときだけ通る', () => {
    const fx = JSON.parse(fixtureRaw)
    expect(validateSentaku(fx, { fixture: true }).errors).toEqual([])
    expect(validateSentaku(fx, { fixture: true }).valid).toHaveLength(2)
    expect(reasonsOf(fx).join()).toContain('フィクスチャ専用の年度')
    expect(reasonsOf([question()], { fixture: true }).join()).toContain('フィクスチャの取り込みでは年度は R98/R99 のみ')
  })
})

const validOf = (over: Record<string, unknown> = {}): ValidSentaku => validateSentaku([question(over)]).valid[0]

describe('compareWithOfficial', () => {
  const official = () => ({ kind: 'sentaku' as const, blanks: { A: 3, B: 7, C: 11, D: 16, E: 20 }, wordbank: wordbank() })

  it('正答と語群が一致すれば null', () => {
    expect(compareWithOfficial(validOf(), official())).toBeNull()
  })

  it('空欄の正答・語群の語句の食い違いを理由つきで返す', () => {
    const o = official()
    o.blanks.C = 12
    o.wordbank['4'] = '別の語'
    const d = compareWithOfficial(validOf(), o)
    expect(d?.questionId).toBe('R03_S_RK')
    expect(d?.reasons).toEqual(['空欄 C の正答: 書籍 11 / 公式 12', '語群 4: 書籍「語4」/ 公式「別の語」'])
  })

  it('公式が選択式でない・無いときは食い違いにする', () => {
    expect(compareWithOfficial(validOf(), null)?.reasons).toEqual(['公式の answer_spec が選択式でない・無い'])
    expect(compareWithOfficial(validOf(), { kind: 'combo', correct: 1 })?.reasons).toHaveLength(1)
  })

  it('公式の groups（R08 の空欄ごとの語群）は比較の対象にせず、書籍と無関係に許す', () => {
    expect(compareWithOfficial(validOf(), { ...official(), groups: { A: [1, 2, 3] } })).toBeNull()
  })
})

describe('件数・網羅', () => {
  it('summarizeSentaku は問・空欄・科目別・年度別を数える', () => {
    const valid = validateSentaku([question(), question({ question_id: 'H29_S_RS', items: LABELS.map(l => ({ label: l, statement: `［${l}］` })) })]).valid
    const s = summarizeSentaku(valid)
    expect(s).toMatchObject({
      questions: 2, blanks: 10, byYear: { H29: 1, R03: 1 }, byScoredSubject: { RK: 1, RS: 1 },
      byStudySubject: { anei: 2, rouki: 3, rousai: 5 },
    })
    expect(formatSentakuSummary(s)[0]).toBe('問 2 件（空欄 10 件）')
  })

  it('missingQuestionIds は期待の20問（H29〜R08 × RK・RS）の不足を返す', () => {
    expect(missingQuestionIds([])).toHaveLength(20)
    const one = validateSentaku([question()]).valid
    const missing = missingQuestionIds(one)
    expect(missing).toHaveLength(19)
    expect(missing).not.toContain('R03_S_RK')
    expect(missing).toContain('R03_S_RS')
    expect(missing[0]).toBe('H29_S_RK')
  })
})
