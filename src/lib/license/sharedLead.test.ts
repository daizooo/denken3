import { describe, expect, it } from 'vitest'
import { splitSharedLead } from './sharedLead'

const LEAD = '使用者は、労働者の同意を得た場合には、賃金の支払方法として、指定資金移動業者の口座への資金移動（デジタル払い）が、'
const items = [
  { label: 'A', statement: `${LEAD}「賃金の支払」は、法第24条に定められている。` },
  { label: 'B', statement: `${LEAD}「口座残高の上限」は、規則第7条の2に定められている。` },
  { label: 'C', statement: `${LEAD}「受け取りの方法」は、通達に定められている。` },
]

describe('splitSharedLead', () => {
  it('stem に前文があれば stem はそのままで、肢から前文を外す', () => {
    const r = splitSharedLead(`${LEAD}次のうち誤っているものはどれか。`, items)
    expect(r.stem).toBe(`${LEAD}次のうち誤っているものはどれか。`)
    expect(r.items.map(i => i.statement)).toEqual([
      '「賃金の支払」は、法第24条に定められている。',
      '「口座残高の上限」は、規則第7条の2に定められている。',
      '「受け取りの方法」は、通達に定められている。',
    ])
    expect(r.items[0].label).toBe('A')
  })

  it('stem に前文が無ければ stem の後ろに足す', () => {
    const r = splitSharedLead('次のうち誤っているものはどれか。', items)
    expect(r.stem).toBe(`次のうち誤っているものはどれか。\n${LEAD}`)
  })

  it('stem が無ければ前文を stem にする', () => {
    expect(splitSharedLead(null, items).stem).toBe(LEAD)
  })

  it('共通部分が短ければ何もしない', () => {
    const short = [{ statement: '使用者は、Aである。' }, { statement: '使用者は、Bである。' }]
    expect(splitSharedLead('x', short)).toEqual({ stem: 'x', items: short })
  })

  it('肢が1つなら何もしない', () => {
    const one = [items[0]]
    expect(splitSharedLead('x', one)).toEqual({ stem: 'x', items: one })
  })

  it('外すと肢が空になるなら何もしない', () => {
    const same = [{ statement: LEAD }, { statement: `${LEAD}「X」は、Yである。` }]
    expect(splitSharedLead('x', same)).toEqual({ stem: 'x', items: same })
  })

  it('語の途中では切らない（句読点・括弧の切れ目まで）', () => {
    const a = [{ statement: `${LEAD}労働基準法が適用される。` }, { statement: `${LEAD}労働安全衛生法が適用される。` }]
    const r = splitSharedLead('x', a)
    expect(r.items.map(i => i.statement)).toEqual(['労働基準法が適用される。', '労働安全衛生法が適用される。'])
  })
})
