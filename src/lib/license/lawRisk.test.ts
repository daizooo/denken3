// 法改正フラグの自動判定（licensehub-expansion.md §9・PR-K）。本文はすべて架空の文。
import { describe, expect, it } from 'vitest'
import type { AnswerSpec } from '../../domain/license'
import {
  DEFAULT_LAW_BASE_DATE, LAW_RISK_MARKER, LAW_RISK_RULES, appendLawNote, flagLawRisk, lawRiskNote, lawRiskText,
  pickLawRiskCandidates, type LawRiskInput,
} from './lawRisk'

describe('flagLawRisk', () => {
  it('期間（〜日以内など）を拾う', () => {
    expect(flagLawRisk('架空の届出は、事由が生じた日から十四日以内に行う。')).toContain('期間')
    expect(flagLawRisk('架空の手当は30日を超える場合に支給する。')).toContain('期間')
    expect(flagLawRisk('架空の期間は六箇月経過後に満了する。')).toContain('期間')
  })
  it('金額・年齢・割合・時間を拾う', () => {
    expect(flagLawRisk('架空の給付は一万二千円を上限とする。')).toContain('金額')
    expect(flagLawRisk('架空の制度は六十五歳に達した者に適用する。')).toContain('年齢')
    expect(flagLawRisk('架空の率は百分の三とする。')).toContain('割合')
    expect(flagLawRisk('架空の割増は2割5分以上とする。')).toContain('割合')
    expect(flagLawRisk('架空の負担は3％である。')).toContain('割合')
    expect(flagLawRisk('架空の休憩は八時間を超える場合に与える。')).toContain('時間')
  })
  it('人数・改正・施行日を拾う', () => {
    expect(flagLawRisk('架空の事業場で常時十人以上の者を使用する場合')).toContain('人数・回数')
    expect(flagLawRisk('架空の規定は令和九年四月から施行される。')).toEqual(expect.arrayContaining(['改正・施行']))
  })
  it('条・項・号の番号だけの算用数字は「数値」にしない', () => {
    expect(flagLawRisk('架空法第36条第1項の協定による。')).toEqual([])
    expect(flagLawRisk('架空の数値は12である。')).toEqual(['数値'])
  })
  it('数を含まない文・単位の無い漢数字（一時金・十分など）は拾わない', () => {
    expect(flagLawRisk('架空の使用者は、労働者に対して書面で明示しなければならない。')).toEqual([])
    expect(flagLawRisk('架空の一時金を支給し、十分な説明を行う。')).toEqual([])
  })
  it('結果は規則の並び順', () => {
    const r = flagLawRisk('架空の者が六十五歳に達した日から三十日以内に一万円を支払う。')
    const order = LAW_RISK_RULES.map(x => x.label)
    expect(r).toEqual([...r].sort((a, b) => order.indexOf(a) - order.indexOf(b)))
    expect(r).toEqual(['期間', '金額', '年齢'])
  })
  it('規則は PostgreSQL に埋め込めない書き方（\\d・後読み）を使わない', () => {
    for (const r of LAW_RISK_RULES) {
      expect(r.pattern).not.toMatch(/\\d|\(\?<[=!]/)
      expect(r.pattern).not.toContain("'")
    }
  })
})

describe('lawRiskText', () => {
  const spec: AnswerSpec = { kind: 'sentaku', blanks: { A: 2 }, wordbank: { 1: '架空の語', 2: '6か月' } }
  it('選択式の空欄は正答の語句を足して判定する', () => {
    const text = lawRiskText({ label: 'A', statement: '架空の期間は【 A 】とする。' }, spec)
    expect(text).toContain('6か月')
    expect(flagLawRisk(text)).toContain('数値')
  })
  it('択一式は本文のまま', () => {
    expect(lawRiskText({ label: 'A', statement: '架空の文' }, { kind: 'one', direction: 'wrong', correct: 1 })).toBe('架空の文')
    expect(lawRiskText({ label: 'B', statement: '架空の文' }, null)).toBe('架空の文')
  })
})

describe('appendLawNote', () => {
  it('既存の注記（問題誤りの公表など）を消さずに追記する', () => {
    const prev = '問題誤りの公表により複数の選択肢を正解とした: 架空の公表'
    expect(appendLawNote(prev, '追記')).toBe(`${prev}\n追記`)
  })
  it('空なら追記だけ、同じ行がすでにあれば変えない', () => {
    expect(appendLawNote(null, '追記')).toBe('追記')
    expect(appendLawNote('', '追記')).toBe('追記')
    expect(appendLawNote('a\n追記', '追記')).toBe('a\n追記')
    expect(appendLawNote('a', '  ')).toBe('a')
  })
})

describe('pickLawRiskCandidates', () => {
  const item = (id: string, statement: string, over: Partial<LawRiskInput> = {}): LawRiskInput => ({
    id, label: 'A', statement, law_status: 'unchecked', law_note: null, ...over,
  })
  const items = [
    item('R97_T_RK_01_A', '架空の届出は十日以内に行う。'),
    item('R97_T_RK_01_B', '架空の使用者は書面で明示する。'),
    item('R97_T_RK_01_C', '架空の給付は五千円とする。', { law_status: 'ok' }),
    item('R97_T_RK_01_D', '架空の給付は五千円とする。', { law_status: 'excluded' }),
    item('R97_T_RK_01_E', '架空の手当は二十歳まで支給する。', { law_note: '問題誤りの公表により複数の選択肢を正解とした: 架空' }),
  ]
  it('unchecked のうち規則に当たる肢だけを選ぶ', () => {
    const c = pickLawRiskCandidates(items, DEFAULT_LAW_BASE_DATE)
    expect(c.map(x => x.id)).toEqual(['R97_T_RK_01_A', 'R97_T_RK_01_E'])
    expect(c[0].law_note).toBe(lawRiskNote(['期間'], DEFAULT_LAW_BASE_DATE))
    expect(c[0].law_note).toContain(`法令基準日 ${DEFAULT_LAW_BASE_DATE}`)
  })
  it('公表の内容を残して追記する', () => {
    const e = pickLawRiskCandidates(items, '2026-04-10').find(x => x.id === 'R97_T_RK_01_E')!
    expect(e.law_note.split('\n')).toEqual(['問題誤りの公表により複数の選択肢を正解とした: 架空', lawRiskNote(['年齢'], '2026-04-10')])
  })
  it('冪等: 適用後（review）は対象外、自動判定の注記が既にある unchecked は注記を足さない', () => {
    const once = pickLawRiskCandidates(items, '2026-04-10')
    const applied = items.map(i => {
      const c = once.find(x => x.id === i.id)
      return c ? { ...i, law_status: 'review' as const, law_note: c.law_note } : i
    })
    expect(pickLawRiskCandidates(applied, '2026-04-10')).toEqual([])
    const reverted = applied.map(i => (i.law_status === 'review' ? { ...i, law_status: 'unchecked' as const } : i))
    const again = pickLawRiskCandidates(reverted, '2026-04-10')
    expect(again.map(x => x.law_note)).toEqual(once.map(x => x.law_note))
    expect(again.every(x => x.law_note.split(LAW_RISK_MARKER).length === 2)).toBe(true)
  })
})
