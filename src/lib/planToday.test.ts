// 今日のライン（planToday）の回帰テスト。
//
// ここで固定するのは数値ではなく **不変条件** である。密度の計算式や係数は今後も
// 調整されうるが、以下の性質が崩れたら設計そのものが壊れている（設計書 §3.5・§0）:
//
//   ① 総量は減らない ―― 線より下は「消えた」のではなく「順番待ち」で、翌日以降に戻る
//   ② コアの🔴優先は、予算を超えても線の上に残す（忘却の進行を予算都合で見捨てない）
//   ③ 今日の新規着手枠は、①で予算を使い切っても 0 問にしない
//   ④ 予算がゼロ・未設定でも「今日は0問」とは出さない
//   ⑤ 復習キューの並び順の定義はアプリ内に1つだけ（orderByDensity）
//
// ①〜④はいずれも「勉強できない日が続くほど要求が下がる」挙動を潰すために入れたもので、
// 利用者が明確に禁止した方向（原則 §0）へ戻っていないことを検出する。

import { describe, it, expect } from 'vitest'
import { planToday, orderByDensity, forwardSlotsToday, type TodayCandidate } from './planToday'
import type { Policy } from './policy'
import type { TimeStats } from './estimateMinutes'
import type { MasterQuestion, Review, Status } from '../domain/types'
import { deriveFromHistory } from './fsrs'

const TODAY = '2026-09-04'
const EXAM = '2027-02-06'

function q(id: string, difficulty: 1 | 2 | 3 = 2): MasterQuestion {
  return { id, number: 1, title: id, difficulty, studyMode: 'calc' }
}

// 履歴から実際に導出した Review。R・stability・due が FSRS 由来の整合した値になる。
function reviewFrom(id: string, history: { date: string; status: Status }[]): Review {
  return {
    question_id: id, tags: [], memo: '',
    ...deriveFromHistory(history, EXAM),
  } as Review
}

// 所要時間はテストごとに固定したいので、実測値（measured）で直接与える。
function stats(measuredMinutes: Record<string, number>): TimeStats {
  const measured: Record<string, number> = {}
  for (const [id, m] of Object.entries(measuredMinutes)) measured[id] = m * 60
  const empty = { calc: null, memory: null, unset: null }
  return {
    byModeBand: { 1: { ...empty }, 2: { ...empty }, 3: { ...empty } },
    byBand: { 1: null, 2: null, 3: null },
    measured,
    measuredN: Object.keys(measured).length,
  }
}

function policyOf(over: Partial<Policy> & { coreIds: Set<string> }): Policy {
  return {
    today: TODAY, examDate: EXAM, horizonDate: '2026-11-29', horizonDays: 86,
    estimateValidated: false, passMargin: 15, targetScore: 75, estimate: 55,
    coreForwardQ: 208, coreMaintainQ: 196, requiredPaceQ: 2.4, dailyFloor: 3,
    attemptsPerMastery: 2,
    retentionOf: () => 0.85,
    layer3Active: false, fallbackRetention: 0.85, endgame: false,
    feasibility: {
      requiredMinutesPerDay: 50, availableMinutesPerDay: 12,
      verdict: 'shortfall', options: ['increase_time', 'defer_exam', 'accept_risk'],
    },
    ...over,
  } as Policy
}

// 期限を大きく過ぎた維持コア（A）。2026-09-04 時点で R < 0.75（＝目標保持率0.85 − 0.10）
// となり🔴優先に入る。実データでも「A のまま何週間も触れていない」が最も多い形。
const OVERDUE: { id: string; history: { date: string; status: Status }[] }[] = [
  { id: 'a1', history: [{ date: '2026-07-10', status: 'A' }] },
  { id: 'a2', history: [{ date: '2026-07-14', status: 'A' }] },
  { id: 'a3', history: [{ date: '2026-07-18', status: 'A' }] },
]

