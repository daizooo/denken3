// ○×を付けた組合せの問（R6 労基 問2 の型。肢はア〜ウなど5つより少ない）。本物の本文は入れず、書式だけを架空の文で再現する。
import { describe, expect, it } from 'vitest'
import { parseTakuText } from './parseTaku'
import { buildOfficialYear, deriveTruths } from './build'
import { ITEM_LABELS } from '../../../domain/license'
import type { OfficialAnswers, OfficialTakuQuestion, OfficialYear } from './types'

const TEXT = [
  '労働基準法及び労働安全衛生法',
  '〔問 1〕 架空規程の解釈に関する次のアからウまでの各記述について、正しいも',
  'のには○、誤っているものには×を付した場合の組合せとして、正しいもの',
  'はどれか。',
  'ア 架空の記述アで、折り返して',
  '続く記述である。',
  'イ 架空の記述イである。',
  'ウ 架空の記述ウである。',
  'Ａ （ア○ イ○ ウ○） Ｂ （ア○ イ○ ウ×）',
  'Ｃ （ア○ イ× ウ○） Ｄ （ア× イ○ ウ×）',
  'Ｅ （ア× イ× ウ○）',
].join('\n')

describe('○×の組合せ（parseTakuText）', () => {
  it('肢が3つでも選択肢で切り、選択肢ごとの ○× を読む', () => {
    const [q] = parseTakuText(TEXT, 'R99').questions
    expect(q.kind).toBe('marks')
    expect(q.direction).toBe('right')   // 問いの文の「誤っている」に引きずられない
    expect(q.items.map(i => `${i.labelRaw}:${i.text}`)).toEqual(['ア:架空の記述アで、折り返して続く記述である。', 'イ:架空の記述イである。', 'ウ:架空の記述ウである。'])
    expect(q.choices).toEqual(['ア○ イ○ ウ○', 'ア○ イ○ ウ×', 'ア○ イ× ウ○', 'ア× イ○ ウ×', 'ア× イ× ウ○'])
    expect(q.markPatterns).toEqual([[true, true, true], [true, true, false], [true, false, true], [false, true, false], [false, false, true]])
  })

  it('truth は選んだ選択肢の ○× そのもの', () => {
    const [q] = parseTakuText(TEXT, 'R99').questions
    expect(deriveTruths(q, 3)).toEqual([true, false, true])
  })
})

function oneQuestion(code: string, qNo: number): OfficialTakuQuestion {
  return {
    scoredSubject: code, qNo, kind: 'one', direction: 'wrong',
    lead: '架空の記述のうち、誤っているものはどれか。',
    items: ITEM_LABELS.map(l => ({ labelRaw: l, label: l, text: `架空の記述${l}` })),
    choices: [], comboPairs: null, countOptions: null,
  }
}

function yearWithMarks(marks: OfficialTakuQuestion): OfficialYear {
  const codes = ['RK', 'RS', 'KY', 'IP', 'KH', 'KO', 'KN']
  const taku = codes.flatMap(c => Array.from({ length: 10 }, (_, i) => (c === 'RK' && i === 1 ? marks : oneQuestion(c, i + 1))))
  const answers: OfficialAnswers = { taku: Object.fromEntries(codes.map(c => [c, [...'ACCDEABCDE'] as OfficialAnswers['taku'][string]])), sentaku: {} }
  return { year: 'R99', taku, sentaku: null, answers }
}

describe('○×の組合せ（ゲート・DB行）', () => {
  const marks: OfficialTakuQuestion = { ...parseTakuText(TEXT, 'R99').questions[0], qNo: 2 }

  it('肢の数だけ行を作り、件数のゲートは 350 から足りない肢の数を引いて判定する', () => {
    const unit = buildOfficialYear(yearWithMarks(marks), { fixture: true })[0]
    expect(unit.passed).toBe(true)
    expect(unit.items).toHaveLength(348)
    const q = unit.questions.find(x => x.id === 'R99_T_RK_02')!
    expect(q.answer_spec).toEqual({ kind: 'marks', correct: 3 })
    expect(q.stem).toContain('A（ア○ イ○ ウ○）　B（ア○ イ○ ウ×）')
    const items = unit.items.filter(i => i.question_id === 'R99_T_RK_02')
    expect(items.map(i => `${i.label}/${i.label_raw}:${i.truth}`)).toEqual(['A/ア:true', 'B/イ:false', 'C/ウ:true'])
  })

  it('選択肢の ○× が肢の数と合わなければ失敗', () => {
    const bad = { ...marks, markPatterns: marks.markPatterns!.map((p, i) => (i === 0 ? p.slice(0, 2) : p)) }
    const unit = buildOfficialYear(yearWithMarks(bad), { fixture: true })[0]
    expect(unit.passed).toBe(false)
    expect(unit.issues.map(i => i.reason)).toContain('○×の組合せの選択肢が5つ（各 3 肢）読めない: ア○ イ○ ウ○ / ア○ イ○ ウ× / ア○ イ× ウ○ / ア× イ○ ウ× / ア× イ× ウ○')
  })
})
