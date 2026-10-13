import { describe, expect, it } from 'vitest'
import { judgeScoring, judgeSection } from './scoring'
import { SHAROUSHI_EXAM, SHAROUSHI_SCORING, SHAROUSHI_SUBJECTS } from '../data/sharoushi'

const [sentaku, taku] = SHAROUSHI_SCORING.sections

function fill(codes: string[], pts: number): Record<string, number> {
  return Object.fromEntries(codes.map(c => [c, pts]))
}
const codesOf = (sec: typeof taku) => sec.subjects.map(s => s.code)

describe('社労士の ScoringModel', () => {
  it('選択式8科目40点・択一式7科目70点、学習10科目、allText', () => {
    expect(sentaku.subjects).toHaveLength(8)
    expect(sentaku.totalMax).toBe(40)
    expect(taku.subjects).toHaveLength(7)
    expect(taku.totalMax).toBe(70)
    expect(SHAROUSHI_SUBJECTS).toHaveLength(10)
    expect(SHAROUSHI_EXAM.features.allText).toBe(true)
  })
})

describe('judgeSection', () => {
  it('総得点が基準以上で足切りが無ければ合格', () => {
    const r = judgeSection(taku, fill(codesOf(taku), 7))   // 49点
    expect(r.total).toBe(49)
    expect(r.meetsTotal).toBe(true)
    expect(r.meetsTarget).toBe(false)
    expect(r.floorFailures).toEqual([])
    expect(r.passed).toBe(true)
  })

  it('総得点を満たしても足切り科目があれば不合格', () => {
    const r = judgeSection(taku, { ...fill(codesOf(taku), 8), KN: 3 })   // 51点、KN<4
    expect(r.meetsTotal).toBe(true)
    expect(r.floorFailures).toEqual(['KN'])
    expect(r.passed).toBe(false)
  })

  it('境界値: 足切りちょうど・基準ちょうどは合格', () => {
    const r = judgeSection(sentaku, { ...fill(codesOf(sentaku), 3), RK: 4 })   // 25点、全科目3点以上
    expect(r.total).toBe(25)
    expect(r.passed).toBe(true)
  })

  it('未入力の科目は0点として足切り扱い', () => {
    const r = judgeSection(sentaku, { RK: 5 })
    expect(r.total).toBe(5)
    expect(r.floorFailures).toHaveLength(7)
  })

  it('年ごとの足切り補正（3点→2点）で救済される', () => {
    const scores = { ...fill(codesOf(sentaku), 4), SI: 2 }
    expect(judgeSection(sentaku, scores).passed).toBe(false)
    expect(judgeSection(sentaku, scores, { SI: 2 }).passed).toBe(true)
  })
})

describe('judgeScoring', () => {
  it('全セクション合格で合格、どれかが不合格なら不合格', () => {
    const ok = judgeScoring(SHAROUSHI_SCORING, {
      sentaku: fill(codesOf(sentaku), 4), taku: fill(codesOf(taku), 7),
    })
    expect(ok.passed).toBe(true)
    const ng = judgeScoring(SHAROUSHI_SCORING, {
      sentaku: fill(codesOf(sentaku), 4), taku: fill(codesOf(taku), 6),
    })
    expect(ng.passed).toBe(false)
    expect(ng.sections.map(s => s.sectionId)).toEqual(['sentaku', 'taku'])
  })
})