function overdueCandidates(): TodayCandidate[] {
  return OVERDUE.map(o => ({ question: q(o.id), review: reviewFrom(o.id, o.history) }))
}

describe('前提: 期限超過の維持コアは🔴優先になっている', () => {
  it('R が目標保持率を大きく下回る', () => {
    const items = orderByDensity({
      candidates: overdueCandidates(),
      policy: policyOf({ coreIds: new Set(['a1', 'a2', 'a3']) }),
      stats: stats({ a1: 1, a2: 1, a3: 1 }),
      today: TODAY, examDate: EXAM,
    })
    expect(items.every(i => i.urgent)).toBe(true)
  })
})

describe('① 総量は減らない（線より下は順番待ち）', () => {
  it('候補は1問も捨てられず、今日の分と順番待ちに分かれるだけ', () => {
    const candidates = [
      ...overdueCandidates(),
      { question: q('new1'), review: undefined },
      { question: q('new2'), review: undefined },
    ]
    const plan = planToday({
      candidates,
      policy: policyOf({ coreIds: new Set(['a1', 'a2', 'a3', 'new1', 'new2']) }),
      budgetMinutes: 5,
      stats: stats({ a1: 1, a2: 1, a3: 1 }),
      today: TODAY, examDate: EXAM,
      newIds: new Set(['new1', 'new2']),
    })
    expect(plan.items).toHaveLength(candidates.length)
    expect(plan.totalCount).toBe(candidates.length)
    expect(plan.recommendedCount + plan.waitingCount).toBe(plan.totalCount)
    // 所要分も按分され、失われない
    expect(plan.recommendedMinutes + plan.waitingMinutes).toBeCloseTo(plan.totalMinutes, 6)
  })

  it('rank は items と同じ並びで、全問に順位が付く', () => {
    const candidates = overdueCandidates()
    const plan = planToday({
      candidates,
      policy: policyOf({ coreIds: new Set(['a1', 'a2', 'a3']) }),
      budgetMinutes: null,
      stats: stats({ a1: 1, a2: 2, a3: 3 }),
      today: TODAY, examDate: EXAM,
      newIds: new Set(),
    })
    expect(plan.rank.size).toBe(candidates.length)
    plan.items.forEach((i, idx) => expect(plan.rank.get(i.id)).toBe(idx))
  })
})

describe('② コアの🔴優先は予算を超えても線の上に残る', () => {
  it('予算1分でも、期限超過のコア3問は全て今日の分に入る', () => {
    const plan = planToday({
      candidates: overdueCandidates(),
      policy: policyOf({ coreIds: new Set(['a1', 'a2', 'a3']) }),
      budgetMinutes: 1,
      stats: stats({ a1: 4, a2: 4, a3: 4 }), // 合計12分 ≫ 予算1分
      today: TODAY, examDate: EXAM,
      newIds: new Set(),
    })
    expect(plan.recommendedCount).toBe(3)
    expect(plan.urgentCount).toBe(3)
    expect(plan.overBudget).toBe(true) // 超えていることは画面に出す
  })

  it('コアでない🔴優先（バッファ）は予算に従う', () => {
    const plan = planToday({
      candidates: overdueCandidates(),
      policy: policyOf({ coreIds: new Set() }), // 全てバッファ
      budgetMinutes: 1,
      stats: stats({ a1: 4, a2: 4, a3: 4 }),
      today: TODAY, examDate: EXAM,
      newIds: new Set(),
    })
    // 最低ライン（予算選択時は1問）だけ
    expect(plan.recommendedCount).toBe(1)
  })
})

