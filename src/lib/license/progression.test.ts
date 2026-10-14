// 進級判定（licensehub-expansion.md §8.2）。履歴は架空の肢IDで組み立てる（本文は使わない）。
import { describe, expect, it } from 'vitest'
import type { MasterQuestion, ReviewHistoryEntry, Status } from '../../domain/types'
import { SHAROUSHI_PROGRESSION } from '../../data/sharoushi/index.ts'
import { judgeProgression } from './progression'

const T = SHAROUSHI_PROGRESSION
const q = (i: number, importance?: 1 | 2 | 3): MasterQuestion =>
  ({ id: `X99_${String(i).padStart(3, '0')}`, number: i, title: '架空', difficulty: 2, ...(importance ? { importance } : {}), studyMode: 'memory' })
const items = Array.from({ length: 20 }, (_, i) => q(i + 1, i < 2 ? 3 : 2))   // 先頭2肢が重要度A

// date ごとに、各肢の結果を並べる。statuses[i] が肢 i の結果（undefined は記録なし）。
function historyFrom(rounds: { date: string; statuses: (Status | undefined)[] }[]) {
  const map: Record<string, ReviewHistoryEntry[]> = {}
  for (const r of rounds) r.statuses.forEach((s, i) => { if (s) (map[items[i].id] ??= []).push({ date: r.date, status: s }) })
  return (id: string) => map[id] ?? []
}
const all = (s: Status, over: Record<number, Status | undefined> = {}) =>
  items.map((_, i) => (i in over ? over[i] : s))

describe('judgeProgression', () => {
  it('閾値は SHAROUSHI_PROGRESSION（85%・7日）', () => {
    expect(T).toEqual({ minSureRate: 0.85, gapDays: 7 })
  })

  it('索引に肢が無ければ empty', () => {
    expect(judgeProgression([], () => [], T).verdict).toBe('empty')
  })

  it('① 未着手が1肢でもあれば不合格', () => {
    const r = judgeProgression(items, historyFrom([{ date: '2026-11-01', statuses: all('A', { 5: undefined }) }]), T)
    expect(r.verdict).toBe('fail')
    expect(r.reasons[0]).toContain('未着手 1 肢')
  })

  it('② 迷いの正解（B）は確信正答率に数えない。17/20=85% は満たし、16/20=80% は満たさない', () => {
    const ok = judgeProgression(items, historyFrom([{ date: '2026-11-01', statuses: all('A', { 17: 'B', 18: 'B', 19: 'B' }) }]), T)
    expect(ok.current.sureRate).toBeCloseTo(0.85)
    expect(ok.current.passes).toBe(true)
    const ng = judgeProgression(items, historyFrom([{ date: '2026-11-01', statuses: all('A', { 16: 'B', 17: 'B', 18: 'B', 19: 'B' }) }]), T)
    expect(ng.verdict).toBe('fail')
    expect(ng.reasons.join()).toContain('確信正答率 80%')
  })

  it('③ 重要度Aの肢が直近 C なら、正答率を満たしても不合格', () => {
    const r = judgeProgression(items, historyFrom([{ date: '2026-11-01', statuses: all('A', { 0: 'C' }) }]), T)
    expect(r.current.sureRate).toBeCloseTo(0.95)
    expect(r.current.importantMisses).toEqual([items[0].id])
    expect(r.verdict).toBe('fail')
  })

  it('④ 1回だけ満たした時点は waiting（7日後以降の記録で2回目）', () => {
    const r = judgeProgression(items, historyFrom([{ date: '2026-11-01', statuses: all('A') }]), T)
    expect(r.verdict).toBe('waiting')
    expect(r.checkFrom).toBe('2026-11-08')
  })

  it('④ 6日しか空いていなければ waiting のまま、7日空けて再び満たせば合格', () => {
    const six = judgeProgression(items, historyFrom([
      { date: '2026-11-01', statuses: all('A') },
      { date: '2026-11-07', statuses: all('A') },
    ]), T)
    expect(six.verdict).toBe('waiting')
    const seven = judgeProgression(items, historyFrom([
      { date: '2026-11-01', statuses: all('A') },
      { date: '2026-11-08', statuses: [] },
      { date: '2026-11-08', statuses: all('A', { 3: undefined }) },
    ]), T)
    expect(seven.verdict).toBe('pass')
    expect(seven.firstPassDate).toBe('2026-11-01')
  })

  it('④ 2回目の前に崩れたら（最新の時点で満たさなければ）不合格', () => {
    const r = judgeProgression(items, historyFrom([
      { date: '2026-11-01', statuses: all('A') },
      { date: '2026-11-09', statuses: [ 'C' ] },
    ]), T)
    expect(r.verdict).toBe('fail')
  })

  it('弱点は直近が C・B の肢（C を先に）', () => {
    const r = judgeProgression(items, historyFrom([{ date: '2026-11-01', statuses: all('A', { 4: 'B', 9: 'C' }) }]), T)
    expect(r.weakIds).toEqual([items[9].id, items[4].id])
  })
})
