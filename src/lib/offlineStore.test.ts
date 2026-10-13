// IndexedDB の版上げ（v1 → v2）で既存の snapshot / outbox を失わないこと（licensehub-expansion.md §5）。
//
// 版上げで既存データが消えるのは、onupgradeneeded でストアを削除・作り直したときだけ。
// upgradeOfflineDb が「無いストアを作る」以外の操作をしないことを、偽の DB で確かめる。
import { describe, expect, it } from 'vitest'
import { BODIES_STORE, upgradeOfflineDb } from './offlineStore'

function fakeDb(existing: string[]) {
  const stores = new Map<string, unknown[]>(existing.map(n => [n, [`${n}-data`]]))
  const created: { name: string; keyPath: unknown }[] = []
  const db = {
    objectStoreNames: { contains: (n: string) => stores.has(n) } as unknown as DOMStringList,
    createObjectStore: ((name: string, opts?: IDBObjectStoreParameters) => {
      if (stores.has(name)) throw new Error(`ConstraintError: ${name} already exists`)
      stores.set(name, [])
      created.push({ name, keyPath: opts?.keyPath })
      return {} as IDBObjectStore
    }) as IDBDatabase['createObjectStore'],
    // 削除が呼ばれたら既存データを失う。呼ばれないことを確かめる。
    deleteObjectStore: () => { throw new Error('deleteObjectStore must not be called') },
  }
  return { db, stores, created }
}

describe('upgradeOfflineDb', () => {
  it('v1（snapshot・outbox あり）→ v2: bodies だけを足し、既存のデータを残す', () => {
    const { db, stores, created } = fakeDb(['snapshot', 'outbox'])
    upgradeOfflineDb(db)
    expect(created).toEqual([{ name: BODIES_STORE, keyPath: 'key' }])
    expect(stores.get('snapshot')).toEqual(['snapshot-data'])
    expect(stores.get('outbox')).toEqual(['outbox-data'])
  })
  it('新規インストール（v0 → v2）: 3つのストアを作る', () => {
    const { db, created } = fakeDb([])
    upgradeOfflineDb(db)
    expect(created.map(c => c.name)).toEqual(['snapshot', 'outbox', 'bodies'])
    expect(created.every(c => c.keyPath === 'key')).toBe(true)
  })
  it('既に v2 の構成なら何もしない（二重に作らない）', () => {
    const { db, created } = fakeDb(['snapshot', 'outbox', 'bodies'])
    upgradeOfflineDb(db)
    expect(created).toEqual([])
  })
})