describe('③ 新規着手枠は 0 問にならない（review-display-analysis-warnings の再発防止）', () => {
  it('期限超過のコアで予算を使い切っても、新規着手が1問は残る', () => {
    const plan = planToday({
      candidates: [
        ...overdueCandidates(),
        { question: q('new1'), review: undefined },
      ],
      policy: policyOf({ coreIds: new Set(['a1', 'a2', 'a3', 'new1']) }),
      budgetMinutes: 5,
      stats: stats({ a1: 3, a2: 3, a3: 3 }), // ②で9分＝予算超過。③に到達しない状況を作る
      today: TODAY, examDate: EXAM,
      newIds: new Set(['new1']),
    })
    expect(plan.newCount).toBeGreaterThanOrEqual(1)
    expect(plan.items.slice(0, plan.recommendedCount).some(i => i.fresh)).toBe(true)
  })

  it('予算が未設定なら今日の枠すべてが線の上に来る', () => {
    const newIds = new Set(['new1', 'new2', 'new3'])
    const plan = planToday({
      candidates: [
        ...overdueCandidates(),
        ...[...newIds].map(id => ({ question: q(id), review: undefined })),
      ],
      policy: policyOf({ coreIds: new Set(['a1', 'a2', 'a3', ...newIds]) }),
      budgetMinutes: null,
      stats: stats({ a1: 3, a2: 3, a3: 3 }),
      today: TODAY, examDate: EXAM,
      newIds,
    })
    expect(plan.newCount).toBe(3)
  })
})

describe('④ 予算がゼロ・未設定でも「今日は0問」にはしない', () => {
  it('予算0でも最低1問は出る', () => {
    const plan = planToday({
      candidates: [{ question: q('b1'), review: reviewFrom('b1', [{ date: '2026-09-01', status: 'B' }]) }],
      policy: policyOf({ coreIds: new Set(['b1']) }),
      budgetMinutes: 0,
      stats: stats({ b1: 30 }),
      today: TODAY, examDate: EXAM,
      newIds: new Set(),
    })
    expect(plan.recommendedCount).toBe(1)
  })

  it('候補が0問なら 0 を返す（例外にしない）', () => {
    const plan = planToday({
      candidates: [], policy: policyOf({ coreIds: new Set() }), budgetMinutes: 15,
      stats: stats({}), today: TODAY, examDate: EXAM, newIds: new Set(),
    })
    expect(plan.recommendedCount).toBe(0)
    expect(plan.totalCount).toBe(0)
    expect(plan.overBudget).toBe(false)
  })
})

describe('⑤ 並び順の定義は1つ（orderByDensity）', () => {
  it('密度（点数影響 ÷ 所要分）の降順に並ぶ', () => {
    const items = orderByDensity({
      candidates: overdueCandidates(),
      policy: policyOf({ coreIds: new Set(['a1', 'a2', 'a3']) }),
      stats: stats({ a1: 8, a2: 1, a3: 4 }), // 同条件なら短いほど密度が高い
      today: TODAY, examDate: EXAM,
    })
    expect(items.map(i => i.id)).toEqual(['a2', 'a3', 'a1'])
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].density).toBeGreaterThanOrEqual(items[i].density)
    }
  })

  it('newIds を渡さなくても動く（今日以外の日付の一覧はライン無しで並べるだけ）', () => {
    const items = orderByDensity({
      candidates: overdueCandidates(),
      policy: policyOf({ coreIds: new Set(['a1']) }),
      stats: stats({ a1: 2, a2: 2, a3: 2 }),
      today: TODAY, examDate: EXAM,
    })
    expect(items.every(i => i.fresh === false)).toBe(true)
    expect(items.filter(i => i.core)).toHaveLength(1)
  })
})

describe('forwardSlotsToday（今日の新規着手枠）', () => {
  const p = policyOf({ coreIds: new Set(), requiredPaceQ: 2.4, dailyFloor: 3 })

  it('現在ペースを見ない ―― 停止が続いても枠は 0 に張り付かない', () => {
    expect(forwardSlotsToday(p, 0)).toBe(3) // ceil(2.4)=3
  })

  it('今日すでに着手した分だけ枠が減る（補充し続けない）', () => {
    expect(forwardSlotsToday(p, 2)).toBe(1)
    expect(forwardSlotsToday(p, 3)).toBe(0)
    expect(forwardSlotsToday(p, 99)).toBe(0)
  })
})
