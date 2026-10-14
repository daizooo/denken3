// 目標日の逆算（licensehub-expansion.md §10.1）。
import { describe, expect, it } from 'vitest'
import { diffDays } from '../date'
import { SHAROUSHI_PLAN_ANCHORS, SHAROUSHI_PLAN_ORDER, SHAROUSHI_PLAN_WEIGHTS } from '../../data/sharoushi/plan.ts'
import { computeTargets, planMilestones, resolvePlanSettings } from './plan'

const EXAM = '2027-08-22'
const A = SHAROUSHI_PLAN_ANCHORS
const run = (overrides?: Record<string, string>) =>
  computeTargets(EXAM, A, SHAROUSHI_PLAN_WEIGHTS, SHAROUSHI_PLAN_ORDER, overrides)
const targetOf = (r: ReturnType<typeof run>, id: string) => r.targets.find(t => t.subjectId === id)!

describe('planMilestones', () => {
  it('§10.1 の表どおりの基準点を出す', () => {
    expect(planMilestones(EXAM, A)).toEqual({
      examDate: '2027-08-22',
      finalPhaseStart: '2027-06-27',
      gateDate: '2027-05-31',
      throughStart: '2027-03-08',
      firstRoundDeadline: '2027-03-07',
      startDate: '2026-10-23',
    })
  })
})

