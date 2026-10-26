import { describe, expect, it } from 'vitest'
import { computeTopicImportance } from './importance'

const items = (spec: Record<string, number>) =>
  Object.entries(spec).flatMap(([topic, n]) => Array.from({ length: n }, () => ({ topic_id: topic })))

describe('computeTopicImportance', () => {
  it('件数の多い順に累積し、50%に届くまでがA・80%に届くまでがB・残りがC', () => {
    // 合計100。累積: x=40, y=70, z=90, w=100。直前の累積は 0, 40, 70, 90
    const r = computeTopicImportance(items({ x: 40, y: 30, z: 20, w: 10 }))
    expect(r.map(t => [t.topic, t.importance])).toEqual([['x', 'A'], ['y', 'A'], ['z', 'B'], ['w', 'C']])
    expect(r.map(t => t.cumulativeShare)).toEqual([0.4, 0.7, 0.9, 1])
  })
  it('境界をまたぐ論点は上の区分に入れる（直前の累積で決める）', () => {
    const r = computeTopicImportance(items({ a: 60, b: 25, c: 15 }))
    expect(r.map(t => t.importance)).toEqual(['A', 'B', 'C'])
  })
  it('同数は論点名の自然順で、入力の順序に依らない', () => {
    const a = computeTopicImportance(items({ '10 い': 5, '02 ろ': 5, '01 は': 5 }))
    const b = computeTopicImportance(items({ '01 は': 5, '02 ろ': 5, '10 い': 5 }))
    expect(a).toEqual(b)
    expect(a.map(t => t.topic)).toEqual(['01 は', '02 ろ', '10 い'])
  })
  it('論点の無い肢と除外の肢は数えない', () => {
    const r = computeTopicImportance([
      { topic_id: null }, { topic_id: '  ' }, { topic_id: 'a', law_status: 'excluded' }, { topic_id: 'a' }, { topic_id: 'b' },
    ])
    expect(r.map(t => [t.topic, t.count])).toEqual([['a', 1], ['b', 1]])
  })
  it('肢が無ければ空', () => {
    expect(computeTopicImportance([])).toEqual([])
  })
  it('しきい値を変えられる', () => {
    const r = computeTopicImportance(items({ x: 40, y: 30, z: 30 }), { aShare: 0.3, bShare: 0.6 })
    expect(r.map(t => t.importance)).toEqual(['A', 'B', 'C'])
  })
})
