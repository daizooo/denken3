// 肢の本文の取得と出題可否（licensehub-expansion.md §5・§6.2・§9）。
import { describe, expect, it } from 'vitest'
import { FETCH_CHUNK, chunk, isAskableItem, loadItemBodies, type ItemBody, type ItemBodyDeps } from './itemBody'

const body = (id: string, over: Partial<ItemBody> = {}): ItemBody => ({
  id, question_id: id.slice(0, -2), label: 'A', statement: `本文 ${id}`, truth: true,
  explanation: '解説', explanation_source: 'book', law_status: 'ok',
  study_subject: 'rouki', scored_subject: 'RK', ...over,
})

describe('isAskableItem', () => {
  it('本文があり truth が決まり law_status=ok の肢だけ出題する', () => {
    expect(isAskableItem(body('R07_T_RK_01_A'))).toBe(true)
    expect(isAskableItem(body('R07_T_RK_01_A', { truth: false }))).toBe(true)
  })
  it('本文が無い・空は出題しない', () => {
    expect(isAskableItem(undefined)).toBe(false)
    expect(isAskableItem(null)).toBe(false)
    expect(isAskableItem(body('R07_T_RK_01_A', { statement: '  ' }))).toBe(false)
  })
  it('truth が null は出題しない（問モード専用）', () => {
    expect(isAskableItem(body('R07_T_RK_01_A', { truth: null }))).toBe(false)
  })
  it('law_status が ok 以外は出題しない', () => {
    for (const s of ['unchecked', 'review', 'excluded'] as const) {
      expect(isAskableItem(body('R07_T_RK_01_A', { law_status: s }))).toBe(false)
    }
  })
})

describe('chunk', () => {
  it('指定件数で分割する', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})

function makeDeps(over: Partial<ItemBodyDeps> & { cache?: Record<string, ItemBody>; remote?: Record<string, ItemBody> } = {}) {
  const { cache: initial, remote: remoteRows, ...rest } = over
  const cache: Record<string, ItemBody> = { ...(initial ?? {}) }
  const remote = remoteRows ?? {}
  const calls: string[][] = []
  const deps: ItemBodyDeps = {
    readCache: async ids => Object.fromEntries(ids.filter(id => cache[id]).map(id => [id, cache[id]])),
    writeCache: async bodies => { for (const b of bodies) cache[b.id] = b },
    fetchRemote: async ids => { calls.push(ids); return ids.filter(id => remote[id]).map(id => remote[id]) },
    online: true,
    ...rest,
  }
  return { deps, cache, calls }
}

describe('loadItemBodies', () => {
  it('キャッシュにある肢はリモートへ取りに行かない', async () => {
    const a = body('R07_T_RK_01_A')
    const { deps, calls } = makeDeps({ cache: { [a.id]: a } })
    const r = await loadItemBodies([a.id], deps)
    expect(r.bodies[a.id]).toEqual(a)
    expect(calls).toEqual([])
    expect(r.missing).toEqual([])
  })
  it('不足分を200件単位で取得し、キャッシュへ入れる', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `R07_T_RK_${String(i % 99 + 1).padStart(2, '0')}_${'ABCDE'[i % 5]}#${i}`)
    const remote = Object.fromEntries(ids.map(id => [id, body(id)]))
    const { deps, cache, calls } = makeDeps({ remote })
    const r = await loadItemBodies(ids, deps)
    expect(calls.map(c => c.length)).toEqual([FETCH_CHUNK, FETCH_CHUNK, 50])
    expect(Object.keys(r.bodies)).toHaveLength(450)
    expect(Object.keys(cache)).toHaveLength(450)
    expect(r.failed).toBe(false)
  })
  it('取得失敗・未登録の肢は missing に入り、bodies には入らない', async () => {
    const ok = body('R07_T_RK_01_A')
    const { deps } = makeDeps({ remote: { [ok.id]: ok } })
    const r1 = await loadItemBodies([ok.id, 'R07_T_RK_01_B'], deps)
    expect(r1.missing).toEqual(['R07_T_RK_01_B'])

    const { deps: failing } = makeDeps({ fetchRemote: async () => { throw new Error('network') } })
    const r2 = await loadItemBodies([ok.id], failing)
    expect(r2.failed).toBe(true)
    expect(r2.bodies).toEqual({})
    expect(r2.missing).toEqual([ok.id])
  })
  it('オフラインではリモートへ行かず、キャッシュだけを返す', async () => {
    const a = body('R07_T_RK_01_A')
    const { deps, calls } = makeDeps({ cache: { [a.id]: a }, online: false })
    const r = await loadItemBodies([a.id, 'R07_T_RK_01_B'], deps)
    expect(calls).toEqual([])
    expect(Object.keys(r.bodies)).toEqual([a.id])
    expect(r.missing).toEqual(['R07_T_RK_01_B'])
  })
  it('キャッシュの読み出しが失敗してもリモートから取る', async () => {
    const a = body('R07_T_RK_01_A')
    const { deps } = makeDeps({ remote: { [a.id]: a }, readCache: async () => { throw new Error('idb') } })
    const r = await loadItemBodies([a.id], deps)
    expect(r.bodies[a.id]).toEqual(a)
  })
  it('頼んでいない ID が返ってきても混ぜない', async () => {
    const a = body('R07_T_RK_01_A')
    const extra = body('R07_T_RK_01_C')
    const { deps } = makeDeps({ fetchRemote: async () => [a, extra] })
    const r = await loadItemBodies([a.id], deps)
    expect(Object.keys(r.bodies)).toEqual([a.id])
  })
})
