// 一括コピーした組の保持と復元（licensehub-expansion.md §6.3）。
import { describe, expect, it } from 'vitest'
import {
  BATCH_SESSION_KEY, clearBatchSession, isSameBatch, loadBatchSession, markBatchGraded,
  newBatchSession, parseBatchSession, saveBatchSession, type StorageLike,
} from './batchSession'

function memStorage(init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...init }
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v },
    removeItem: k => { delete data[k] },
  }
}

const NOW = new Date('2026-10-13T00:00:00.000Z')
const IDS = ['R07_T_RK_01_A', 'R07_T_RK_01_B', 'R07_T_RK_02_C']

describe('newBatchSession', () => {
  it('組（肢IDの並び・作成日時・userId・examId）を作る。重複は除く', () => {
    const s = newBatchSession([...IDS, IDS[0]], 'u1', 'sharoushi', NOW)
    expect(s).toEqual({ v: 1, ids: IDS, createdAt: '2026-10-13T00:00:00.000Z', userId: 'u1', examId: 'sharoushi' })
  })
})

describe('保存と読み出し', () => {
  it('保存した組を同じ順で復元できる（再読み込み相当）', () => {
    const st = memStorage()
    const s = newBatchSession(IDS, 'u1', 'sharoushi', NOW)
    expect(saveBatchSession(st, s)).toBe(true)
    // 保存されるのは文字列だけ（ブラウザを閉じても残る localStorage と同じ扱い）
    const reopened = memStorage({ ...st.data })
    expect(loadBatchSession(reopened, 'u1', 'sharoushi')).toEqual(s)
  })

  it('無ければ null', () => {
    expect(loadBatchSession(memStorage(), 'u1', 'sharoushi')).toBeNull()
  })

  it('storage が使えなければ保存は false、読み出しは null', () => {
    const s = newBatchSession(IDS, 'u1', 'sharoushi', NOW)
    expect(saveBatchSession(null, s)).toBe(false)
    expect(loadBatchSession(null, 'u1', 'sharoushi')).toBeNull()
    const throwing: StorageLike = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('denied') },
    }
    expect(saveBatchSession(throwing, s)).toBe(false)
    expect(loadBatchSession(throwing, 'u1', 'sharoushi')).toBeNull()
    expect(() => clearBatchSession(throwing)).not.toThrow()
  })

  it('壊れたデータは破棄する', () => {
    const broken = [
      '{not json',
      'null',
      '"x"',
      JSON.stringify({ v: 2, ids: IDS, createdAt: NOW.toISOString(), userId: 'u1', examId: 'sharoushi' }),
      JSON.stringify({ v: 1, ids: [], createdAt: NOW.toISOString(), userId: 'u1', examId: 'sharoushi' }),
      JSON.stringify({ v: 1, ids: ['a', 1], createdAt: NOW.toISOString(), userId: 'u1', examId: 'sharoushi' }),
      JSON.stringify({ v: 1, ids: ['a', 'a'], createdAt: NOW.toISOString(), userId: 'u1', examId: 'sharoushi' }),
      JSON.stringify({ v: 1, ids: IDS, createdAt: 'yesterday', userId: 'u1', examId: 'sharoushi' }),
      JSON.stringify({ v: 1, ids: IDS, createdAt: NOW.toISOString(), examId: 'sharoushi' }),
      JSON.stringify({ v: 1, ids: IDS, createdAt: NOW.toISOString(), userId: 'u1', examId: 'sharoushi', gradedAt: 5 }),
    ]
    for (const raw of broken) {
      const st = memStorage({ [BATCH_SESSION_KEY]: raw })
      expect(loadBatchSession(st, 'u1', 'sharoushi')).toBeNull()
      expect(st.data[BATCH_SESSION_KEY]).toBeUndefined()
    }
  })

  it('別ユーザーの組は破棄する', () => {
    const st = memStorage()
    saveBatchSession(st, newBatchSession(IDS, 'other', 'sharoushi', NOW))
    expect(loadBatchSession(st, 'u1', 'sharoushi')).toBeNull()
    expect(st.data[BATCH_SESSION_KEY]).toBeUndefined()
  })

  it('別の資格の組は返さないが、破棄もしない', () => {
    const st = memStorage()
    const s = newBatchSession(IDS, 'u1', 'sharoushi', NOW)
    saveBatchSession(st, s)
    expect(loadBatchSession(st, 'u1', 'other-exam')).toBeNull()
    expect(loadBatchSession(st, 'u1', 'sharoushi')).toEqual(s)
  })

  it('新しくコピーした組で上書きされる', () => {
    const st = memStorage()
    saveBatchSession(st, newBatchSession(IDS, 'u1', 'sharoushi', NOW))
    const s2 = newBatchSession(['R07_T_RK_03_D'], 'u1', 'sharoushi', new Date('2026-10-13T01:00:00Z'))
    saveBatchSession(st, s2)
    expect(loadBatchSession(st, 'u1', 'sharoushi')).toEqual(s2)
  })
})

describe('parseBatchSession', () => {
  it('余計なキーは落とす', () => {
    const raw = JSON.stringify({ v: 1, ids: IDS, createdAt: NOW.toISOString(), userId: 'u1', examId: 'sharoushi', extra: 1 })
    expect(parseBatchSession(raw)).toEqual({ v: 1, ids: IDS, createdAt: NOW.toISOString(), userId: 'u1', examId: 'sharoushi' })
  })
})

describe('markBatchGraded', () => {
  it('記録済みの印を付け、外せる', () => {
    const st = memStorage()
    const s = newBatchSession(IDS, 'u1', 'sharoushi', NOW)
    saveBatchSession(st, s)
    const graded = markBatchGraded(st, s, '2026-10-13T02:00:00.000Z')
    expect(graded.gradedAt).toBe('2026-10-13T02:00:00.000Z')
    expect(loadBatchSession(st, 'u1', 'sharoushi')?.gradedAt).toBe('2026-10-13T02:00:00.000Z')
    const back = markBatchGraded(st, graded, null)
    expect(back.gradedAt).toBeUndefined()
    expect(loadBatchSession(st, 'u1', 'sharoushi')).toEqual(s)
  })

  it('保存先が別の組に変わっていたら上書きしない', () => {
    const st = memStorage()
    const old = newBatchSession(IDS, 'u1', 'sharoushi', NOW)
    const fresh = newBatchSession(['R07_T_RK_03_D'], 'u1', 'sharoushi', new Date('2026-10-13T01:00:00Z'))
    saveBatchSession(st, fresh)
    markBatchGraded(st, old, '2026-10-13T02:00:00.000Z')
    expect(loadBatchSession(st, 'u1', 'sharoushi')).toEqual(fresh)
  })

  it('isSameBatch は作成日時と並びで判定する', () => {
    const a = newBatchSession(IDS, 'u1', 'sharoushi', NOW)
    expect(isSameBatch(a, { ...a, gradedAt: NOW.toISOString() })).toBe(true)
    expect(isSameBatch(a, { ...a, ids: [...IDS].reverse() })).toBe(false)
    expect(isSameBatch(a, { ...a, createdAt: '2026-10-14T00:00:00.000Z' })).toBe(false)
  })
})