describe('computeTargets', () => {
  it('学習順に並び、最後の科目は1周目の完了期限ちょうど', () => {
    const r = run()
    expect(r.targets.map(t => t.subjectId)).toEqual(SHAROUSHI_PLAN_ORDER)
    expect(r.targets.at(-1)!.target).toBe('2027-03-07')
    for (let i = 1; i < r.targets.length; i++) expect(r.targets[i].target >= r.targets[i - 1].target).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('科目ごとの目標日（仮の重み）', () => {
    expect(Object.fromEntries(run().targets.map(t => [t.subjectId, t.target]))).toEqual({
      rouki: '2026-11-02',
      anei: '2026-11-11',
      rousai: '2026-11-25',
      koyou: '2026-12-08',
      choushu: '2026-12-20',
      kenpo: '2027-01-08',
      kokunen: '2027-01-27',
      kounen: '2027-02-16',
      rouippan: '2027-02-25',
      shaippan: '2027-03-07',
    })
  })

  it('§10.1 の出力例との差（関数の値 − 出力例、日）', () => {
    // 出力例は科目グループの終わりの日。按分の端数の扱いの違いで後半ほど最大2日ずれる（関数の値が正）。
    const example: [string, string][] = [
      ['anei', '2026-11-11'],      // 労基・安衛
      ['choushu', '2026-12-19'],   // 労災・雇用・徴収
      ['kokunen', '2027-01-26'],   // 健保・国年
      ['kounen', '2027-02-14'],    // 厚年
      ['shaippan', '2027-03-05'],  // 労一・社一
    ]
    const r = run()
    expect(example.map(([id, d]) => diffDays(d, targetOf(r, id).target))).toEqual([0, 1, 1, 2, 2])
  })

  it('既定の発売日・最短日数では警告が出ない', () => {
    expect(run().targets.filter(t => t.warning)).toEqual([])
  })

  it('上書きした科目は再計算の対象外で、他の科目の日付は変わらない', () => {
    const base = run()
    const r = run({ kenpo: '2027-02-01' })
    expect(targetOf(r, 'kenpo')).toMatchObject({ target: '2027-02-01', computed: '2027-01-08', overridden: true })
    for (const t of r.targets.filter(t => t.subjectId !== 'kenpo')) expect(t.target).toBe(targetOf(base, t.subjectId).target)
    // 重みを変えても上書きした科目は動かない
    const r2 = computeTargets(EXAM, A, { ...SHAROUSHI_PLAN_WEIGHTS, rouki: 30 }, SHAROUSHI_PLAN_ORDER, { kenpo: '2027-02-01' })
    expect(targetOf(r2, 'kenpo').target).toBe('2027-02-01')
    expect(targetOf(r2, 'rouki').target).not.toBe(targetOf(base, 'rouki').target)
  })

  it('制約を満たせない科目に警告を出し、日付は動かさない', () => {
    const r = run({ kenpo: '2026-12-15' })
    expect(targetOf(r, 'kenpo').target).toBe('2026-12-15')
    expect(targetOf(r, 'kenpo').warning).toContain('2026-12-21')
    // 学習順で健保を先頭にすると、発売前に目標日が来る
    const order = ['kenpo', ...SHAROUSHI_PLAN_ORDER.filter(id => id !== 'kenpo')]
    const r2 = computeTargets(EXAM, A, SHAROUSHI_PLAN_WEIGHTS, order)
    expect(targetOf(r2, 'kenpo').target).toBe('2026-11-11')
    expect(targetOf(r2, 'kenpo').warning).not.toBeNull()
  })

  it('学習順・重みを変えると再計算される。重み0・順序の重複は除く', () => {
    const order = [...SHAROUSHI_PLAN_ORDER].reverse()
    const r = computeTargets(EXAM, A, { ...SHAROUSHI_PLAN_WEIGHTS, choushu: 0 }, [...order, 'rouki'])
    expect(r.targets.map(t => t.subjectId)).toEqual(order.filter(id => id !== 'choushu'))
    expect(r.targets[0].subjectId).toBe('shaippan')
    expect(r.targets.at(-1)!.target).toBe('2027-03-07')
  })

  it('本試験日・基準点の変更が反映され、矛盾は警告になる', () => {
    expect(computeTargets('2027-08-29', A, SHAROUSHI_PLAN_WEIGHTS, SHAROUSHI_PLAN_ORDER).milestones.finalPhaseStart).toBe('2027-07-04')
    const late = computeTargets('2027-07-15', A, SHAROUSHI_PLAN_WEIGHTS, SHAROUSHI_PLAN_ORDER)
    expect(late.warnings.some(w => w.includes('模試ゲート'))).toBe(true)
    const r = computeTargets(EXAM, { ...A, gateDate: '2027-04-30' }, SHAROUSHI_PLAN_WEIGHTS, SHAROUSHI_PLAN_ORDER)
    expect(r.milestones.firstRoundDeadline).toBe('2027-02-04')
    expect(r.targets.at(-1)!.target).toBe('2027-02-04')
  })
})

describe('resolvePlanSettings', () => {
  const defaults = { anchors: A, weights: SHAROUSHI_PLAN_WEIGHTS, order: SHAROUSHI_PLAN_ORDER }
  it('未設定は既定値', () => {
    expect(resolvePlanSettings(defaults, { anchors: null, weights: null, order: null })).toEqual(defaults)
  })
  it('保存値を重ね、型の合わない値・未知の科目は捨て、漏れた科目は末尾に足す', () => {
    const r = resolvePlanSettings(defaults, {
      anchors: { gateDate: '2027-05-24', throughWeeks: 'x', releaseDates: { rousai: '2026-10-23' } },
      weights: { rouki: 8, unknown: 3, anei: -1 },
      order: ['kenpo', 'unknown', 'rouki'],
    })
    expect(r.anchors.gateDate).toBe('2027-05-24')
    expect(r.anchors.throughWeeks).toBe(12)
    expect(r.anchors.releaseDates.rousai).toBe('2026-10-23')
    expect(r.anchors.releaseDates.kenpo).toBe('2026-12-14')
    expect(r.weights).toMatchObject({ rouki: 8, anei: 5 })
    expect('unknown' in r.weights).toBe(false)
    expect(r.order.slice(0, 3)).toEqual(['kenpo', 'rouki', 'anei'])
    expect(r.order).toHaveLength(10)
  })
})
