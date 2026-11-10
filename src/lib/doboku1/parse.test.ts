import { describe, expect, it } from 'vitest'
import { parseAnswerKey, parseQuestions } from './parse.ts'
import { buildYear } from './build.ts'
import type { YearIndex } from '../../data/doboku1/categories.ts'

// 合成の抽出テキスト（実際の試験問題の本文は使わない）
const TEXT_A = `=== page 2
※　問題番号 No.1 ～ No.2 までの 2 問題は，必須問題ですから全問題を解答してください。
【No. 1】 架空の材料に関する記述のうち，適当でないも
のはどれか。
⑴　記述その一。
⑵　記述その二は長いので折り返して
続く。
⑶　記述その三。
⑷　記述その四。
― 1 ―
=== page 3
【No. 2】 架空の作業に関する文章中の 　　  のイ～ロに当てはまる語句の組合せとして，適当なものはどれか。
・作業では 　イ  を確認し，次に 　ロ  を行う。
  イ  ロ
⑴　甲    乙
⑵　丙    丁
⑶　甲    丁
⑷　丙    乙
`
const TEXT_B = `【No. 1】 架空の管理に関する①～④の記述のうち，適当なもののみを全てあげている組合せはどれか。
①　記述A。
②　記述B。
③　記述C。
④　記述D。
⑴　①②
⑵　①③
⑶　②④
⑷　③④
`
const KEY = ['●正答肢', '1', '2', '4', '1', '問題番号', '1', '4', '問題番号'].join('\n')

describe('parseQuestions', () => {
  it('単一選択・折り返し・ページ区切りを読む', () => {
    const [q] = parseQuestions(TEXT_A, 'A')
    expect(q.no).toBe(1)
    expect(q.stem).toBe('架空の材料に関する記述のうち，適当でないものはどれか。')
    expect(q.direction).toBe('wrong')
    expect(q.kind).toBe('single')
    expect(q.choices[1]).toEqual(['記述その二は長いので折り返して続く。'])
  })
  it('空欄補充は ［イ］ に正規化し、表を列に分ける', () => {
    const q = parseQuestions(TEXT_A, 'A')[1]
    expect(q.kind).toBe('fill')
    expect(q.stem).toContain('［イ］を確認し')
    expect(q.choiceHeader).toEqual(['イ', 'ロ'])
    expect(q.choices[2]).toEqual(['甲', '丁'])
  })
  it('①〜④の組合せを読む', () => {
    const [q] = parseQuestions(TEXT_B, 'B')
    expect(q.kind).toBe('statements')
    expect(q.statements).toEqual(['記述A。', '記述B。', '記述C。', '記述D。'])
    expect(q.choices[0]).toEqual(['①②'])
  })
})

describe('parseAnswerKey', () => {
  it('A の表、続いて B の表を読む', () => {
    const k = parseAnswerKey(KEY)
    expect([...k.A]).toEqual([[1, 4], [2, 1]])
    expect([...k.B]).toEqual([[1, 4]])
  })
})

describe('buildYear（検証ゲート）', () => {
  const idx: YearIndex = {
    year: 'R98', total: { A: 2, B: 1 },
    groups: [
      { paper: 'A', from: 1, to: 2, answerCount: 2, required: true, label: 'A必須' },
      { paper: 'B', from: 1, to: 1, answerCount: 1, required: true, label: 'B必須' },
    ],
    spans: [['A', 1, 2, 'dokou'], ['B', 1, 1, 'keikaku']],
  }
  const parsed = { A: parseQuestions(TEXT_A, 'A'), B: parseQuestions(TEXT_B, 'B') }
  const key = parseAnswerKey(KEY)

  it('合格した年度は行を作る', () => {
    const r = buildYear(idx, parsed, key)
    expect(r.errors).toEqual([])
    expect(r.rows.map(x => x.id)).toEqual(['D1_R98_A_01', 'D1_R98_A_02', 'D1_R98_B_01'])
    expect(r.rows[0]).toMatchObject({ correct: 4, category: 'dokou', required: true, topic: '架空の材料' })
  })
  it('同じ内容の選択肢（式の崩れ）を検出する', () => {
    const r = buildYear(idx, parsed, key, { A01: { choices: [['x'], ['x'], ['y'], ['z']] } })
    expect(r.errors.some(e => e.includes('同じ内容の選択肢'))).toBe(true)
  })
  it('解説の肢チェックが正答と食い違えば不合格', () => {
    const checks = [1, 2, 3, 4].map(i => ({ label: `⑴`, ok: i !== 1, note: '' }))  // 正答は4（適当でない）なのに⑴を×にしている
    const r = buildYear(idx, parsed, key, {}, { A01: { explain: { point: 'p', figures: [], checks } } })
    expect(r.errors.some(e => e.includes('食い違う'))).toBe(true)
  })
})
